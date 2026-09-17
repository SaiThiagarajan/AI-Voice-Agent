import { SupportedLanguageCode } from "./language.js";

export type ConversationRole = "user" | "assistant" | "tool" | "system";

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  toolName?: string;
  createdAt: string;
}

/**
 * Minimum useful cross-turn conversational memory, needed because
 * MockAIProvider re-parses each turn independently and has no other way to
 * remember "what were we just talking about" (a real LLM provider gets this
 * for free from the full message history + system-prompt instructions, and
 * never needs to read or write this — see OpenAIProvider). Scoped onto the
 * ConversationSession, which is itself already scoped per customer/session
 * (see data/store.ts `sessions` map), so there is no cross-customer leakage
 * risk from adding this.
 */
export interface PendingClarification {
  /** What we're still waiting on the customer to resolve. */
  awaiting: "product" | "quantity" | "product_and_quantity" | "cart_item";
  /** The free-text product query fragment being resolved (e.g. "rice", "oil"). */
  query: string;
  /** Resolved once the product itself is known (awaiting === "quantity"). */
  productId?: string;
  productName?: string;
  /** A unit the customer already stated, to carry forward once the product resolves. */
  unit?: string | null;
  /** A quantity the customer already stated, to carry forward once the product resolves. */
  pendingQty?: number;
  /** For awaiting === "cart_item": which cart operation this clarification is resolving. */
  action?: "update_cart_quantity" | "remove_from_cart";
  /** A second product request from the same utterance ("rice AND oil"), handled after this one resolves. */
  queuedSegment?: string;
}

export interface PendingConfirmation {
  action: "add_to_cart";
  productId: string;
  productName: string;
  qty: number;
}

export interface ConversationContext {
  pendingClarification?: PendingClarification;
  pendingConfirmation?: PendingConfirmation;
  /** The product most recently searched, quoted, or added — used to resolve "that"/"it" references. */
  lastDiscussedProductId?: string;
  lastDiscussedProductName?: string;
}

export interface ConversationSession {
  sessionId: string;
  customerId: string;
  channel: "web" | "phone";
  language: SupportedLanguageCode;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "ended";
  callDurationSeconds?: number;
  ordersCreated: string[];
  /** Cross-turn conversational memory. See PendingClarification/PendingConfirmation. */
  context?: ConversationContext;
}
