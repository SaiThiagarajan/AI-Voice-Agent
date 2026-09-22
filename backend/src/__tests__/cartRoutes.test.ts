import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";
import { getAllProducts } from "../data/products.js";

/**
 * HTTP-level regression coverage for cartController: a request with a
 * missing/malformed `productId` used to reach `getProductById`, which called
 * `id.toLowerCase()` on `undefined` and crashed with an unhandled 500 rather
 * than a clean 400. Every other controller already guarded required fields
 * (agentController, callController, orderController) — cartController's
 * add/remove handlers did not. Fixed in cartController.ts + a defensive
 * type guard in data/products.ts's getProductById.
 */

function uniqueCustomerId(label: string): string {
  return `test-cartroutes-${label}-${crypto.randomUUID()}`;
}

test("POST /api/cart/items with a missing productId returns 400, not a 500 crash", async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/cart/items",
    headers: { "x-customer-id": uniqueCustomerId("missing-product-id") },
    payload: { qty: 2 },
  });
  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.error, "INVALID_REQUEST");
  await app.close();
});

test("POST /api/cart/items with a non-string productId returns 400, not a 500 crash", async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/cart/items",
    headers: { "x-customer-id": uniqueCustomerId("non-string-product-id") },
    payload: { productId: 12345, qty: 2 },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_REQUEST");
  await app.close();
});

test("DELETE /api/cart/items with a missing productId returns 400, not a 500 crash", async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: "DELETE",
    url: "/api/cart/items",
    headers: { "x-customer-id": uniqueCustomerId("missing-product-id-remove") },
    payload: {},
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_REQUEST");
  await app.close();
});

test("POST /api/cart/items still succeeds for a genuine, valid request", async () => {
  const app = await buildApp();
  const product = getAllProducts().find((p) => p.stock > 0)!;
  const response = await app.inject({
    method: "POST",
    url: "/api/cart/items",
    headers: { "x-customer-id": uniqueCustomerId("valid-add") },
    payload: { productId: product.id, qty: 1 },
  });
  assert.equal(response.statusCode, 200);
  const cart = response.json();
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].productId, product.id);
  await app.close();
});
