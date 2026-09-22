import { test } from "node:test";
import assert from "node:assert/strict";
import { MockAIProvider } from "../providers/ai/MockAIProvider.js";
import { executeTool } from "../tools/toolExecutor.js";
import * as cartService from "../services/cartService.js";
import { getAllProducts } from "../data/products.js";
import { effectivePrice } from "../types/product.js";
import { AIMessage } from "../providers/ai/AIProvider.js";
import { SupportedLanguageCode } from "../types/language.js";

/**
 * Regression coverage for: a price/availability QUESTION was being
 * misclassified as a purchase instruction whenever it happened to state a
 * quantity (e.g. "How much is 2 kilos of basmati rice?"), which called
 * add_to_cart and silently mutated the cart. See MockAIProvider.parseIntent
 * (detectUtteranceIntent gate) and services/queryNormalization.ts
 * (detectUtteranceIntent, computePacksNeeded) for the fix.
 *
 * Same driver as mockAIProvider.test.ts: real MockAIProvider + real
 * toolExecutor + real cartService, no network/env dependency.
 */
async function runTurn(userText: string, language: SupportedLanguageCode, customerId: string) {
  const provider = new MockAIProvider();
  const history: AIMessage[] = [
    { role: "system", content: `LANGUAGE_CODE:${language}` },
    { role: "user", content: userText },
  ];
  const toolCalls: string[] = [];
  let finalText = "";

  for (let i = 0; i < 6; i++) {
    const response = await provider.chat({ messages: history, tools: [] });
    if (response.finishReason === "stop" || !response.message.toolCalls?.length) {
      finalText = response.message.content;
      history.push(response.message);
      break;
    }
    history.push(response.message);
    for (const toolCall of response.message.toolCalls) {
      const result = await executeTool(toolCall.name, toolCall.arguments, customerId);
      toolCalls.push(toolCall.name);
      history.push({ role: "tool", content: JSON.stringify(result), toolCallId: toolCall.id, name: toolCall.name });
    }
  }

  return { finalText, toolCalls };
}

function uniqueCustomerId(label: string): string {
  return `test-priceinfo-${label}-${crypto.randomUUID()}`;
}

const basmatiRice = getAllProducts().find((p) => /basmati/i.test(p.name) && p.brand === "India Gate")!;
assert.ok(basmatiRice, "expected the India Gate Basmati Rice fixture product to exist in the catalog");
const unitPrice = effectivePrice(basmatiRice); // read dynamically from the mock catalog, never hardcoded

// TEST 1
test("TEST 1: 'How much is 2 kilos of basmati rice?' returns price info, does NOT call add_to_cart, cart unchanged", async () => {
  const customerId = uniqueCustomerId("t1");
  const { toolCalls, finalText } = await runTurn("How much is 2 kilos of basmati rice?", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products"]);
  assert.ok(!toolCalls.includes("add_to_cart"));
  assert.ok(!toolCalls.includes("check_inventory"));

  const expectedTotal = Math.round(unitPrice * 2 * 100) / 100;
  assert.match(finalText, new RegExp(String(unitPrice)), "response should state the real per-unit price");
  assert.match(finalText, new RegExp(String(expectedTotal)), "response should state the calculated total for 2 kg");

  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0, "cart must remain unchanged for a price question");
});

