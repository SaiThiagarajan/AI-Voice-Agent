import { Cart } from "../types/cart.js";
import { Order } from "../types/order.js";
import { ConversationSession } from "../types/conversation.js";
import { TelephonyCall } from "../types/telephony.js";

/**
 * In-memory data store standing in for a real database. Resets on server
 * restart. Good enough for a demo/prototype; swap for a real DB layer by
 * replacing this module's exports.
 */
class MemoryStore {
  carts = new Map<string, Cart>();
  orders = new Map<string, Order>();
  sessions = new Map<string, ConversationSession>();
  /** Phone-call domain records owned by services/callService.ts. */
  calls = new Map<string, TelephonyCall>();
}

export const store = new MemoryStore();
