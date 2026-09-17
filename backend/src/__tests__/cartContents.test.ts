import { test } from "node:test";
import assert from "node:assert/strict";
import { sendMessage } from "../services/aiService.js";
import * as cartService from "../services/cartService.js";
import { getAllProducts } from "../data/products.js";
import { effectivePrice } from "../types/product.js";

/**
 * Regression coverage for: a cart-content question ("what's in my cart?")
 * was answered with only "Your cart has 2 item(s), subtotal ₹914.8." even
 * though get_cart's tool result already contains the full item list
 * (product name, brand, qty, unitPrice, lineTotal — see cartService.ts /
 * toolExecutor.ts, both unchanged). The bug was purely in how the response
 * text was built from that data: MockAIProvider.cartSummary only rendered
 * count + subtotal, ignoring `data.items`. Fixed by making cartSummary
 * (localization.ts) render one line per item via the new cartItemLine
 * template, and by broadening cart-question detection
 * (queryNormalization.ts detectUtteranceIntent -> "cart_query") to catch
 * phrasings that don't literally say "my cart" (e.g. "what did I add?").
 *
 * Drives the real aiService.sendMessage() end-to-end (same session reused
 * across turns), exactly like conversationContext.test.ts.
 */

function uniqueSessionId(label: string): string {
  return `test-cartcontents-${label}-${crypto.randomUUID()}`;
}

const basmatiRice = getAllProducts().find((p) => /basmati/i.test(p.name) && p.brand === "India Gate")!;
const sunflowerOil = getAllProducts().find((p) => p.name === "Sunflower Oil")!;
assert.ok(basmatiRice && sunflowerOil, "expected fixture products to exist in the catalog");

async function addBasmatiAndOil(sessionId: string): Promise<void> {
  await sendMessage(sessionId, "Add 2 kg basmati rice.", "en");
  await sendMessage(sessionId, "Also add 2 litres sunflower oil.", "en");
}

// --- 1: "What's in my cart?" lists actual items ---
test("1: 'What's in my cart?' lists the actual product names", async () => {
  const sessionId = uniqueSessionId("1");
  await addBasmatiAndOil(sessionId);

  const { reply, toolCalls } = await sendMessage(sessionId, "What's in my cart?", "en");
  assert.ok(toolCalls.some((t) => t.tool === "get_cart"));
  assert.match(reply, /basmati/i);
  assert.match(reply, /sunflower/i);
  assert.doesNotMatch(reply, /^Your cart has \d+ item\(s\), subtotal/, "must not fall back to the old count-only summary");
});

// --- 2: "What are the items in my cart?" lists actual items ---
test("2: 'What are the items in my cart?' lists the actual product names", async () => {
  const sessionId = uniqueSessionId("2");
  await addBasmatiAndOil(sessionId);

  const { reply } = await sendMessage(sessionId, "What are the items in my cart?", "en");
  assert.match(reply, /basmati/i);
  assert.match(reply, /sunflower/i);
});

// --- 3: "Tell me what I added." lists actual items (no literal "cart" in the phrase) ---
test("3: 'Tell me what I added.' is recognized as a cart question and lists items", async () => {
  const sessionId = uniqueSessionId("3");
  await addBasmatiAndOil(sessionId);

  const { reply, toolCalls } = await sendMessage(sessionId, "Tell me what I added.", "en");
  assert.ok(toolCalls.some((t) => t.tool === "get_cart"));
  assert.match(reply, /basmati/i);
  assert.match(reply, /sunflower/i);
});

// --- 4: empty cart is reported clearly, not as a fabricated item list ---
test("4: 'What's in my cart?' with an empty cart clearly says it's empty", async () => {
  const sessionId = uniqueSessionId("4");
  const { reply } = await sendMessage(sessionId, "What's in my cart?", "en");
  assert.match(reply, /empty/i);
});

// --- 5: multiple products are ALL listed, not just the first/last ---
test("5: a cart with two products lists BOTH of them", async () => {
  const sessionId = uniqueSessionId("5");
  await addBasmatiAndOil(sessionId);

  const { reply } = await sendMessage(sessionId, "Show me my cart.", "en");
  assert.match(reply, /basmati/i);
  assert.match(reply, /sunflower/i);
});

// --- 6: quantities and units in the response match the real cart line items ---
test("6: the response states the correct quantity for each item", async () => {
  const sessionId = uniqueSessionId("6");
  await addBasmatiAndOil(sessionId);

  const { reply } = await sendMessage(sessionId, "What products do I have?", "en");
  assert.match(reply, /2 kilos of .*basmati/i);
  assert.match(reply, /2 litres of .*sunflower/i);
});

