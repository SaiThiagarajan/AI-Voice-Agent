import { test } from "node:test";
import assert from "node:assert/strict";
import { sendMessage } from "../services/aiService.js";
import * as cartService from "../services/cartService.js";
import { getAllProducts } from "../data/products.js";

/**
 * Multi-turn conversational intelligence coverage. Unlike the other test
 * files (which drive MockAIProvider + toolExecutor directly, rebuilding
 * message history fresh per call), these tests drive the REAL
 * aiService.sendMessage() end-to-end, reusing the SAME sessionId across
 * turns — this is the only way to exercise genuine cross-turn behavior
 * (a clarifying question asked in turn N being answered in turn N+1), since
 * that requires the actual persisted ConversationSession (messages +
 * context), not just a rebuilt-per-call message array.
 *
 * Scenarios A-P below correspond to the required test matrix: ambiguous
 * product, product-then-quantity, "also add", follow-up quantity,
 * correction, remove-by-reference, cart query, yes/no confirmation,
 * multiple products in one message, price/inventory questions, product not
 * found, insufficient stock, session isolation, and basic multilingual
 * context.
 */

function uniqueSessionId(label: string): string {
  return `test-context-${label}-${crypto.randomUUID()}`;
}

const basmatiRice = getAllProducts().find((p) => /basmati/i.test(p.name) && p.brand === "India Gate")!;
const sunflowerOil = getAllProducts().find((p) => p.name === "Sunflower Oil")!;
const onion = getAllProducts().find((p) => p.name === "Onion")!;
const tomato = getAllProducts().find((p) => p.name === "Tomato")!;
const mango = getAllProducts().find((p) => p.name === "Alphonso Mango")!;
assert.ok(basmatiRice && sunflowerOil && onion && tomato && mango, "expected fixture products to exist in the catalog");

function qtyOf(sessionId: string, productId: string): number {
  return cartService.getCart(sessionId).items.find((i) => i.productId === productId)?.qty ?? 0;
}

// --- A: ambiguous product request -> clarification, never a guess ---
test("A: 'I want rice' is ambiguous -> asks which one, does not add anything", async () => {
  const sessionId = uniqueSessionId("a");
  const { reply, toolCalls } = await sendMessage(sessionId, "I want rice.", "en");

  assert.ok(!toolCalls.some((t) => t.tool === "add_to_cart"), "must never guess which rice to add");
  assert.match(reply, /basmati/i);
  assert.match(reply, /sona masoori/i);
  assert.equal(cartService.getCart(sessionId).items.length, 0);
});

