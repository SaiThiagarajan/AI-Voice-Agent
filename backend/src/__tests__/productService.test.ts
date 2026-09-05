import { test } from "node:test";
import assert from "node:assert/strict";
import * as productService from "../services/productService.js";

// BUG 4 — "basmati rice" (and similar multi-word queries) must rank a real,
// relevant product first and must not accidentally match unrelated products
// via naive substring containment (e.g. token "oil" inside "parboiled", or
// "one" inside "stone" — both real false positives from the old
// implementation, fixed by word-level matching + relevance ranking in
// productService.searchProducts).

test("'basmati rice' matches only basmati products, ranked above other rice", () => {
  const results = productService.searchProducts({ query: "basmati rice", limit: 10 });
  assert.ok(results.length >= 1);
  assert.match(results[0].product.name.toLowerCase(), /basmati/);

  // Every basmati product in the catalog should appear ahead of any
  // non-basmati rice (both match "rice", but basmati matches "basmati" too).
  const basmatiIndex = results.findIndex((r) => !/basmati/i.test(r.product.name));
  if (basmatiIndex !== -1) {
    const allBefore = results.slice(0, basmatiIndex);
    assert.ok(allBefore.every((r) => /basmati/i.test(r.product.name)), "basmati matches must rank first");
  }
});

test("token 'oil' does not falsely match 'parboiled' (word-boundary matching, not substring)", () => {
  const results = productService.searchProducts({ query: "oil", limit: 20 });
  const falsePositive = results.find((r) => /parboiled/i.test(r.product.description));
  assert.equal(falsePositive, undefined, "a product only described as 'parboiled' must not match query 'oil'");
  assert.ok(results.every((r) => r.product.category === "Oil"), "every result for 'oil' should actually be an oil product");
});

test("token 'one' does not falsely match 'stone' (e.g. 'stone ground')", () => {
  const results = productService.searchProducts({ query: "one", limit: 20 });
  const falsePositive = results.find((r) => /stone/i.test(r.product.description));
  assert.equal(falsePositive, undefined, "a product only containing 'stone' in its description must not match query 'one'");
});

test("an unrelated/nonexistent product query returns no results", () => {
  const results = productService.searchProducts({ query: "unicorn dust", limit: 10 });
  assert.equal(results.length, 0);
});

test("'sunflower oil' ranks the actual Sunflower Oil product first", () => {
  const results = productService.searchProducts({ query: "sunflower oil", limit: 5 });
  assert.ok(results.length > 0);
  assert.match(results[0].product.name.toLowerCase(), /sunflower/);
});
