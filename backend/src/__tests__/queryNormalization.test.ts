import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShoppingIntent } from "../services/queryNormalization.js";

// BUG 1 — multilingual quantity/product normalization.

test("English: 'two kilos'", () => {
  const r = normalizeShoppingIntent("two kilos of basmati rice", "en");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("English: '2 kilos'", () => {
  const r = normalizeShoppingIntent("2 kilos of basmati rice", "en");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("English: 'two kg'", () => {
  const r = normalizeShoppingIntent("two kg basmati rice", "en");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("English: '2 kg'", () => {
  const r = normalizeShoppingIntent("2 kg basmati rice", "en");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("English: full sentence 'I need two kilos of basmati rice'", () => {
  const r = normalizeShoppingIntent("I need two kilos of basmati rice", "en");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Hindi: 'दो किलो'", () => {
  const r = normalizeShoppingIntent("दो किलो बासमती चावल", "hi");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Hindi: '2 किलो'", () => {
  const r = normalizeShoppingIntent("2 किलो बासमती चावल", "hi");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Hindi: 'दो किलोग्राम' (full word for kilogram)", () => {
  const r = normalizeShoppingIntent("दो किलोग्राम बासमती चावल", "hi");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Hindi: full sentence 'मुझे दो किलो बासमती चावल चाहिए'", () => {
  const r = normalizeShoppingIntent("मुझे दो किलो बासमती चावल चाहिए", "hi");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Hindi: code-switched 'मुझे दो किलो बासमती राइस दे दो' (the reported bug phrase)", () => {
  const r = normalizeShoppingIntent("मुझे दो किलो बासमती राइस दे दो", "hi");
  assert.equal(r.quantity, 2, "quantity must be 2, not confused by the second दो in दे दो");
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Tamil: 'இரண்டு கிலோ'", () => {
  const r = normalizeShoppingIntent("இரண்டு கிலோ பாஸ்மதி அரிசி", "ta");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Tamil: '2 கிலோ'", () => {
  const r = normalizeShoppingIntent("2 கிலோ பாஸ்மதி அரிசி", "ta");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Tamil: full sentence 'எனக்கு இரண்டு கிலோ பாஸ்மதி அரிசி வேண்டும்'", () => {
  const r = normalizeShoppingIntent("எனக்கு இரண்டு கிலோ பாஸ்மதி அரிசி வேண்டும்", "ta");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Telugu: 'రెండు కిలోలు' (plural unit form)", () => {
  const r = normalizeShoppingIntent("రెండు కిలోలు బాస్మతి బియ్యం", "te");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Telugu: '2 కిలోలు'", () => {
  const r = normalizeShoppingIntent("2 కిలోలు బాస్మతి బియ్యం", "te");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("Telugu: full sentence 'నాకు రెండు కిలోల బాస్మతి బియ్యం కావాలి'", () => {
  const r = normalizeShoppingIntent("నాకు రెండు కిలోల బాస్మతి బియ్యం కావాలి", "te");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "basmati rice");
});

test("no quantity stated -> quantity is undefined, not a false 1 or 0", () => {
  const r = normalizeShoppingIntent("do you have basmati rice", "en");
  assert.equal(r.quantity, undefined);
  assert.equal(r.productQuery, "basmati rice");
});

test("unrecognized product word passes through untranslated (search still gets a query)", () => {
  const r = normalizeShoppingIntent("2 kg of quinoa", "en");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "kg");
  assert.equal(r.productQuery, "quinoa");
});
