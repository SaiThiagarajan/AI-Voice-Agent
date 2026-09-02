import { v4 as uuid } from "uuid";
import { store } from "../data/store.js";
import { getAIProvider } from "../providers/ai/index.js";
import { AIMessage, ConversationContextUpdate } from "../providers/ai/AIProvider.js";
import { toolDefinitions } from "../tools/toolDefinitions.js";
import { executeTool } from "../tools/toolExecutor.js";
import { ConversationSession, ConversationMessage, ConversationContext } from "../types/conversation.js";
import { SupportedLanguageCode, SUPPORTED_LANGUAGES } from "../types/language.js";
import { PHRASES } from "./localization.js";

const MAX_TOOL_ITERATIONS = 8;

function buildSystemPrompt(language: SupportedLanguageCode, context: ConversationContext): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0];
  return [
    `You are GroceryNxt AI, a multilingual grocery shopping assistant for an Indian grocery e-commerce store.`,
    `LANGUAGE_CODE:${lang.code}`,
    `CONTEXT_JSON:${JSON.stringify(context ?? {})}`,
    `The CONTEXT_JSON line above is internal conversation memory (e.g. a clarifying question you just asked, or the product most recently discussed) — use it silently to interpret short follow-up replies, but never read it aloud or mention it to the customer.`,
    `Respond in ${lang.label} (${lang.nativeLabel}) in every reply, matching the customer's language.`,
    `Rules:`,
    `1. Help customers find grocery products and complete their shopping.`,
    `2. Understand natural, conversational requests, including quantities and units (e.g. "two kilos", "5 packets", "1 litre").`,
    `3. Always use the provided tools to look up real product, price, stock, cart, and order information — you have no other source of truth.`,
    `4. NEVER invent or guess a product's name, price, stock level, discount, order ID, or order status.`,
    `5. Whenever the request needs business information (a product, its price, availability, the cart, or an order), call the appropriate tool before replying.`,
    `6. When a customer clearly requests a specific product and quantity (e.g. "I need two kilos of basmati rice", "add five packets of biscuits"), proceed directly: call search_products to find it, then check_inventory with the requested quantity, then add_to_cart if enough stock is available. Do not stop to ask permission first — the request itself is the instruction.`,
    `7. Distinguish a NEW purchase from a CORRECTION to a quantity already discussed. "I need 2 kilos of basmati rice" is a new purchase (add_to_cart). "Actually make that 3 kilos", "change it to 4", "I only want 1", "actually give me 5 instead" are CORRECTIONS to the quantity just discussed — use update_cart_quantity(productId, finalQuantity) for these, using conversation context to identify which product "that"/"it" refers to (the one most recently discussed). update_cart_quantity sets the cart to that EXACT final amount — it does NOT add to what's already there, so never call add_to_cart to "fix" a quantity that's already in the cart. A phrase like "I ALSO need 3 kilos of basmati rice" (an explicit additional purchase, not a correction) still uses add_to_cart.`,
    `8. A question ABOUT a product is NOT a purchase instruction, even if it states a quantity — e.g. "How much is 2 kilos of basmati rice?", "What is the price of basmati rice?", and "How many kilos of basmati rice are available?" are all questions, not requests to buy. For a price question, call search_products (and calculate the total from the real price and pack size if a quantity was given), then answer — do NOT call check_inventory or add_to_cart. For an availability question, call search_products then check_inventory to answer with the real stock — do NOT call add_to_cart. Only call add_to_cart or update_cart_quantity when the customer is clearly instructing you to buy/change something.`,
    `9. If search_products finds no matching product, clearly tell the customer it isn't available.`,
    `10. If check_inventory shows insufficient stock for add_to_cart, or the requested final quantity for update_cart_quantity exceeds real stock, tell the customer exactly how many units are available and do NOT call add_to_cart or update_cart_quantity.`,
    `11. Never tell the customer an item was added unless add_to_cart actually returned success, and never tell them a quantity was changed unless update_cart_quantity actually returned success — describe the FINAL state from the tool result (e.g. "I've updated your basmati rice to 3 kg — that's ₹486"), not "added 3".`,
    `12. Never tell the customer an order was placed unless create_order actually returned success. Only call create_order after the customer clearly confirms they want to place the order.`,
    `13. If the request is ambiguous (multiple different products could match, or the quantity/unit is unclear), ask a brief clarifying question instead of guessing.`,
    `14. Keep every reply short, natural, and spoken-friendly — responses are read aloud by text-to-speech.`,
    `15. Never ask for or process card numbers, CVV, OTP, or UPI PINs — payment is handled outside this conversation.`,
    `16. Conversation context carries across turns: if your previous reply asked a clarifying question (which product, or how much), and the customer's next message only answers that question (e.g. just "basmati", or just "2 kilos"), resolve it using the product/quantity you were just discussing — do not ask them to repeat the whole request.`,
    `17. If a product name matches multiple different items in the catalog (e.g. "rice" matches Basmati, Sona Masoori, Brown, and Idli rice; "oil" matches several types), do not guess which one — call search_products, then ask the customer which one they mean (and the quantity too, if not yet given), listing the real options search_products returned. Once they name a specific variety (e.g. "basmati"), proceed even if more than one brand matches it — only ask about brand if the customer's own words are ambiguous between brands.`,
    `18. "Also add X", "I also need X", "and also X" describe a NEW additional purchase — use add_to_cart for it, never update_cart_quantity, and never treat it as a correction to a different item already in the cart.`,
    `19. Only treat a bare "yes"/"no"/"sure"/"no thanks" reply as confirming or cancelling an action YOU explicitly proposed in your immediately preceding message (for example, offering fewer units because of limited stock). If you did not propose anything in your last message, do not call any tool for a bare yes/no — ask the customer what they'd like instead.`,
    `20. When asked what's in the cart, or anything about its contents ("what's in my cart", "what did I add", "show me my cart", "what are the items in my cart", "what products do I have") — always call get_cart, then LIST EVERY ITEM from its result: product name, quantity, unit, and that item's price — not just the item count and subtotal. For example: "You have 2 items: 2 kg of India Gate Basmati Rice (₹324), and 2 litres of Fortune Sunflower Oil (₹266.80). Subtotal ₹590.80." Never guess or invent an item's name, quantity, or price, and never reconstruct the cart from earlier conversation turns — always answer from get_cart's actual returned items.`,
  ].join("\n");
}