// --- 7: prices in the response come from the real cart data, never invented ---
test("7: item prices in the response come from the real cart line totals", async () => {
  const sessionId = uniqueSessionId("7");
  await addBasmatiAndOil(sessionId);

  const cart = cartService.getCart(sessionId);
  const riceLine = cart.items.find((i) => i.productId === basmatiRice.id)!;
  const oilLine = cart.items.find((i) => i.productId === sunflowerOil.id)!;
  assert.equal(riceLine.unitPrice, effectivePrice(basmatiRice));
  assert.equal(oilLine.unitPrice, effectivePrice(sunflowerOil));

  const { reply } = await sendMessage(sessionId, "What's in my cart?", "en");
  assert.match(reply, new RegExp(String(riceLine.lineTotal)));
  assert.match(reply, new RegExp(String(oilLine.lineTotal)));
  assert.match(reply, new RegExp(String(cart.subtotal)));
});

// --- 8: a follow-up question about the just-listed cart still uses real data ---
test("8: after listing the cart, a follow-up quantity question uses the actual cart contents", async () => {
  const sessionId = uniqueSessionId("8");
  await addBasmatiAndOil(sessionId);

  const listStep = await sendMessage(sessionId, "What's in my cart?", "en");
  assert.match(listStep.reply, /basmati/i);

  const followUp = await sendMessage(sessionId, "How many kilos of rice did I add?", "en");
  assert.match(followUp.reply, /\b2\b/);
  // Must not have mutated the cart just by asking about it.
  assert.equal(cartService.getCart(sessionId).items.find((i) => i.productId === basmatiRice.id)?.qty, 2);
});

// --- 9: multilingual basic cart-content requests ---
test("9a (English): cart-content request lists items", async () => {
  const sessionId = uniqueSessionId("9a");
  await addBasmatiAndOil(sessionId);
  const { reply } = await sendMessage(sessionId, "What's in my cart?", "en");
  assert.match(reply, /basmati/i);
});

test("9b (Hindi): cart-content request lists items", async () => {
  const sessionId = uniqueSessionId("9b");
  await addBasmatiAndOil(sessionId);
  const { reply, toolCalls } = await sendMessage(sessionId, "मेरे कार्ट में क्या है?", "hi");
  assert.ok(toolCalls.some((t) => t.tool === "get_cart"));
  assert.match(reply, /basmati/i);
});

test("9c (Tamil): cart-content request lists items", async () => {
  const sessionId = uniqueSessionId("9c");
  await addBasmatiAndOil(sessionId);
  const { reply, toolCalls } = await sendMessage(sessionId, "என் கார்ட்டில் என்ன இருக்கிறது?", "ta");
  assert.ok(toolCalls.some((t) => t.tool === "get_cart"));
  assert.match(reply, /basmati/i);
});

test("9d (Telugu): cart-content request lists items", async () => {
  const sessionId = uniqueSessionId("9d");
  await addBasmatiAndOil(sessionId);
  const { reply, toolCalls } = await sendMessage(sessionId, "నా కార్ట్‌లో ఏముంది?", "te");
  assert.ok(toolCalls.some((t) => t.tool === "get_cart"));
  assert.match(reply, /basmati/i);
});

// --- 10: the full target conversation (from the multi-turn feature) still works ---
test("10: full target conversation still works after the cart-listing fix", async () => {
  const sessionId = uniqueSessionId("10");

  await sendMessage(sessionId, "I need to order some rice.", "en");
  await sendMessage(sessionId, "Basmati.", "en");
  await sendMessage(sessionId, "2 kilos.", "en");
  assert.equal(cartService.getCart(sessionId).items.find((i) => i.productId === basmatiRice.id)?.qty, 2);

  await sendMessage(sessionId, "Also add oil.", "en");
  await sendMessage(sessionId, "Sunflower.", "en");
  await sendMessage(sessionId, "Two litres.", "en");
  assert.equal(cartService.getCart(sessionId).items.find((i) => i.productId === sunflowerOil.id)?.qty, 2);

  const cartReply = await sendMessage(sessionId, "What's in my cart?", "en");
  assert.match(cartReply.reply, /basmati/i);
  assert.match(cartReply.reply, /sunflower/i);

  await sendMessage(sessionId, "Actually make the rice 3 kilos.", "en");
  assert.equal(cartService.getCart(sessionId).items.find((i) => i.productId === basmatiRice.id)?.qty, 3);
  assert.equal(cartService.getCart(sessionId).items.find((i) => i.productId === sunflowerOil.id)?.qty, 2, "correcting the rice must not touch the oil");
});

// --- Bug-exact regression: the literal reported phrase must also list items ---
test("bug-exact: 'Need to know what are the items are there in my cart.' lists items, not just count/subtotal", async () => {
  const sessionId = uniqueSessionId("exact");
  await addBasmatiAndOil(sessionId);

  const { reply, toolCalls } = await sendMessage(sessionId, "Need to know what are the items are there in my cart.", "en");
  assert.ok(toolCalls.some((t) => t.tool === "get_cart"));
  assert.match(reply, /basmati/i);
  assert.match(reply, /sunflower/i);
});
