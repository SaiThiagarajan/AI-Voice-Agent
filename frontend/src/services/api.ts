import {
  Cart,
  CallTranscriptEntry,
  DashboardSnapshot,
  Order,
  PhoneCall,
  ProductCategory,
  ProductSearchResult,
  SupportedLanguageCode,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function getCustomerId(): string {
  let id = localStorage.getItem("gnx_customer_id");
  if (!id) {
    id = `guest_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("gnx_customer_id", id);
  }
  return id;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-customer-id": getCustomerId(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  customerId: getCustomerId,

  searchProducts(query = "", category?: ProductCategory): Promise<{ count: number; results: ProductSearchResult[] }> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    return request(`/api/products?${params.toString()}`);
  },

  listCategories(): Promise<{ categories: ProductCategory[] }> {
    return request(`/api/products/categories`);
  },

  getCart(): Promise<Cart> {
    return request(`/api/cart`);
  },

  addToCart(productId: string, qty: number): Promise<Cart> {
    return request(`/api/cart/items`, { method: "POST", body: JSON.stringify({ productId, qty }) });
  },

  removeFromCart(productId: string, qty?: number): Promise<Cart> {
    return request(`/api/cart/items`, { method: "DELETE", body: JSON.stringify({ productId, qty }) });
  },

  createOrder(deliveryAddress?: string): Promise<Order> {
    return request(`/api/orders`, { method: "POST", body: JSON.stringify({ deliveryAddress }) });
  },

  getOrder(orderId: string): Promise<Order> {
    return request(`/api/orders/${orderId}`);
  },

  /**
   * The voice/text agent endpoint. `customerId` is always the same
   * persisted guest id used for cart/order REST calls, so the AI's
   * add_to_cart/create_order tool calls operate on the exact cart the
   * storefront UI displays.
   */
  sendAgentChat(
    message: string,
    language: SupportedLanguageCode
  ): Promise<{
    success: boolean;
    response: string;
    language: SupportedLanguageCode;
    toolCalls: Array<{ tool: string; status: "completed" | "error" }>;
    ordersCreated: string[];
    sessionId: string;
  }> {
    return request(`/api/agent/chat`, {
      method: "POST",
      body: JSON.stringify({ message, language, customerId: getCustomerId() }),
    });
  },

  endAgentSession(sessionId: string): Promise<{ ok: boolean }> {
    return request(`/api/agent/session/${sessionId}/end`, { method: "POST" });
  },

  getDashboard(): Promise<DashboardSnapshot> {
    return request(`/api/dashboard`);
  },

  /**
   * Phone Call Simulator (Dashboard) — exercises the exact same
   * aiService/tool-calling pipeline as the browser voice agent, via
   * `services/callService.ts` on the backend. No real phone network
   * involved.
   */
  simulateCall(language: SupportedLanguageCode, customerId: string): Promise<{ success: boolean; call: PhoneCall }> {
    return request(`/api/calls/simulate`, { method: "POST", body: JSON.stringify({ language, customerId }) });
  },

  sendCallMessage(
    callId: string,
    message: string
  ): Promise<{
    success: boolean;
    response: string;
    toolCalls: Array<{ tool: string; status: "completed" | "error" }>;
    ordersCreated: string[];
    status: PhoneCall["status"];
  }> {
    return request(`/api/calls/${callId}/message`, { method: "POST", body: JSON.stringify({ message }) });
  },

  getCall(callId: string): Promise<{ success: boolean; call: PhoneCall; transcript: CallTranscriptEntry[] }> {
    return request(`/api/calls/${callId}`);
  },

  endCall(callId: string): Promise<{ success: boolean; call: PhoneCall }> {
    return request(`/api/calls/${callId}/end`, { method: "POST" });
  },
};
