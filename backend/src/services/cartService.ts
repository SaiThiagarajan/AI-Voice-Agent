import { v4 as uuid } from "uuid";
import { store } from "../data/store.js";
import { getProductById } from "../data/products.js";
import { Cart } from "../types/cart.js";
import { effectivePrice } from "../types/product.js";

function recalcTotals(cart: Cart): Cart {
  cart.items.forEach((item) => {
    item.lineTotal = Math.round(item.unitPrice * item.qty * 100) / 100;
  });
  cart.subtotal = Math.round(cart.items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
  cart.updatedAt = new Date().toISOString();
  return cart;
}

function getOrCreateCart(customerId: string): Cart {
  let cart = store.carts.get(customerId);
  if (!cart) {
    cart = {
      cartId: uuid(),
      customerId,
      items: [],
      subtotal: 0,
      updatedAt: new Date().toISOString(),
    };
    store.carts.set(customerId, cart);
  }
  return cart;
}

export type AddToCartResult =
  | { ok: true; cart: Cart }
  | { ok: false; error: "PRODUCT_NOT_FOUND" | "INVALID_QUANTITY" | "INSUFFICIENT_STOCK"; stock?: number };

/**
 * The authoritative inventory invariant: requested quantity (existing cart
 * quantity + this request) must never exceed real stock. Enforced HERE,
 * independent of whatever any AI layer (mock or real) decided — a caller
 * cannot bypass this by going through the tool executor, browser voice,
 * text chat, the phone simulator, or any future telephony integration,
 * since every one of those paths calls this same function.
 *
 * `qty` must be a finite positive number — this also closes off a real bug
 * class: `NaN > stock` and `-Infinity > stock` both evaluate to `false` in
 * JavaScript, so a malformed/unparsed quantity could otherwise silently
 * slip past the stock check entirely rather than being rejected by it.
 */
export function addToCart(customerId: string, productId: string, qty: number): AddToCartResult {
  const product = getProductById(productId);
  if (!product) return { ok: false, error: "PRODUCT_NOT_FOUND" };
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "INVALID_QUANTITY" };
  qty = Math.floor(qty);

  const cart = getOrCreateCart(customerId);
  const existing = cart.items.find((i) => i.productId === productId);
  const requestedTotalQty = (existing?.qty ?? 0) + qty;

  if (requestedTotalQty > product.stock) {
    return { ok: false, error: "INSUFFICIENT_STOCK", stock: product.stock };
  }

  const unitPrice = effectivePrice(product);
  if (existing) {
    existing.qty = requestedTotalQty;
  } else {
    cart.items.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      quantityLabel: product.quantity,
      unitPrice,
      qty,
      lineTotal: 0,
    });
  }

  return { ok: true, cart: recalcTotals(cart) };
}

export type UpdateCartQuantityResult =
  | { ok: true; cart: Cart; removed?: boolean }
  | { ok: false; error: "PRODUCT_NOT_FOUND" | "INVALID_QUANTITY" | "INSUFFICIENT_STOCK"; stock?: number };

/**
 * Sets a cart line to an ABSOLUTE final quantity — "make it 3" means the
 * cart should end up holding exactly 3, never 3 MORE. This is the
 * conversational-correction counterpart to `addToCart` (which is always
 * additive): a customer saying "actually make that 3 kilos" after already
 * having 2 in the cart must end up with 3, not 5.
 *
 * Enforces the same authoritative stock invariant as `addToCart` — the
 * requested FINAL quantity must never exceed real stock — independent of
 * what any AI layer (mock or real) decided. `quantity` must be a finite
 * value in [0, stock]; 0 removes the line entirely (a customer correcting
 * "make that 0" is equivalent to no longer wanting the item). On rejection
 * the cart is left completely untouched.
 */
export function updateCartQuantity(customerId: string, productId: string, quantity: number): UpdateCartQuantityResult {
  const product = getProductById(productId);
  if (!product) return { ok: false, error: "PRODUCT_NOT_FOUND" };
  if (!Number.isFinite(quantity) || quantity < 0) return { ok: false, error: "INVALID_QUANTITY" };
  quantity = Math.floor(quantity);

  if (quantity > product.stock) {
    return { ok: false, error: "INSUFFICIENT_STOCK", stock: product.stock };
  }

  const cart = getOrCreateCart(customerId);
  const idx = cart.items.findIndex((i) => i.productId === productId);

  if (quantity === 0) {
    if (idx !== -1) cart.items.splice(idx, 1);
    return { ok: true, cart: recalcTotals(cart), removed: true };
  }

  const unitPrice = effectivePrice(product);
  if (idx === -1) {
    cart.items.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      quantityLabel: product.quantity,
      unitPrice,
      qty: quantity,
      lineTotal: 0,
    });
  } else {
    cart.items[idx].qty = quantity;
    cart.items[idx].unitPrice = unitPrice; // keep price fresh in case catalog data changed
  }

  return { ok: true, cart: recalcTotals(cart) };
}

export type RemoveFromCartResult = { ok: true; cart: Cart } | { ok: false; error: "PRODUCT_NOT_IN_CART" };

export function removeFromCart(customerId: string, productId: string, qty?: number): RemoveFromCartResult {
  const cart = getOrCreateCart(customerId);
  const idx = cart.items.findIndex((i) => i.productId === productId);
  if (idx === -1) return { ok: false, error: "PRODUCT_NOT_IN_CART" };

  if (qty === undefined || qty >= cart.items[idx].qty) {
    cart.items.splice(idx, 1);
  } else {
    cart.items[idx].qty -= qty;
  }

  return { ok: true, cart: recalcTotals(cart) };
}

export function getCart(customerId: string): Cart {
  return recalcTotals(getOrCreateCart(customerId));
}

export function clearCart(customerId: string): void {
  store.carts.delete(customerId);
}
