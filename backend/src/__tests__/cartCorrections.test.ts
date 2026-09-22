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
 * Regression coverage for: "Actually make that 3 kilos" after already
 * having 2 in the cart re-triggered add_to_cart(3) instead of REPLACING the
 * quantity, producing 5 (or worse, repeated corrections compounding
 * further) instead of the intended 3. Fixed via a new, explicit
 * update_cart_quantity operation (see cartService.ts / toolExecutor.ts /
 * toolDefinitions.ts) with SET, not ADD, semantics, enforced authoritatively
 * against real stock regardless of what any AI layer requests.
 *
 * Same driver as mockAIProvider.test.ts: real MockAIProvider + real
 * toolExecutor + real cartService, no network/env dependency. Each
 * sequential `runTurn` call rebuilds the message history fresh (mirroring
 * exactly how aiService.sendMessage does it in production — only user/
 * assistant text persists across turns, not tool calls), while cart state
 * persists via the shared customerId, exactly as it does in production.
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
  return `test-correction-${label}-${crypto.randomUUID()}`;
}

const basmatiRice = getAllProducts().find((p) => /basmati/i.test(p.name) && p.brand === "India Gate")!;
assert.ok(basmatiRice, "expected the India Gate Basmati Rice fixture product to exist in the catalog");
const unitPrice = effectivePrice(basmatiRice);

function cartQty(customerId: string): number {
  const cart = cartService.getCart(customerId);
  return cart.items.find((i) => i.productId === basmatiRice.id)?.qty ?? 0;
}

// TEST 1
test("TEST 1: 'I need 2 kilos of basmati rice.' -> cart = 2", async () => {
  const customerId = uniqueCustomerId("t1");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  assert.equal(cartQty(customerId), 2);
});

// TEST 2 — the reported bug's exact shape.
test("TEST 2: 'Actually make that 3 kilos.' -> cart = 3 (not 5, not another 2 or 3)", async () => {
  const customerId = uniqueCustomerId("t2");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls, finalText } = await runTurn("Actually make that 3 kilos.", "en", customerId);

  assert.equal(cartQty(customerId), 3, "final cart quantity must be exactly 3");
  assert.ok(!toolCalls.includes("add_to_cart"), "a correction must never call add_to_cart");
  assert.ok(toolCalls.includes("update_cart_quantity"), "a correction must use update_cart_quantity");
  assert.match(finalText, /\b3\b/);
});

// TEST 2b — regression: "change the X to Y" (product restated, no "that"/"it"
// pronoun) was NOT recognized as a correction — detectUtteranceIntent had no
// marker for it, so it fell through to a fresh add_to_cart search for "rice",
// which is ambiguous in the catalog (Basmati/Sona Masoori/Brown/Idli) and
// wrongly asked the customer to disambiguate instead of updating the cart.
test("TEST 2b: 'Change the rice to 3 kilos.' -> cart = 3, not an ambiguous-product clarification", async () => {
  const customerId = uniqueCustomerId("t2b");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls, finalText } = await runTurn("Change the rice to 3 kilos.", "en", customerId);

  assert.equal(cartQty(customerId), 3, "final cart quantity must be exactly 3");
  assert.ok(!toolCalls.includes("add_to_cart"), "a correction must never call add_to_cart");
  assert.ok(toolCalls.includes("update_cart_quantity"), "a correction must use update_cart_quantity");
  assert.match(finalText, /\b3\b/);
});

// TEST 2c — regression: "change <product> to <amount>" with the product
// named directly (no "the"/"it"/"that") was ALSO not recognized as a
// correction -- CORRECTION_MARKERS only had "change the X to Y" (added for
// TEST 2b) and "change it/that to Y", missing the bare-noun form entirely.
// See CHANGE_TO_PATTERN in queryNormalization.ts.
test("TEST 2c: 'Change rice to 3 kilos.' (no \"the\") -> cart = 3, not an ambiguous-product clarification", async () => {
  const customerId = uniqueCustomerId("t2c");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls, finalText } = await runTurn("Change rice to 3 kilos.", "en", customerId);

  assert.equal(cartQty(customerId), 3, "final cart quantity must be exactly 3");
  assert.ok(!toolCalls.includes("add_to_cart"), "a correction must never call add_to_cart");
  assert.ok(toolCalls.includes("update_cart_quantity"), "a correction must use update_cart_quantity");
  assert.match(finalText, /\b3\b/);
});

// TEST 3
test("TEST 3: 'Actually make that 5 kilos.' -> cart = 5", async () => {
  const customerId = uniqueCustomerId("t3");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  const { toolCalls } = await runTurn("Actually make that 5 kilos.", "en", customerId);

  assert.equal(cartQty(customerId), 5);
  assert.ok(!toolCalls.includes("add_to_cart"));
});

// TEST 4 — boundary computed from REAL stock, never hardcoded.
test("TEST 4: correcting to stock+1 is rejected; cart remains at the previous quantity", async () => {
  const customerId = uniqueCustomerId("t4");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  assert.equal(cartQty(customerId), 2);

  const tooMany = basmatiRice.stock + 1;
  const { toolCalls, finalText } = await runTurn(`Actually make that ${tooMany} kilos.`, "en", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "rejected correction must never fall back to add_to_cart");
  assert.match(finalText, new RegExp(String(basmatiRice.stock)), "response should state the real available quantity");
  assert.equal(cartQty(customerId), 2, "cart must remain at the previous quantity after a rejected correction");
});