function toConversationMessage(msg: AIMessage, toolName?: string): ConversationMessage {
  return {
    id: uuid(),
    role: msg.role,
    content: msg.content,
    toolName,
    createdAt: new Date().toISOString(),
  };
}

export function getOrCreateSession(
  sessionId: string | undefined,
  customerId: string,
  channel: "web" | "phone",
  language: SupportedLanguageCode
): ConversationSession {
  if (sessionId) {
    const existing = store.sessions.get(sessionId);
    if (existing) return existing;
  }
  const now = new Date().toISOString();
  const session: ConversationSession = {
    sessionId: sessionId || uuid(),
    customerId,
    channel,
    language,
    messages: [],
    createdAt: now,
    updatedAt: now,
    status: "active",
    ordersCreated: [],
    context: {},
  };
  store.sessions.set(session.sessionId, session);
  return session;
}

/**
 * Applies a provider's requested cross-turn memory change onto the session.
 * Tri-state per field: omitted = unchanged, `null` = clear, a value = set.
 * See ConversationContextUpdate / ConversationContext.
 */
function applyContextUpdate(session: ConversationSession, update: ConversationContextUpdate): void {
  const ctx: ConversationContext = session.context ?? (session.context = {});
  if ("pendingClarification" in update) {
    if (update.pendingClarification === null) delete ctx.pendingClarification;
    else if (update.pendingClarification) ctx.pendingClarification = update.pendingClarification;
  }
  if ("pendingConfirmation" in update) {
    if (update.pendingConfirmation === null) delete ctx.pendingConfirmation;
    else if (update.pendingConfirmation) ctx.pendingConfirmation = update.pendingConfirmation;
  }
  if ("lastDiscussedProductId" in update) {
    if (update.lastDiscussedProductId === null) delete ctx.lastDiscussedProductId;
    else if (update.lastDiscussedProductId) ctx.lastDiscussedProductId = update.lastDiscussedProductId;
  }
  if ("lastDiscussedProductName" in update) {
    if (update.lastDiscussedProductName === null) delete ctx.lastDiscussedProductName;
    else if (update.lastDiscussedProductName) ctx.lastDiscussedProductName = update.lastDiscussedProductName;
  }
}

