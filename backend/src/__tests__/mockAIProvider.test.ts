import { test } from "node:test";
import assert from "node:assert/strict";
import { MockAIProvider } from "../providers/ai/MockAIProvider.js";
import { executeTool } from "../tools/toolExecutor.js";
import * as cartService from "../services/cartService.js";
import { getAllProducts } from "../data/products.js";
import { AIMessage } from "../providers/ai/AIProvider.js";
import { SupportedLanguageCode } from "../types/language.js";

/**
 * Drives one full user turn through MockAIProvider exactly the way
 * aiService.sendMessage does (see backend/src/services/aiService.ts): call
 * the provider, execute any requested tool calls for real (the actual
 * toolExecutor -> productService/cartService, not a mock), feed results
 * back, repeat until the provider stops. This is a true integration test of
 * "one AI brain" driving real business logic, without depending on
 * environment configuration (no OPENAI_API_KEY needed or used).
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
  return `test-mock-${label}-${crypto.randomUUID()}`;
}

const basmatiRice = getAllProducts().find((p) => /basmati/i.test(p.name) && p.brand === "India Gate")!;
assert.ok(basmatiRice, "expected the India Gate Basmati Rice fixture product to exist in the catalog");

// TEST 1 — English words
test("TEST 1: English 'I need two kilos of basmati rice' -> search -> check_inventory -> add_to_cart", async () => {
  const customerId = uniqueCustomerId("t1");
  const { toolCalls } = await runTurn("I need two kilos of basmati rice.", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory", "add_to_cart"]);
  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.ok(item, "basmati rice should be in the cart");
  assert.equal(item!.qty, 2);
});

// TEST 2 — English numeric digit
test("TEST 2: English '2 kg of basmati rice' -> search -> check_inventory -> add_to_cart", async () => {
  const customerId = uniqueCustomerId("t2");
  const { toolCalls } = await runTurn("I need 2 kg of basmati rice.", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory", "add_to_cart"]);
  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.equal(item!.qty, 2);
});

// TEST 3 — insufficient stock, computed from REAL stock (never hardcoded)
test("TEST 3: requesting more than real stock -> search -> check_inventory -> NO add_to_cart", async () => {
  const customerId = uniqueCustomerId("t3");
  const tooMany = basmatiRice.stock + 1;
  const { toolCalls, finalText } = await runTurn(`I need ${tooMany} kilos of basmati rice.`, "en", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory"], "add_to_cart must NOT be called");
  assert.match(finalText, new RegExp(String(basmatiRice.stock)), "response should state the real available quantity");

  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0, "nothing should have been added to the cart");
});

// TEST 4 — Hindi
test("TEST 4: Hindi 'मुझे दो किलो बासमती चावल चाहिए' -> quantity 2, basmati rice, same tool flow", async () => {
  const customerId = uniqueCustomerId("t4");
  const { toolCalls } = await runTurn("मुझे दो किलो बासमती चावल चाहिए", "hi", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory", "add_to_cart"]);
  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.ok(item, "basmati rice should be in the cart");
  assert.equal(item!.qty, 2);
});

test("TEST 4b (reported bug phrase): Hindi code-switched 'मुझे दो किलो बासमती राइस दे दो'", async () => {
  const customerId = uniqueCustomerId("t4b");
  const { toolCalls } = await runTurn("मुझे दो किलो बासमती राइस दे दो", "hi", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory", "add_to_cart"]);
  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.ok(item, "basmati rice should be in the cart even for the exact reported bug phrase");
  assert.equal(item!.qty, 2, "quantity must be 2, not confused by 'दे दो'");
});

// TEST 5 — Tamil
test("TEST 5: Tamil 'எனக்கு இரண்டு கிலோ பாஸ்மதி அரிசி வேண்டும்' -> quantity 2, basmati rice", async () => {
  const customerId = uniqueCustomerId("t5");
  const { toolCalls } = await runTurn("எனக்கு இரண்டு கிலோ பாஸ்மதி அரிசி வேண்டும்", "ta", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory", "add_to_cart"]);
  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.ok(item, "basmati rice should be in the cart");
  assert.equal(item!.qty, 2);
});

// TEST 6 — Telugu
test("TEST 6: Telugu 'నాకు రెండు కిలోల బాస్మతి బియ్యం కావాలి' -> quantity 2, basmati rice", async () => {
  const customerId = uniqueCustomerId("t6");
  const { toolCalls } = await runTurn("నాకు రెండు కిలోల బాస్మతి బియ్యం కావాలి", "te", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory", "add_to_cart"]);
  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.ok(item, "basmati rice should be in the cart");
  assert.equal(item!.qty, 2);
});

// TEST 7 — product genuinely not in the catalog.
// Note: the ticket's literal example "XYZ rice" is NOT used here, because
// "rice" alone legitimately matches real rice products via OR-token
// matching (see productService.searchProducts) — that's correct, desired
// behavior, not a bug. "unicorn dust" shares no token with any catalog
// product/brand/category/description, which is what actually exercises the
// not-found path this test is meant to verify.
test("TEST 7: product not found ('unicorn dust') -> search_products only, NO add_to_cart", async () => {
  const customerId = uniqueCustomerId("t7");
  const { toolCalls } = await runTurn("I need 2 kg of unicorn dust.", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products"]);
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

// BUG 5 — output language always follows the selected/system-prompt
// language, independent of the script the customer actually spoke in.
test("BUG 5: language consistency — Hindi input still gets an English reply when language='en' is selected", async () => {
  const customerId = uniqueCustomerId("lang-consistency");
  const { finalText } = await runTurn("मुझे दो किलो बासमती चावल चाहिए", "en", customerId);

  // English PHRASES.addedToCart template always reads "Added N x ... to your cart".
  assert.match(finalText, /Added \d+ x/);
});

// Regression: multi-turn conversation on the same cart still works.
test("regression: multi-turn conversation accumulates on the same cart", async () => {
  const customerId = uniqueCustomerId("multiturn");
  await runTurn("I need one kilo of basmati rice.", "en", customerId);
  await runTurn("add one litre of sunflower oil", "en", customerId);

  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 2);
});
