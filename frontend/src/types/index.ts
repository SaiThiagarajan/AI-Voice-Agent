export type ProductCategory =
  | "Rice" | "Atta" | "Dal" | "Oil" | "Milk" | "Biscuits" | "Snacks"
  | "Vegetables" | "Fruits" | "Beverages" | "Household";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  quantity: string;
  price: number;
  discount: number;
  stock: number;
  unit: string;
  imageEmoji: string;
  description: string;
}

export interface ProductSearchResult {
  product: Product;
  effectivePrice: number;
  inStock: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  quantityLabel: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface Cart {
  cartId: string;
  customerId: string;
  items: CartItem[];
  subtotal: number;
  updatedAt: string;
}

export type OrderStatus = "placed" | "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled";

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

export type SupportedLanguageCode = "en" | "ta" | "te" | "hi";

export interface SupportedLanguage {
  code: SupportedLanguageCode;
  label: string;
  nativeLabel: string;
  speechLocale: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English", speechLocale: "en-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", speechLocale: "ta-IN" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", speechLocale: "te-IN" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", speechLocale: "hi-IN" },
];

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName?: string;
  createdAt: string;
}

export type VoiceAssistantState = "idle" | "listening" | "thinking" | "speaking" | "error";

export type CallStatus = "ringing" | "connected" | "listening" | "thinking" | "speaking" | "ended";

export interface PhoneCall {
  callId: string;
  customerId: string;
  phoneNumber: string;
  language: SupportedLanguageCode;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
}

export interface CallTranscriptEntry {
  speaker: "customer" | "ai";
  language: SupportedLanguageCode;
  text: string;
  timestamp: string;
}

export interface DashboardSnapshot {
  agentStatus: "online" | "offline";
  aiProvider: { provider: string; configured: boolean; model: string };
  totalCalls: number;
  activeCalls: number;
  averageCallDurationSeconds: number;
  languageBreakdown: Record<string, number>;
  recentConversations: Array<{
    sessionId: string;
    channel: string;
    language: string;
    status: string;
    messageCount: number;
    updatedAt: string;
    ordersCreated: string[];
  }>;
  ordersGenerated: number;
  totalRevenue: number;
}