// TEST 2
test("TEST 2: 'What is the price of basmati rice?' returns catalog price, does not modify cart", async () => {
  const customerId = uniqueCustomerId("t2");
  const { toolCalls, finalText } = await runTurn("What is the price of basmati rice?", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products"]);
  assert.match(finalText, new RegExp(String(unitPrice)));

  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

// TEST 3
test("TEST 3: 'How much does 2 kg of basmati rice cost?' calculates from the real product unit/price, does not modify cart", async () => {
  const customerId = uniqueCustomerId("t3");
  const { toolCalls, finalText } = await runTurn("How much does 2 kg of basmati rice cost?", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products"]);
  const expectedTotal = Math.round(unitPrice * 2 * 100) / 100;
  assert.match(finalText, new RegExp(String(expectedTotal)));

  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

// TEST 4 — the actual purchase flow must be completely unaffected.
test("TEST 4: 'I need 2 kilos of basmati rice.' still searches, checks inventory, and adds to the cart", async () => {
  const customerId = uniqueCustomerId("t4");
  const { toolCalls } = await runTurn("I need 2 kilos of basmati rice.", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory", "add_to_cart"]);

  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.ok(item, "basmati rice should actually be in the cart for a real purchase request");
  assert.equal(item!.qty, 2);
});

// TEST 5
test("TEST 5: 'How many kilos of basmati rice are available?' checks real inventory, does not add to cart", async () => {
  const customerId = uniqueCustomerId("t5");
  const { toolCalls, finalText } = await runTurn("How many kilos of basmati rice are available?", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory"]);
  assert.ok(!toolCalls.includes("add_to_cart"));
  assert.match(finalText, new RegExp(String(basmatiRice.stock)), "response should state the real stock figure");

  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

// TEST 5b — regression: "Do I HAVE enough" (first person) was not recognized
// as an inventory question at all -- INVENTORY_QUERY_MARKERS only had "do
// YOU have", not "do I have" -- so it fell through to the purchase pipeline
// and was treated as an actual attempt to buy the stated quantity.
test("TEST 5b: 'Do I have enough basmati for 5000 kg?' is answered as an inventory question, never as a purchase attempt", async () => {
  const customerId = uniqueCustomerId("t5b");
  const { toolCalls, finalText } = await runTurn("Do I have enough basmati for 5000 kg?", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory"]);
  assert.ok(!toolCalls.includes("add_to_cart"), "an inventory question must never add to the cart");
  assert.match(finalText, new RegExp(String(basmatiRice.stock)), "response should state the real stock figure");

  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

// TEST 6 — multilingual price/inventory questions.
test("TEST 6a (Hindi): price question does not add to cart", async () => {
  const customerId = uniqueCustomerId("t6a");
  const { toolCalls } = await runTurn("बासमती चावल की कीमत क्या है?", "hi", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "a Hindi price question must not add to the cart");
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

test("TEST 6b (Tamil): price question does not add to cart", async () => {
  const customerId = uniqueCustomerId("t6b");
  const { toolCalls } = await runTurn("பாஸ்மதி அரிசி விலை என்ன?", "ta", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "a Tamil price question must not add to the cart");
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

test("TEST 6c (Telugu): price question does not add to cart", async () => {
  const customerId = uniqueCustomerId("t6c");
  const { toolCalls } = await runTurn("బాస్మతి బియ్యం ధర ఎంత?", "te", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "a Telugu price question must not add to the cart");
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

test("TEST 6d (Hindi): inventory question does not add to cart", async () => {
  const customerId = uniqueCustomerId("t6d");
  const { toolCalls } = await runTurn("बासमती चावल कितने किलो उपलब्ध हैं?", "hi", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "a Hindi inventory question must not add to the cart");
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

test("TEST 6e (Tamil): inventory question does not add to cart", async () => {
  const customerId = uniqueCustomerId("t6e");
  const { toolCalls } = await runTurn("பாஸ்மதி அரிசி எத்தனை கிலோ கையிருப்பில் உள்ளது?", "ta", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "a Tamil inventory question must not add to the cart");
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

test("TEST 6f (Telugu): inventory question does not add to cart", async () => {
  const customerId = uniqueCustomerId("t6f");
  const { toolCalls } = await runTurn("బాస్మతి బియ్యం ఎన్ని కిలోలు అందుబాటులో ఉన్నాయి?", "te", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "a Telugu inventory question must not add to the cart");
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

// Regression for the exact reported scenario: a price question asked AFTER
// the customer already has items in their cart must not add MORE to it.
test("regression: price question after a prior purchase does not add more to the cart", async () => {
  const customerId = uniqueCustomerId("regression-6x");
  await runTurn("I need 4 kilos of basmati rice.", "en", customerId);

  const cartAfterPurchase = cartService.getCart(customerId);
  const qtyAfterPurchase = cartAfterPurchase.items.find((i) => i.productId === basmatiRice.id)!.qty;
  assert.equal(qtyAfterPurchase, 4);

  const { toolCalls } = await runTurn("How much is 2 kilos of basmati rice?", "en", customerId);
  assert.ok(!toolCalls.includes("add_to_cart"), "the price question must not trigger another add_to_cart");

  const cartAfterQuestion = cartService.getCart(customerId);
  const qtyAfterQuestion = cartAfterQuestion.items.find((i) => i.productId === basmatiRice.id)!.qty;
  assert.equal(qtyAfterQuestion, 4, "cart quantity must be unchanged by the price question");
});

// Regression: when a genuine second purchase DOES happen, the "Added N x"
// wording must report what was just added, not the new cumulative total.
test("regression: a real second purchase reports the newly added quantity, not the cumulative cart total", async () => {
  const customerId = uniqueCustomerId("regression-wording");
  await runTurn("I need 4 kilos of basmati rice.", "en", customerId);
  const { finalText } = await runTurn("I need 2 more kilos of basmati rice.", "en", customerId);

  assert.match(finalText, /\b2\b/, "the confirmation should mention the 2 units just added");
  assert.doesNotMatch(finalText, /\b6\b/, "the confirmation should NOT report the cumulative cart total (6) as if it were just added");

  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id)!;
  assert.equal(item.qty, 6, "the cart itself should still correctly hold the cumulative total");
});
