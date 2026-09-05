import { test } from "node:test";
import assert from "node:assert/strict";
import * as cartService from "../services/cartService.js";
import * as productService from "../services/productService.js";
import { getAllProducts } from "../data/products.js";
import { effectivePrice } from "../types/product.js";

function uniqueCustomerId(label: string): string {
  return `test-${label}-${crypto.randomUUID()}`;
}

/** Pick any real in-stock catalog product so tests exercise real inventory data, never a fabricated number. */
function anyInStockProduct() {
  const product = getAllProducts().find((p) => p.stock > 0);
  assert.ok(product, "expected at least one in-stock product in the catalog for tests");
  return product!;
}

// BUG 2 — the cart service must enforce "requested quantity <= available
// stock" on its own, independent of any AI layer, using each product's REAL
// stock value (never a hardcoded number) so the rule is proven general.

test("BUG 2: add_to_cart allows exactly the available stock (boundary, allowed)", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("boundary-allowed");

  const result = cartService.addToCart(customerId, product.id, product.stock);

  assert.equal(result.ok, true);
  if (result.ok) {
    const item = result.cart.items.find((i) => i.productId === product.id);
    assert.ok(item, "item should be in the cart");
    assert.equal(item!.qty, product.stock);
  }
});

test("BUG 2: add_to_cart rejects one unit more than available stock (boundary, rejected)", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("boundary-rejected");

  const result = cartService.addToCart(customerId, product.id, product.stock + 1);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "INSUFFICIENT_STOCK");
    assert.equal(result.stock, product.stock, "must report the REAL stock figure, not an invented one");
  }
});

test("BUG 2: the invariant also applies cumulatively across multiple add_to_cart calls", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("cumulative");

  // Add half the stock, then try to add more than the remaining half.
  const firstQty = Math.max(1, Math.floor(product.stock / 2));
  const first = cartService.addToCart(customerId, product.id, firstQty);
  assert.equal(first.ok, true);

  const remaining = product.stock - firstQty;
  const second = cartService.addToCart(customerId, product.id, remaining + 1);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error, "INSUFFICIENT_STOCK");
});

test("BUG 2: a wildly excessive quantity is rejected outright (regression for the reported '100 kilos' style report)", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("excessive");

  const result = cartService.addToCart(customerId, product.id, product.stock * 1000);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "INSUFFICIENT_STOCK");
});

test("BUG 2 hardening: a non-finite/NaN quantity is rejected, not silently let through", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("nan-qty");

  // NaN > stock and -Infinity > stock are both `false` in JS — the naive
  // comparison alone would NOT catch this, which is exactly the bypass this
  // guard closes (see cartService.addToCart).
  const result = cartService.addToCart(customerId, product.id, NaN);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "INVALID_QUANTITY");
});

test("BUG 2 hardening: a negative quantity is rejected", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("negative-qty");

  const result = cartService.addToCart(customerId, product.id, -5);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "INVALID_QUANTITY");
});

test("BUG 2 / TEST 9: the invariant holds even calling the service directly, bypassing any AI layer entirely", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("bypass-ai");

  // No aiService, no MockAIProvider, no tool executor involved at all.
  const result = cartService.addToCart(customerId, product.id, product.stock + 50);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "INSUFFICIENT_STOCK");
});

// BUG 3 — totals must always come from product data, never user/AI-supplied numbers.

test("BUG 3: cart unit price and line total are computed from product.price/discount, not any external input", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("pricing");
  const qty = Math.min(2, product.stock);

  const result = cartService.addToCart(customerId, product.id, qty);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const item = result.cart.items.find((i) => i.productId === product.id)!;
  const expectedUnitPrice = effectivePrice(product);
  assert.equal(item.unitPrice, expectedUnitPrice);
  assert.equal(item.lineTotal, Math.round(expectedUnitPrice * qty * 100) / 100);
  assert.equal(result.cart.subtotal, item.lineTotal);
});

test("BUG 4: 'basmati rice' search ranks a real basmati rice product first, not an unrelated item", () => {
  const results = productService.searchProducts({ query: "basmati rice", limit: 5 });
  assert.ok(results.length > 0, "expected at least one match for 'basmati rice'");
  const top = results[0];
  assert.match(top.product.name.toLowerCase(), /basmati/, "top result must actually be a basmati product");
  assert.equal(top.product.category, "Rice");
});

test("PRODUCT_NOT_FOUND is returned for an unknown product id", () => {
  const result = cartService.addToCart(uniqueCustomerId("missing"), "NOT-A-REAL-ID", 1);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "PRODUCT_NOT_FOUND");
});

// Regression: existing cart flows must keep working.

test("regression: get_cart, add, remove all still work end to end", () => {
  const product = anyInStockProduct();
  const customerId = uniqueCustomerId("regression");

  const empty = cartService.getCart(customerId);
  assert.equal(empty.items.length, 0);

  const added = cartService.addToCart(customerId, product.id, 1);
  assert.equal(added.ok, true);

  const afterAdd = cartService.getCart(customerId);
  assert.equal(afterAdd.items.length, 1);

  const removed = cartService.removeFromCart(customerId, product.id);
  assert.equal(removed.ok, true);

  const afterRemove = cartService.getCart(customerId);
  assert.equal(afterRemove.items.length, 0);
});
