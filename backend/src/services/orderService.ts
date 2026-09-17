import { v4 as uuid } from "uuid";
import { store } from "../data/store.js";
import { Order, OrderStatus } from "../types/order.js";
import { getCart, clearCart } from "./cartService.js";

const DELIVERY_FEE_THRESHOLD = 500;
const DELIVERY_FEE = 25;

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: "EMPTY_CART" };

export function createOrder(customerId: string, deliveryAddress: string): CreateOrderResult {
  const cart = getCart(customerId);
  if (cart.items.length === 0) {
    return { ok: false, error: "EMPTY_CART" };
  }

  const deliveryFee = cart.subtotal >= DELIVERY_FEE_THRESHOLD ? 0 : DELIVERY_FEE;
  const now = new Date().toISOString();

  const order: Order = {
    orderId: `GNX-${uuid().slice(0, 8).toUpperCase()}`,
    customerId,
    items: cart.items,
    subtotal: cart.subtotal,
    deliveryFee,
    total: Math.round((cart.subtotal + deliveryFee) * 100) / 100,
    status: "placed",
    createdAt: now,
    updatedAt: now,
    deliveryAddress: deliveryAddress || "Default saved address",
    estimatedDeliveryMinutes: 45,
  };

  store.orders.set(order.orderId, order);
  clearCart(customerId);
  return { ok: true, order };
}

export type GetOrderResult = { ok: true; order: Order } | { ok: false; error: "ORDER_NOT_FOUND" };

export function getOrderStatus(orderId: string): GetOrderResult {
  const order = store.orders.get(orderId);
  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  return { ok: true, order };
}

const CANCELLABLE_STATUSES: OrderStatus[] = ["placed", "confirmed"];

export type CancelOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: "ORDER_NOT_FOUND" | "NOT_CANCELLABLE"; status?: OrderStatus };

export function cancelOrder(orderId: string): CancelOrderResult {
  const order = store.orders.get(orderId);
  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return { ok: false, error: "NOT_CANCELLABLE", status: order.status };
  }
  order.status = "cancelled";
  order.updatedAt = new Date().toISOString();
  return { ok: true, order };
}

export function listOrders(): Order[] {
  return Array.from(store.orders.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