// --- B: product mentioned, then quantity resolved in a later turn ---
test("B: 'I want rice' -> 'basmati' -> '2 kilos' resolves to 2kg India Gate Basmati Rice", async () => {
  const sessionId = uniqueSessionId("b");
  await sendMessage(sessionId, "I want rice.", "en");

  const step2 = await sendMessage(sessionId, "Basmati.", "en");
  assert.ok(!step2.toolCalls.some((t) => t.tool === "add_to_cart"), "product resolved but quantity still unknown -- must not add yet");
  assert.match(step2.reply, /how many|how much/i);

  const step3 = await sendMessage(sessionId, "2 kilos.", "en");
  assert.ok(step3.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.equal(qtyOf(sessionId, basmatiRice.id), 2);
});

// --- C: "also add" is a new addition, not a correction ---
test("C: after adding rice, 'Also add oil' -> 'sunflower' -> 'two litres' adds oil WITHOUT touching the rice", async () => {
  const sessionId = uniqueSessionId("c");
  await sendMessage(sessionId, "I want rice.", "en");
  await sendMessage(sessionId, "Basmati.", "en");
  await sendMessage(sessionId, "2 kilos.", "en");
  assert.equal(qtyOf(sessionId, basmatiRice.id), 2);

  const step1 = await sendMessage(sessionId, "Also add oil.", "en");
  assert.ok(!step1.toolCalls.some((t) => t.tool === "update_cart_quantity"), "additive request must never be treated as a correction");
  assert.match(step1.reply, /sunflower/i);

  await sendMessage(sessionId, "Sunflower.", "en");
  const step3 = await sendMessage(sessionId, "Two litres.", "en");
  assert.ok(step3.toolCalls.some((t) => t.tool === "add_to_cart"));

  assert.equal(qtyOf(sessionId, basmatiRice.id), 2, "the rice already in the cart must be untouched by adding oil");
  assert.equal(qtyOf(sessionId, sunflowerOil.id), 2);
});

// --- D: a follow-up quantity binds to the product just discussed, even without prior ambiguity ---
test("D: 'I want sunflower oil' (unambiguous, no qty) -> '2 litres' adds 2 without re-asking the product", async () => {
  const sessionId = uniqueSessionId("d");
  const step1 = await sendMessage(sessionId, "I want sunflower oil.", "en");
  assert.ok(!step1.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.match(step1.reply, /how many|how much/i);

  const step2 = await sendMessage(sessionId, "2 litres.", "en");
  assert.ok(step2.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.equal(qtyOf(sessionId, sunflowerOil.id), 2);
});

// --- E: correction to a quantity already discussed ---
test("E: 'I need 2 kilos of basmati rice' -> 'Actually make that 3 kilos' -> cart = 3, not 5", async () => {
  const sessionId = uniqueSessionId("e");
  await sendMessage(sessionId, "I need 2 kilos of basmati rice.", "en");
  assert.equal(qtyOf(sessionId, basmatiRice.id), 2);

  const step2 = await sendMessage(sessionId, "Actually make that 3 kilos.", "en");
  assert.ok(!step2.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.ok(step2.toolCalls.some((t) => t.tool === "update_cart_quantity"));
  assert.equal(qtyOf(sessionId, basmatiRice.id), 3);
});

// --- E2: the same correction, but referring to the item generically ("the rice"), resolved via the cart ---
test("E2: 'Actually make the rice 3 kilos' resolves against what's actually in the cart", async () => {
  const sessionId = uniqueSessionId("e2");
  await sendMessage(sessionId, "I need 2 kilos of basmati rice.", "en");

  const step2 = await sendMessage(sessionId, "Actually make the rice 3 kilos.", "en");
  assert.ok(!step2.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.equal(qtyOf(sessionId, basmatiRice.id), 3);
});

// --- F: contextual removal ("remove that") resolved via the most recently discussed item ---
test("F: 'I need 2 kilos of basmati rice' -> 'Remove that' -> cart is empty", async () => {
  const sessionId = uniqueSessionId("f");
  await sendMessage(sessionId, "I need 2 kilos of basmati rice.", "en");
  assert.equal(qtyOf(sessionId, basmatiRice.id), 2);

  const step2 = await sendMessage(sessionId, "Remove that.", "en");
  assert.ok(step2.toolCalls.some((t) => t.tool === "remove_from_cart"));
  assert.equal(qtyOf(sessionId, basmatiRice.id), 0);
});

// --- G: cart questions are always answered from the real cart, never invented ---
test("G: 'What's in my cart?' reports the ACTUAL cart contents", async () => {
  const sessionId = uniqueSessionId("g");
  await sendMessage(sessionId, "I need 2 kilos of basmati rice.", "en");
  await sendMessage(sessionId, "Add one litre of sunflower oil.", "en");

  const { reply, toolCalls } = await sendMessage(sessionId, "What's in my cart?", "en");
  assert.ok(toolCalls.some((t) => t.tool === "get_cart"));
  assert.match(reply, /2/);
});

// --- H: yes confirms a proposed reduced quantity after insufficient stock ---
test("H: insufficient stock offers the real available quantity; 'Yes' adds exactly that many", async () => {
  const sessionId = uniqueSessionId("h");
  const tooMany = mango.stock + 50;
  const step1 = await sendMessage(sessionId, `I need ${tooMany} kilos of Alphonso mango.`, "en");
  assert.ok(!step1.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.match(step1.reply, new RegExp(String(mango.stock)));
  assert.equal(qtyOf(sessionId, mango.id), 0);

  const step2 = await sendMessage(sessionId, "Yes.", "en");
  assert.ok(step2.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.equal(qtyOf(sessionId, mango.id), mango.stock);
});

// --- I: no cancels the proposed action, cart stays untouched ---
test("I: insufficient stock offer -> 'No' -> nothing is added, no arbitrary tool call", async () => {
  const sessionId = uniqueSessionId("i");
  const tooMany = mango.stock + 50;
  await sendMessage(sessionId, `I need ${tooMany} kilos of Alphonso mango.`, "en");

  const step2 = await sendMessage(sessionId, "No, thanks.", "en");
  assert.ok(!step2.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.equal(qtyOf(sessionId, mango.id), 0);
});

// --- I2: a bare yes/no with nothing pending must never trigger an arbitrary tool call ---
test("I2: a bare 'yes' with no pending action does not call any cart-mutating tool", async () => {
  const sessionId = uniqueSessionId("i2");
  const { toolCalls } = await sendMessage(sessionId, "Yes.", "en");
  assert.ok(!toolCalls.some((t) => t.tool === "add_to_cart" || t.tool === "update_cart_quantity" || t.tool === "remove_from_cart"));
});

// --- J: multiple products in one message, handled individually ---
test("J: 'I need 1 kg of onion and 1 kg of tomato' adds BOTH, independently", async () => {
  const sessionId = uniqueSessionId("j");
  const { toolCalls } = await sendMessage(sessionId, "I need 1 kg of onion and 1 kg of tomato.", "en");

  assert.equal(toolCalls.filter((t) => t.tool === "add_to_cart").length, 2);
  assert.equal(qtyOf(sessionId, onion.id), 1);
  assert.equal(qtyOf(sessionId, tomato.id), 1);
});

// --- K: a price question mid-conversation is answered as a question, cart/context untouched ---
test("K: a price question does not disturb a pending clarification", async () => {
  const sessionId = uniqueSessionId("k");
  await sendMessage(sessionId, "I want rice.", "en"); // sets a pending clarification (ambiguous)

  const priceStep = await sendMessage(sessionId, "How much is basmati rice?", "en");
  assert.ok(!priceStep.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.match(priceStep.reply, /₹/);

  // The original clarification should still be answerable afterwards.
  const resume = await sendMessage(sessionId, "Basmati.", "en");
  assert.match(resume.reply, /how many|how much/i);
});

// --- L: an inventory question does not disturb a pending clarification ---
test("L: an inventory question does not disturb a pending clarification", async () => {
  const sessionId = uniqueSessionId("l");
  await sendMessage(sessionId, "I want oil.", "en");

  const invStep = await sendMessage(sessionId, "Is sunflower oil in stock?", "en");
  assert.ok(!invStep.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.match(invStep.reply, new RegExp(String(sunflowerOil.stock)));
});

// --- M: product genuinely not in the catalog ---
test("M: 'I want quinoa' -> not found, no clarification loop started", async () => {
  const sessionId = uniqueSessionId("m");
  const { reply, toolCalls } = await sendMessage(sessionId, "I want 2 kg of quinoa.", "en");
  assert.ok(!toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.match(reply, /couldn't find|not available/i);
});

// --- N: insufficient stock on a fresh purchase never adds anything ---
test("N: requesting more than real stock never adds to the cart", async () => {
  const sessionId = uniqueSessionId("n");
  const tooMany = basmatiRice.stock + 1;
  const { toolCalls } = await sendMessage(sessionId, `I need ${tooMany} kilos of basmati rice.`, "en");
  assert.ok(!toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.equal(qtyOf(sessionId, basmatiRice.id), 0);
});

// --- O: no cross-session/customer context leakage ---
test("O: a pending clarification in one session is invisible to a different session", async () => {
  const sessionA = uniqueSessionId("o-a");
  const sessionB = uniqueSessionId("o-b");

  await sendMessage(sessionA, "I want rice.", "en"); // session A now has a pending "which rice" clarification

  const replyB = await sendMessage(sessionB, "2 kilos.", "en");
  assert.ok(!replyB.toolCalls.some((t) => t.tool === "add_to_cart"), "session B must not inherit session A's pending clarification");
  assert.equal(qtyOf(sessionB, basmatiRice.id), 0);
  assert.equal(cartService.getCart(sessionA).items.length, 0, "session A's cart must also be untouched by session B's message");
});

// --- P: basic multilingual context (Hindi) ---
test("P: Hindi — ambiguous product clarification and quantity follow-up carry across turns", async () => {
  const sessionId = uniqueSessionId("p");
  const step1 = await sendMessage(sessionId, "मुझे चावल चाहिए।", "hi");
  assert.ok(!step1.toolCalls.some((t) => t.tool === "add_to_cart"));

  const step2 = await sendMessage(sessionId, "बासमती।", "hi");
  assert.ok(!step2.toolCalls.some((t) => t.tool === "add_to_cart"), "product resolved but quantity still unknown");

  const step3 = await sendMessage(sessionId, "2 किलो।", "hi");
  assert.ok(step3.toolCalls.some((t) => t.tool === "add_to_cart"));
  assert.equal(qtyOf(sessionId, basmatiRice.id), 2);
});

// --- Q: an unrelated command abandons a stale insufficient-stock confirmation ---
// Regression for a real bug: an insufficient-stock offer sets
// pendingConfirmation (H/I above). If the customer's NEXT message is neither
// yes nor no but a completely different command ("checkout"), the offer must
// be abandoned rather than left pending. Previously it stayed in
// session.context and, once create_order actually ran later in that same
// turn's tool loop, MockAIProvider misread create_order's result as the
// stale confirmation's own check_inventory result -- reporting a nonsensical
// "only 0 available" instead of the order that had just genuinely been
// placed. See isConfirmationContinuation in MockAIProvider.ts.
test("Q: 'checkout' after an unanswered insufficient-stock offer places the real order, not a stale confirmation error", async () => {
  const sessionId = uniqueSessionId("q");

  // A real purchase actually in the cart.
  await sendMessage(sessionId, "I need 2 kilos of basmati rice.", "en");
  assert.equal(qtyOf(sessionId, basmatiRice.id), 2);

  // Triggers an insufficient-stock offer (pendingConfirmation), never
  // answered yes/no.
  const tooMany = basmatiRice.stock + 50;
  const offerStep = await sendMessage(sessionId, `I need ${tooMany} kilos of basmati rice.`, "en");
  assert.ok(!offerStep.toolCalls.some((t) => t.tool === "add_to_cart"), "an over-stock request must not silently add anything");
  assert.match(offerStep.reply, new RegExp(String(basmatiRice.stock)), "offer should state the real available stock");
  assert.equal(qtyOf(sessionId, basmatiRice.id), 2, "cart must be unchanged while the offer is pending");

  // An unrelated command instead of yes/no.
  const checkoutStep = await sendMessage(sessionId, "checkout", "en");
  assert.ok(checkoutStep.toolCalls.some((t) => t.tool === "create_order"), "checkout must actually place the order");
  assert.doesNotMatch(checkoutStep.reply, /\bonly 0\b/i, "must never report the stale confirmation's misread 'only 0 available'");
  assert.match(checkoutStep.reply, /order/i, "reply should confirm the order, not a stock shortfall");
  assert.equal(qtyOf(sessionId, basmatiRice.id), 0, "cart is cleared once the real order is placed");
});

// --- Full target conversation, end-to-end ---
test("full target conversation: rice -> basmati -> 2kg -> also oil -> sunflower -> 2L -> cart query -> correction to 3kg", async () => {
  const sessionId = uniqueSessionId("full");

  await sendMessage(sessionId, "I need to order some rice.", "en");
  await sendMessage(sessionId, "Basmati.", "en");
  await sendMessage(sessionId, "2 kilos.", "en");
  assert.equal(qtyOf(sessionId, basmatiRice.id), 2);

  await sendMessage(sessionId, "Also add oil.", "en");
  await sendMessage(sessionId, "Sunflower.", "en");
  await sendMessage(sessionId, "Two litres.", "en");
  assert.equal(qtyOf(sessionId, sunflowerOil.id), 2);

  const cartReply = await sendMessage(sessionId, "What's in my cart?", "en");
  assert.match(cartReply.reply, /2/);

  await sendMessage(sessionId, "Actually make the rice 3 kilos.", "en");
  assert.equal(qtyOf(sessionId, basmatiRice.id), 3);
  assert.equal(qtyOf(sessionId, sunflowerOil.id), 2, "correcting the rice must not touch the oil");
});