export function setSessionLanguage(sessionId: string, language: SupportedLanguageCode): void {
  const session = store.sessions.get(sessionId);
  if (session) session.language = language;
}

export function endSession(sessionId: string): void {
  const session = store.sessions.get(sessionId);
  if (!session) return;
  session.status = "ended";
  session.updatedAt = new Date().toISOString();
  const startMs = new Date(session.createdAt).getTime();
  session.callDurationSeconds = Math.max(1, Math.round((Date.now() - startMs) / 1000));
}

export interface ToolCallSummary {
  tool: string;
  status: "completed" | "error";
}

/**
 * Extracts only safe, useful fields from a caught error for logging —
 * never the raw error object, which for an OpenAI SDK error can carry
 * response headers and other request/response metadata that has no
 * business being in application logs even though it doesn't include our
 * API key (the key is sent as an outgoing request header, never echoed
 * back). Keeps logs minimal per the "development logs" guidance: provider,
 * status/type, and a short message — never secrets, never full payloads.
 */
export function sanitizeError(err: unknown): { name?: string; message: string; status?: number; type?: string } {
  if (err instanceof Error) {
    const anyErr = err as { status?: unknown; type?: unknown };
    return {
      name: err.name,
      message: err.message,
      status: typeof anyErr.status === "number" ? anyErr.status : undefined,
      type: typeof anyErr.type === "string" ? anyErr.type : undefined,
    };
  }
  return { message: String(err) };
}

export interface SendMessageResult {
  session: ConversationSession;
  reply: string;
  toolCalls: ToolCallSummary[];
}

/**
 * Core orchestration: appends the user's message, runs the AI + tool-calling
 * loop against the mock GroceryNxt data layer, and returns the assistant's
 * natural-language reply plus the updated session/transcript.
 */
export async function sendMessage(
  sessionId: string,
  userText: string,
  language: SupportedLanguageCode
): Promise<SendMessageResult> {
  const session = getOrCreateSession(sessionId, sessionId, "web", language);
  session.language = language;
  if (!session.context) session.context = {};

  const provider = getAIProvider();
  console.log(`[aiService] session=${session.sessionId} channel=${session.channel} provider=${provider.name} language=${language}`);

  session.messages.push(toConversationMessage({ role: "user", content: userText }));

  const history: AIMessage[] = [
    { role: "system", content: buildSystemPrompt(language, session.context) },
    ...session.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m): AIMessage => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const toolCalls: ToolCallSummary[] = [];

  let finalText = "";
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let response;
    try {
      response = await provider.chat({ messages: history, tools: toolDefinitions });
    } catch (err) {
      console.error(`[aiService] session=${session.sessionId} provider=${provider.name} chat request failed`, sanitizeError(err));
      throw err; // handled by the caller (agentController), which returns a safe generic message
    }

    if (response.contextUpdate) applyContextUpdate(session, response.contextUpdate);

    if (response.finishReason === "stop" || !response.message.toolCalls?.length) {
      finalText = response.message.content;
      history.push(response.message);
      break;
    }

    history.push(response.message);

    for (const toolCall of response.message.toolCalls) {
      let result: unknown;
      try {
        result = await executeTool(toolCall.name, toolCall.arguments, session.customerId);
        toolCalls.push({ tool: toolCall.name, status: "completed" });
        console.log(`[aiService] session=${session.sessionId} tool=${toolCall.name} status=completed`);
      } catch (err) {
        console.error(`[aiService] session=${session.sessionId} tool=${toolCall.name} status=error`, sanitizeError(err));
        result = { error: "Tool execution failed" };
        toolCalls.push({ tool: toolCall.name, status: "error" });
      }
      if (toolCall.name === "create_order" && (result as any)?.ok) {
        session.ordersCreated.push((result as any).order.orderId);
      }
      history.push({
        role: "tool",
        content: JSON.stringify(result),
        toolCallId: toolCall.id,
        name: toolCall.name,
      });
    }
  }

  if (!finalText) {
    finalText = PHRASES[language].genericHelp;
  }

  session.messages.push(toConversationMessage({ role: "assistant", content: finalText }));
  session.updatedAt = new Date().toISOString();

  return { session, reply: finalText, toolCalls };
}
