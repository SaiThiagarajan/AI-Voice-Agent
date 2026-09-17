import { CartItem } from "./cart.js";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface Order {
  orderId: string;
  customerId: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  deliveryAddress: string;
  estimatedDeliveryMinutes: number;
}