// TEST 5 — a wildly excessive correction.
test("TEST 5: 'Actually make that 1000 kilos.' is rejected; cart unchanged", async () => {
  const customerId = uniqueCustomerId("t5");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  const { toolCalls } = await runTurn("Actually make that 1000 kilos.", "en", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"));
  assert.equal(cartQty(customerId), 2);
});

// TEST 6 — a genuine additional purchase is NOT a correction.
test("TEST 6: 'I also need 3 kilos of basmati rice.' adds 3 MORE (cart increases by 3)", async () => {
  const customerId = uniqueCustomerId("t6");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls } = await runTurn("I also need 3 kilos of basmati rice.", "en", customerId);

  assert.deepEqual(toolCalls, ["search_products", "check_inventory", "add_to_cart"]);
  assert.equal(cartQty(customerId), 5, "an explicit additional purchase must ADD, ending at 2 + 3 = 5");
});

// TEST 7 — existing remove behavior must still work end-to-end via the AI layer.
test("TEST 7: 'Remove basmati rice.' removes the item from the cart", async () => {
  const customerId = uniqueCustomerId("t7");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls } = await runTurn("Remove basmati rice.", "en", customerId);

  assert.ok(toolCalls.includes("remove_from_cart"));
  assert.ok(!toolCalls.includes("add_to_cart") && !toolCalls.includes("update_cart_quantity"));
  assert.equal(cartQty(customerId), 0);
});

// TEST 8 — price questions must never modify the cart, even mid-conversation.
test("TEST 8: a price question after a purchase does not modify the cart", async () => {
  const customerId = uniqueCustomerId("t8");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls } = await runTurn("How much is 3 kilos of basmati rice?", "en", customerId);

  assert.ok(!toolCalls.includes("add_to_cart") && !toolCalls.includes("update_cart_quantity"));
  assert.equal(cartQty(customerId), 2, "a price question must not change the existing cart quantity");
});

// TEST 9 — inventory questions must never modify the cart.
test("TEST 9: an inventory question after a purchase does not modify the cart", async () => {
  const customerId = uniqueCustomerId("t9");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  const { toolCalls } = await runTurn("How many kilos are available?", "en", customerId);

  assert.ok(!toolCalls.includes("add_to_cart") && !toolCalls.includes("update_cart_quantity"));
  assert.equal(cartQty(customerId), 2);
});

// TEST 10 — multilingual quantity corrections, where practical.
test("TEST 10a (Hindi): correction updates cart to the exact final quantity", async () => {
  const customerId = uniqueCustomerId("t10a");
  await runTurn("मुझे दो किलो बासमती चावल चाहिए", "hi", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls } = await runTurn("असल में इसे 3 किलो कर दो", "hi", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "Hindi correction must not call add_to_cart");
  assert.equal(cartQty(customerId), 3);
});

test("TEST 10b (Tamil): correction updates cart to the exact final quantity", async () => {
  const customerId = uniqueCustomerId("t10b");
  await runTurn("எனக்கு இரண்டு கிலோ பாஸ்மதி அரிசி வேண்டும்", "ta", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls } = await runTurn("உண்மையில் அதை 3 கிலோ ஆக மாற்று", "ta", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "Tamil correction must not call add_to_cart");
  assert.equal(cartQty(customerId), 3);
});

test("TEST 10c (Telugu): correction updates cart to the exact final quantity", async () => {
  const customerId = uniqueCustomerId("t10c");
  await runTurn("నాకు రెండు కిలోల బాస్మతి బియ్యం కావాలి", "te", customerId);
  assert.equal(cartQty(customerId), 2);

  const { toolCalls } = await runTurn("నిజానికి దాన్ని 3 కిలోలకి మార్చు", "te", customerId);

  assert.ok(!toolCalls.includes("add_to_cart"), "Telugu correction must not call add_to_cart");
  assert.equal(cartQty(customerId), 3);
});

// Extra: price/lineTotal on the corrected cart line must come from the real
// catalog price, never from the model.
test("BUG price safety: after correcting 2kg -> 3kg, the cart total is computed from the real product price", async () => {
  const customerId = uniqueCustomerId("price-safety");
  await runTurn("I need 2 kilos of basmati rice.", "en", customerId);
  await runTurn("Actually make that 3 kilos.", "en", customerId);

  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id)!;
  assert.equal(item.unitPrice, unitPrice);
  assert.equal(item.lineTotal, Math.round(unitPrice * 3 * 100) / 100);
});

// Direct service-layer proof that update_cart_quantity enforces
// 0 <= quantity <= stock authoritatively, independent of any AI layer.
test("cartService.updateCartQuantity: 0 <= quantity <= stock is enforced directly, bypassing any AI layer", () => {
  const customerId = uniqueCustomerId("direct-service");

  const setTo3 = cartService.updateCartQuantity(customerId, basmatiRice.id, 3);
  assert.equal(setTo3.ok, true);
  if (setTo3.ok) assert.equal(setTo3.cart.items.find((i) => i.productId === basmatiRice.id)?.qty, 3);

  const setToStock = cartService.updateCartQuantity(customerId, basmatiRice.id, basmatiRice.stock);
  assert.equal(setToStock.ok, true, "setting to exactly the real stock must be allowed");

  const setOverStock = cartService.updateCartQuantity(customerId, basmatiRice.id, basmatiRice.stock + 1);
  assert.equal(setOverStock.ok, false);
  if (!setOverStock.ok) {
    assert.equal(setOverStock.error, "INSUFFICIENT_STOCK");
    assert.equal(setOverStock.stock, basmatiRice.stock);
  }

  // Rejected update must leave the cart at its last valid state (== stock).
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.find((i) => i.productId === basmatiRice.id)?.qty, basmatiRice.stock);

  const setToZero = cartService.updateCartQuantity(customerId, basmatiRice.id, 0);
  assert.equal(setToZero.ok, true);
  if (setToZero.ok) assert.equal(setToZero.cart.items.find((i) => i.productId === basmatiRice.id), undefined, "quantity 0 removes the line");
});
