import { AIChatRequest, AIChatResponse, AIMessage, AIProvider, AIToolCallRequest, ConversationContextUpdate } from "./AIProvider.js";
import { PHRASES } from "../../services/localization.js";
import { computePacksNeeded, detectUtteranceIntent, normalizeShoppingIntent } from "../../services/queryNormalization.js";
import { SupportedLanguageCode } from "../../types/language.js";
import { ConversationContext, PendingClarification } from "../../types/conversation.js";

/**
 * Rule-based fallback provider used when OPENAI_API_KEY is not configured.
 * It performs lightweight, table-driven quantity/product extraction (via
 * services/queryNormalization.ts — NOT real NLU) and drives the exact same
 * tool-calling contract as OpenAIProvider — the same
 * search_products -> check_inventory -> add_to_cart pipeline the system
 * prompt asks the real model to follow — so the rest of the app (aiService,
 * tool executor, routes) works identically whether or not real credentials
 * are present. This keeps the demo fully runnable offline while making it
 * obvious where real language understanding plugs in once an API key is
 * supplied.
 *
 * Multi-turn awareness: unlike a real LLM, this class re-parses each turn
 * independently and never "remembers" earlier turns on its own — so it reads
 * a small CONTEXT_JSON blob aiService embeds in the system prompt (pending
 * clarification, most recently discussed product, a pending yes/no
 * confirmation) and returns a `contextUpdate` describing how that memory
 * should change, which aiService persists on the session. This is still a
 * bounded, deterministic rule table — not a general-purpose conversational
 * engine — scoped to the specific follow-up patterns this app needs
 * (ambiguous product -> clarify, product-then-quantity, corrections,
 * removals, "also add", yes/no on a stock shortfall).
 */

type Phrases = (typeof PHRASES)[SupportedLanguageCode];

function extractOrderId(text: string): string | undefined {
  const match = text.match(/GNX-[A-Z0-9]{4,10}/i);
  return match ? match[0].toUpperCase() : undefined;
}

interface ParsedIntent {
  type:
    | "add_to_cart"
    | "update_cart_quantity"
    | "remove_from_cart"
    | "price_query"
    | "inventory_query"
    | "get_cart"
    | "create_order"
    | "get_order_status"
    | "cancel_order"
    | "help";
  query?: string;
  qty?: number;
  unit?: string | null;
  orderId?: string;
  /** A second product request from the same utterance ("rice AND oil"), processed after this one resolves. */
  secondSegmentRaw?: string;
}

// Connector words used to split a single utterance into two product
// requests ("I need rice and oil"). Deliberately narrow (first match only,
// exactly two segments) — this is a bounded convenience, not a general
// sentence parser.
const CONNECTOR_PATTERN = /\s+(?:and|&|மற்றும்|మరియు|और)\s+/i;

function splitCompound(rawText: string, language: SupportedLanguageCode): { seg1: string; seg2: string } | null {
  if (detectUtteranceIntent(rawText)) return null; // never split a correction/removal/price/inventory utterance
  const match = rawText.match(CONNECTOR_PATTERN);
  if (!match || match.index === undefined) return null;
  const seg1 = rawText.slice(0, match.index).trim();
  const seg2 = rawText.slice(match.index + match[0].length).trim();
  if (!seg1 || !seg2) return null;
  if (!normalizeShoppingIntent(seg1, language).productQuery) return null;
  if (!normalizeShoppingIntent(seg2, language).productQuery) return null;
  return { seg1, seg2 };
}

function parseIntent(rawText: string, language: SupportedLanguageCode): ParsedIntent {
  const lower = rawText.toLowerCase();
  const orderId = extractOrderId(rawText);

  if (orderId && /cancel/.test(lower)) return { type: "cancel_order", orderId };
  if (orderId && /(status|track|where)/.test(lower)) return { type: "get_order_status", orderId };
  if (/(checkout|place( my)? order|confirm( my)? order|proceed to pay)/.test(lower)) return { type: "create_order" };
  if (/^(hi|hello|hey|namaste|vanakkam)\b/.test(lower.trim())) return { type: "help" };

  const utteranceIntent = detectUtteranceIntent(rawText);
  if (utteranceIntent === "cart_query") return { type: "get_cart" };

  // A correction ("actually make that 3 kilos") often does NOT restate the
  // product name at all — "that" refers back to whatever was just being
  // discussed, resolved from the current cart (see the "update_cart_quantity"
  // case below) — so this check must run even when productQuery ends up
  // empty, before the generic "no product mentioned -> help" fallback.
  if (utteranceIntent === "quantity_correction") {
    const normalized = normalizeShoppingIntent(rawText, language);
    if (normalized.quantity !== undefined) {
      return { type: "update_cart_quantity", query: normalized.productQuery, qty: normalized.quantity, unit: normalized.unit };
    }
  }

  // "Remove the basmati rice" / "remove that" — same reasoning as
  // corrections: the product may not be restated, so this must also run
  // before the "no product mentioned -> help" fallback below.
  if (utteranceIntent === "remove_item") {
    const normalized = normalizeShoppingIntent(rawText, language);
    return { type: "remove_from_cart", query: normalized.productQuery };
  }

  // A compound request ("I need rice and oil") is handled as two independent
  // product requests, the first processed now and the second queued —
  // never split a price/inventory/correction/removal utterance (guaranteed
  // by splitCompound checking detectUtteranceIntent itself).
  if (utteranceIntent === null) {
    const compound = splitCompound(rawText, language);
    if (compound) {
      const n1 = normalizeShoppingIntent(compound.seg1, language);
      return { type: "add_to_cart", query: n1.productQuery, qty: n1.quantity, unit: n1.unit, secondSegmentRaw: compound.seg2 };
    }
  }

  const normalized = normalizeShoppingIntent(rawText, language);
  if (!normalized.productQuery) return { type: "help" };

  // A question ABOUT a product ("How much is 2 kilos of basmati rice?", "How
  // many kilos of basmati rice are available?") must never be treated as an
  // instruction to add anything to the cart, even though it states a
  // quantity — this check runs BEFORE the quantity-based purchase heuristic
  // below specifically to prevent that misclassification.
  if (utteranceIntent === "price_query") {
    return { type: "price_query", query: normalized.productQuery, qty: normalized.quantity, unit: normalized.unit };
  }
  if (utteranceIntent === "inventory_query") {
    return { type: "inventory_query", query: normalized.productQuery, qty: normalized.quantity, unit: normalized.unit };
  }

  // Anything else that names a product — "I want rice", "add oil", "two
  // kilos of basmati rice", "मुझे चावल चाहिए" — is treated as a purchase
  // request and goes through the add_to_cart pipeline below, which itself
  // asks for clarification when the product is ambiguous or the quantity
  // is missing (never guesses either). Quantity is left undefined when not
  // stated, rather than defaulting to 1.
  return { type: "add_to_cart", query: normalized.productQuery, qty: normalized.quantity, unit: normalized.unit };
}

interface ToolExchange {
  toolCallId: string;
  name: string;
  content: string;
  args?: Record<string, any>;
}

function toolCall(name: string, args: Record<string, any>): AIToolCallRequest {
  return { id: `call_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name, arguments: args };
}

function respond(content: string): AIChatResponse {
  return { message: { role: "assistant", content }, finishReason: "stop" };
}

function respondWithTool(name: string, args: Record<string, any>): AIChatResponse {
  return { message: { role: "assistant", content: "", toolCalls: [toolCall(name, args)] }, finishReason: "tool_calls" };
}

function parseJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// --- Purchase pipeline: resolve a product, then check_inventory -> add_to_cart ---
//
// A tiny cursor over this turn's tool exchanges lets the SAME pipeline code
// serve every entry point (a fresh request, a resumed clarification, a
// resumed yes/no confirmation, or the second half of a compound request) —
// each call to chat() re-derives everything from `messages` (idempotent),
// consuming exchanges off the cursor exactly once per logical step.

class ExchangeCursor {
  private pos = 0;
  constructor(private exchanges: ToolExchange[]) {}
  next(): ToolExchange | undefined {
    return this.exchanges[this.pos];
  }
  advance(): void {
    this.pos += 1;
  }
}

type ItemOutcome =
  | { kind: "tool"; name: string; args: Record<string, any> }
  | { kind: "ambiguous"; query: string; names: string[]; unit: string | null; qty: number | undefined }
  | { kind: "need_quantity"; query: string; productId: string; productName: string; productUnit: string }
  | { kind: "not_found"; query: string }
  | { kind: "insufficient_stock"; productId: string; productName: string; stock: number }
  | { kind: "added"; productId: string; productName: string; qty: number; lineTotal: number };

function tokensOf(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function nameTokens(name: string): string[] {
  return name.toLowerCase().split(/\W+/).filter(Boolean);
}

function tokenMatches(token: string, word: string): boolean {
  return word === token || (token.length >= 3 && word.startsWith(token));
}

/**
 * Narrows a list of search results down to the ones actually distinguished
 * by the query, ignoring tokens that either match every candidate (generic
 * category words like "rice"/"oil" — these don't discriminate) or match
 * none of them (noise words like "more"/"also" that slipped through). If no
 * token discriminates at all (a purely generic query, or pure noise), the
 * full candidate list stands, so a genuinely generic query like "rice" still
 * surfaces all the distinct rice products for the ambiguity check below.
 */
function resolveCandidates(products: any[], queryTokens: string[]): any[] {
  if (queryTokens.length === 0 || products.length === 0) return products;
  const discriminating = queryTokens.filter((t) => {
    const presentCount = products.filter((p) => nameTokens(p.name).some((w) => tokenMatches(t, w))).length;
    return presentCount > 0 && presentCount < products.length;
  });
  if (discriminating.length === 0) return products;
  const strong = products.filter((p) => discriminating.every((t) => nameTokens(p.name).some((w) => tokenMatches(t, w))));
  return strong.length > 0 ? strong : products;
}

function purchaseTail(cur: ExchangeCursor, productId: string, productName: string, qty: number): ItemOutcome {
  const c1 = cur.next();
  if (!c1) return { kind: "tool", name: "check_inventory", args: { productId, requestedQty: qty } };
  cur.advance();
  const inv = parseJson(c1.content);
  if (!inv.available) return { kind: "insufficient_stock", productId, productName, stock: inv.stock ?? 0 };

  const c2 = cur.next();
  if (!c2) return { kind: "tool", name: "add_to_cart", args: { productId, qty } };
  cur.advance();
  const addResult = parseJson(c2.content);
  if (!addResult.ok) {
    if (addResult.error === "INSUFFICIENT_STOCK") return { kind: "insufficient_stock", productId, productName, stock: addResult.stock ?? 0 };
    return { kind: "not_found", query: productName };
  }
  const item = addResult.cart.items.find((i: any) => i.productId === productId);
  const lineTotal = Math.round((item?.unitPrice ?? 0) * qty * 100) / 100;
  return { kind: "added", productId, productName, qty, lineTotal };
}

function resolveProductThenTail(cur: ExchangeCursor, query: string, qty: number | undefined, unit: string | null): ItemOutcome {
  const c1 = cur.next();
  if (!c1) return { kind: "tool", name: "search_products", args: { query, limit: 5 } };
  cur.advance();
  const data = parseJson(c1.content);
  const products = data.products ?? [];
  if (products.length === 0) return { kind: "not_found", query };

  const candidates = resolveCandidates(products, tokensOf(query));
  const distinctNames = Array.from(new Set(candidates.map((p: any) => p.name)));
  if (distinctNames.length > 1) {
    return { kind: "ambiguous", query, names: distinctNames.slice(0, 4) as string[], unit, qty };
  }
  const top = candidates[0];
  const productId = top.productId;
  const productName = `${top.brand} ${top.name}`;
  if (qty === undefined) return { kind: "need_quantity", query, productId, productName, productUnit: top.quantity };
  return purchaseTail(cur, productId, productName, qty);
}

const UNIT_SPOKEN: Record<string, string> = { kg: "kilos", g: "grams", l: "litres", ml: "millilitres", pcs: "units", dozen: "units" };

function unitLabelFromQuantity(q: string): string {
  const raw = String(q).replace(/^[\d.]+\s*/, "").toLowerCase();
  return UNIT_SPOKEN[raw] ?? raw;
}

function textFor(item: ItemOutcome, phrases: Phrases): string {
  switch (item.kind) {
    case "not_found":
      return phrases.notFound(item.query);
    case "added":
      return phrases.addedToCart(item.qty, item.productName, item.lineTotal);
    case "insufficient_stock":
      return phrases.offerAvailableInstead(item.productName, item.stock);
    default:
      return "";
  }
}

/** Produces the final response for a terminal outcome (added / not_found / insufficient_stock). */
function responseForTerminal(item: ItemOutcome, phrases: Phrases, textOverride?: string): AIChatResponse {
  const content = textOverride ?? textFor(item, phrases);
  if (item.kind === "insufficient_stock") {
    const contextUpdate: ConversationContextUpdate = {
      pendingConfirmation: { action: "add_to_cart", productId: item.productId, productName: item.productName, qty: item.stock },
      pendingClarification: null,
    };
    return { message: { role: "assistant", content }, finishReason: "stop", contextUpdate };
  }
  const contextUpdate: ConversationContextUpdate =
    item.kind === "added"
      ? { pendingClarification: null, lastDiscussedProductId: item.productId, lastDiscussedProductName: item.productName }
      : { pendingClarification: null };
  return { message: { role: "assistant", content }, finishReason: "stop", contextUpdate };
}

/** Produces the response for a non-terminal outcome (ambiguous / need_quantity), setting up the next clarification. */
function responseForPending(item: ItemOutcome, queuedSegment: string | null | undefined, textPrefix: string, phrases: Phrases): AIChatResponse {
  const prefix = textPrefix ? `${textPrefix} ` : "";
  if (item.kind === "ambiguous") {
    const options = item.names.join(", ");
    const content = prefix + (item.qty === undefined ? phrases.askWhichProductAndQuantity(options) : phrases.askWhichProduct(options));
    const pendingClarification: PendingClarification = {
      awaiting: item.qty === undefined ? "product_and_quantity" : "product",
      query: item.query,
      unit: item.unit,
      pendingQty: item.qty,
      queuedSegment: queuedSegment ?? undefined,
    };
    return { message: { role: "assistant", content }, finishReason: "stop", contextUpdate: { pendingClarification } };
  }
  if (item.kind === "need_quantity") {
    const content = prefix + phrases.askQuantity(item.productName, unitLabelFromQuantity(item.productUnit));
    const pendingClarification: PendingClarification = {
      awaiting: "quantity",
      query: item.query,
      productId: item.productId,
      productName: item.productName,
      queuedSegment: queuedSegment ?? undefined,
    };
    return {
      message: { role: "assistant", content },
      finishReason: "stop",
      contextUpdate: { pendingClarification, lastDiscussedProductId: item.productId, lastDiscussedProductName: item.productName },
    };
  }
  // Should not be reached for terminal kinds; callers only pass ambiguous/need_quantity here.
  return { message: { role: "assistant", content: prefix }, finishReason: "stop" };
}

// --- Cart-aware resolution for corrections ("make that 3") and removals ---
//
// Resolves WHICH cart line a correction/removal refers to against the
// CUSTOMER'S ACTUAL CART (via get_cart), not a fresh catalog search — a
// generic query like "the rice" should mean whichever rice is actually in
// the cart, not whatever the catalog search ranks first. Falls back to the
// session's most-recently-discussed product, then the last cart line, when
// no product is restated at all ("actually make that 3 kilos").

function findCartMatches(items: any[], query: string): any[] {
  const tokens = tokensOf(query);
  if (tokens.length === 0) return [];
  return items.filter((item) => {
    const words = `${item.name} ${item.brand}`.toLowerCase().split(/\W+/).filter(Boolean);
    return tokens.some((t) => words.some((w) => tokenMatches(t, w)));
  });
}

// --- Yes/no confirmation detection ---

const YES_MARKERS = ["yes", "yeah", "yep", "sure", "okay", "ok", "please do", "go ahead", "confirm", "हाँ", "हां", "ठीक है", "சரி", "ஆம்", "అవును", "సరే"];
const NO_MARKERS = ["no thanks", "no thank you", "nope", "nah", "never mind", "cancel that", "नहीं", "வேண்டாம்", "இல்லை", "వద్దు", "కాదు", "no"];

function detectYesNo(text: string): "yes" | "no" | null {
  const lower = text.toLowerCase().trim();
  if (NO_MARKERS.some((m) => lower === m || lower.startsWith(`${m} `) || lower.includes(m))) return "no";
  if (YES_MARKERS.some((m) => lower === m || lower.startsWith(`${m} `) || lower.includes(m))) return "yes";
  return null;
}

function looksLikeCompetingIntent(rawText: string): boolean {
  const lower = rawText.toLowerCase();
  if (/(checkout|place( my)? order|confirm( my)? order|proceed to pay)/.test(lower)) return true;
  if (extractOrderId(rawText)) return true;
  if (/^(hi|hello|hey|namaste|vanakkam)\b/.test(lower.trim())) return true;
  const ui = detectUtteranceIntent(rawText);
  return ui === "quantity_correction" || ui === "remove_item" || ui === "cart_query" || ui === "price_query" || ui === "inventory_query";
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async chat({ messages }: AIChatRequest): Promise<AIChatResponse> {
    const language = detectLanguageFromSystemPrompt(messages);
    const phrases = PHRASES[language];
    const context = detectContextFromSystemPrompt(messages);

    const lastUserIndex = findLastIndex(messages, (m) => m.role === "user");
    if (lastUserIndex === -1) {
      return respond(phrases.greeting);
    }
    const lastUser = messages[lastUserIndex];
    const rawText = lastUser.content;
    const exchanges = collectToolExchangesSince(messages, lastUserIndex);

    // Highest priority: a pending yes/no confirmation (e.g. "only 3 available,
    // want 3 instead?"). A reply that isn't recognizably yes/no falls through
    // to normal handling, leaving the confirmation pending for later.
    if (context.pendingConfirmation) {
      if (exchanges.length === 0) {
        const yn = detectYesNo(rawText);
        if (yn === "no") {
          return { message: { role: "assistant", content: phrases.confirmationCancelled }, finishReason: "stop", contextUpdate: { pendingConfirmation: null } };
        }
        if (yn === "yes") {
          const pc = context.pendingConfirmation;
          const tail = purchaseTail(new ExchangeCursor([]), pc.productId, pc.productName, pc.qty);
          if (tail.kind === "tool") return respondWithTool(tail.name, tail.args);
          return responseForTerminal(tail, phrases);
        }
      } else {
        const pc = context.pendingConfirmation;
        const tail = purchaseTail(new ExchangeCursor(exchanges), pc.productId, pc.productName, pc.qty);
        if (tail.kind === "tool") return respondWithTool(tail.name, tail.args);
        return responseForTerminal(tail, phrases);
      }
    }

    // Next: a pending clarification from a previous turn, unless this
    // utterance is clearly about something else (viewing the cart, an
    // order, a correction/removal, a greeting).
    if (context.pendingClarification && !looksLikeCompetingIntent(rawText)) {
      return handlePendingClarification(context.pendingClarification, rawText, language, exchanges, phrases);
    }

    const intent = parseIntent(rawText, language);

    switch (intent.type) {
      case "help":
        return respond(`${phrases.greeting} ${phrases.genericHelp}`);

      // Pipeline: search_products -> check_inventory -> add_to_cart, with
      // ambiguity and missing-quantity clarification, and optional chaining
      // into a second product from a compound "X and Y" request. See
      // resolveProductThenTail/purchaseTail above.
      case "add_to_cart": {
        const cursor = new ExchangeCursor(exchanges);
        const item1 = resolveProductThenTail(cursor, intent.query ?? "", intent.qty, intent.unit ?? null);
        if (item1.kind === "tool") return respondWithTool(item1.name, item1.args);
        if (item1.kind === "ambiguous" || item1.kind === "need_quantity") {
          return responseForPending(item1, intent.secondSegmentRaw, "", phrases);
        }
        const text1 = textFor(item1, phrases);
        if (!intent.secondSegmentRaw) return responseForTerminal(item1, phrases);

        const seg2 = normalizeShoppingIntent(intent.secondSegmentRaw, language);
        const item2 = resolveProductThenTail(cursor, seg2.productQuery, seg2.quantity, seg2.unit);
        if (item2.kind === "tool") return respondWithTool(item2.name, item2.args);
        if (item2.kind === "ambiguous" || item2.kind === "need_quantity") {
          return responseForPending(item2, null, text1, phrases);
        }
        return responseForTerminal(item2, phrases, `${text1} ${textFor(item2, phrases)}`);
      }

      // Correction to a quantity already discussed ("actually make that 3
      // kilos", "change it to 4", "I only want 1"). Resolves WHICH product
      // against the customer's actual cart: a restated name is matched
      // against cart line items (never a fresh catalog search, which could
      // resolve to a product not even in the cart); otherwise falls back to
      // the most recently discussed product, then the cart's last item.
      // Always sets the ABSOLUTE final quantity via update_cart_quantity —
      // NEVER add_to_cart, which would incorrectly ADD on top of what's
      // already there (2 + 3 = 5, not the intended 3).
      case "update_cart_quantity": {
        if (exchanges.length === 0) return respondWithTool("get_cart", {});
        const cart = parseJson(exchanges[0].content);
        const items = cart.items ?? [];

        let target: any;
        if (intent.query) {
          const matches = findCartMatches(items, intent.query);
          if (matches.length > 1) {
            const names = matches.map((m: any) => `${m.brand} ${m.name}`);
            const pendingClarification: PendingClarification = {
              awaiting: "cart_item",
              query: intent.query,
              action: "update_cart_quantity",
              pendingQty: intent.qty,
            };
            return { message: { role: "assistant", content: phrases.askWhichProduct(names.join(", ")) }, finishReason: "stop", contextUpdate: { pendingClarification } };
          }
          target = matches[0];
          if (!target) return respond(phrases.notFound(intent.query));
        } else {
          target = items.find((i: any) => i.productId === context.lastDiscussedProductId) ?? items[items.length - 1];
          if (!target) return respond(phrases.emptyCart);
        }

        if (exchanges.length === 1) return respondWithTool("update_cart_quantity", { productId: target.productId, quantity: intent.qty ?? 0 });

        const updateResult = parseJson(exchanges[1].content);
        const displayName = `${target.brand} ${target.name}`;
        if (!updateResult.ok) {
          if (updateResult.error === "INSUFFICIENT_STOCK") return respond(phrases.insufficientStock(displayName, updateResult.stock ?? 0));
          return respond(phrases.notFound(displayName));
        }
        if (updateResult.removed) {
          return {
            message: { role: "assistant", content: phrases.itemRemoved(displayName) },
            finishReason: "stop",
            contextUpdate: { pendingClarification: null, lastDiscussedProductId: null, lastDiscussedProductName: null },
          };
        }
        const item = updateResult.cart.items.find((i: any) => i.productId === target.productId);
        if (!item) return respond(phrases.genericHelp);
        return {
          message: { role: "assistant", content: phrases.quantityUpdated(item.qty, displayName, item.lineTotal) },
          finishReason: "stop",
          contextUpdate: { pendingClarification: null, lastDiscussedProductId: target.productId, lastDiscussedProductName: displayName },
        };
      }

      // "Remove the basmati rice" / "remove that" — same cart-aware
      // resolution as update_cart_quantity above.
      case "remove_from_cart": {
        if (exchanges.length === 0) return respondWithTool("get_cart", {});
        const cart = parseJson(exchanges[0].content);
        const items = cart.items ?? [];

        let target: any;
        if (intent.query) {
          const matches = findCartMatches(items, intent.query);
          if (matches.length > 1) {
            const names = matches.map((m: any) => `${m.brand} ${m.name}`);
            const pendingClarification: PendingClarification = { awaiting: "cart_item", query: intent.query, action: "remove_from_cart" };
            return { message: { role: "assistant", content: phrases.askWhichProduct(names.join(", ")) }, finishReason: "stop", contextUpdate: { pendingClarification } };
          }
          target = matches[0];
          if (!target) return respond(phrases.notFound(intent.query));
        } else {
          target = items.find((i: any) => i.productId === context.lastDiscussedProductId) ?? items[items.length - 1];
          if (!target) return respond(phrases.emptyCart);
        }

        if (exchanges.length === 1) return respondWithTool("remove_from_cart", { productId: target.productId });

        const removeResult = parseJson(exchanges[1].content);
        const displayName = `${target.brand} ${target.name}`;
        if (!removeResult.ok) return respond(phrases.notFound(displayName));
        return {
          message: { role: "assistant", content: phrases.itemRemoved(displayName) },
          finishReason: "stop",
          contextUpdate: { pendingClarification: null, lastDiscussedProductId: null, lastDiscussedProductName: null },
        };
      }

      // Price question ("How much is 2 kilos of basmati rice?", "What is the
      // price of basmati rice?") — looks up the real product and price via
      // search_products, then (if a quantity was stated) calculates the
      // total using the product's actual pack size. NEVER calls
      // check_inventory or add_to_cart — a price question must not touch
      // the cart.
      case "price_query": {
        if (exchanges.length === 0) {
          return respondWithTool("search_products", { query: intent.query, limit: 1 });
        }
        const data = parseJson(exchanges[0].content);
        if (!data.products || data.products.length === 0) return respond(phrases.notFound(intent.query ?? ""));
        const top = data.products[0];

        if (intent.qty !== undefined) {
          const packs = computePacksNeeded(intent.qty, intent.unit ?? null, top.quantity);
          const total = Math.round(top.price * packs * 100) / 100;
          const qtyLabel = `${intent.qty}${intent.unit ? ` ${intent.unit}` : ""}`;
          return respond(phrases.priceForQuantity(top.name, top.brand, top.quantity, top.price, qtyLabel, total));
        }
        return respond(phrases.priceInfo(top.name, top.brand, top.quantity, top.price));
      }

      // Inventory question ("How many kilos of basmati rice are
      // available?") — looks up the product then checks real stock via
      // check_inventory, but NEVER calls add_to_cart.
      case "inventory_query": {
        if (exchanges.length === 0) {
          return respondWithTool("search_products", { query: intent.query, limit: 1 });
        }
        if (exchanges.length === 1 && exchanges[0].name === "search_products") {
          const data = parseJson(exchanges[0].content);
          if (!data.products || data.products.length === 0) return respond(phrases.notFound(intent.query ?? ""));
          const top = data.products[0];
          return respondWithTool("check_inventory", { productId: top.productId, requestedQty: intent.qty ?? 1 });
        }
        const inventory = parseJson(exchanges[1].content);
        const searchData = parseJson(exchanges[0].content);
        const top = searchData.products?.[0];
        const displayName = top ? `${top.brand} ${top.name}` : intent.query ?? "";
        const unitLabel = top?.quantity ? String(top.quantity).replace(/^[\d.]+\s*/, "") : "";
        return respond(phrases.stockInfo(displayName, inventory.stock ?? 0, unitLabel));
      }

      // Cart-content questions ("what's in my cart", "what did I add",
      // "show me my cart") must list the ACTUAL items get_cart returned —
      // never just the count/subtotal, and never invented. See
      // cartItemLine/cartSummary in localization.ts.
      case "get_cart": {
        if (exchanges.length === 0) return respondWithTool("get_cart", {});
        const data = parseJson(exchanges[0].content);
        if (!data.items || data.items.length === 0) return respond(phrases.emptyCart);
        const itemLines = data.items
          .map((item: any) => phrases.cartItemLine(item.qty, unitLabelFromQuantity(item.quantityLabel), `${item.brand} ${item.name}`, item.lineTotal))
          .join(", ");
        return respond(phrases.cartSummary(data.items.length, itemLines, data.subtotal));
      }

      case "create_order": {
        if (exchanges.length === 0) return respondWithTool("create_order", {});
        const data = parseJson(exchanges[0].content);
        if (!data.ok) return respond(phrases.emptyCart);
        return respond(phrases.orderPlaced(data.order.orderId, data.order.total, data.order.estimatedDeliveryMinutes));
      }

      case "get_order_status": {
        if (exchanges.length === 0) return respondWithTool("get_order_status", { orderId: intent.orderId });
        const data = parseJson(exchanges[0].content);
        if (!data.ok) return respond(phrases.orderNotFound(intent.orderId ?? ""));
        return respond(phrases.orderStatus(data.order.orderId, data.order.status));
      }

      case "cancel_order": {
        if (exchanges.length === 0) return respondWithTool("cancel_order", { orderId: intent.orderId });
        const data = parseJson(exchanges[0].content);
        if (!data.ok) return respond(phrases.orderNotFound(intent.orderId ?? ""));
        return respond(phrases.orderCancelled(data.order.orderId));
      }

      default:
        return respond(phrases.genericHelp);
    }
  }
}

/**
 * Resolves a pending clarification from a previous turn using this turn's
 * (short) reply: a bare product name ("basmati"), a bare quantity ("2
 * kilos"), or both. Reuses the exact same resolveProductThenTail/
 * purchaseTail pipeline as a fresh request — the cursor naturally continues
 * across however many chat() calls this turn takes — so ambiguity, missing
 * quantity, insufficient stock, and a queued second product from an earlier
 * compound request all compose for free.
 */
function handlePendingClarification(
  pcl: PendingClarification,
  rawText: string,
  language: SupportedLanguageCode,
  exchanges: ToolExchange[],
  phrases: Phrases
): AIChatResponse {
  const cursor = new ExchangeCursor(exchanges);

  if (pcl.awaiting === "cart_item") {
    return handleCartItemClarification(pcl, rawText, exchanges, phrases);
  }

  let item1: ItemOutcome;
  if (pcl.awaiting === "quantity") {
    const norm = normalizeShoppingIntent(rawText, language);
    const qty = norm.quantity ?? pcl.pendingQty;
    if (qty === undefined) {
      return { message: { role: "assistant", content: phrases.askQuantity(pcl.productName ?? "", "") }, finishReason: "stop" };
    }
    item1 = purchaseTail(cursor, pcl.productId!, pcl.productName!, qty);
  } else {
    const norm = normalizeShoppingIntent(rawText, language);
    const query = norm.productQuery || rawText.trim();
    const qty = norm.quantity ?? pcl.pendingQty;
    item1 = resolveProductThenTail(cursor, query, qty, norm.unit ?? pcl.unit ?? null);
  }

  if (item1.kind === "tool") return respondWithTool(item1.name, item1.args);
  if (item1.kind === "ambiguous" || item1.kind === "need_quantity") {
    return responseForPending(item1, pcl.queuedSegment, "", phrases);
  }
  const text1 = textFor(item1, phrases);
  if (!pcl.queuedSegment) return responseForTerminal(item1, phrases);

  const seg2 = normalizeShoppingIntent(pcl.queuedSegment, language);
  const item2 = resolveProductThenTail(cursor, seg2.productQuery, seg2.quantity, seg2.unit);
  if (item2.kind === "tool") return respondWithTool(item2.name, item2.args);
  if (item2.kind === "ambiguous" || item2.kind === "need_quantity") {
    return responseForPending(item2, null, text1, phrases);
  }
  return responseForTerminal(item2, phrases, `${text1} ${textFor(item2, phrases)}`);
}

/** Resolves an ambiguous correction/removal ("You have both X and Y — which one?") using the customer's reply. */
function handleCartItemClarification(pcl: PendingClarification, rawText: string, exchanges: ToolExchange[], phrases: Phrases): AIChatResponse {
  if (exchanges.length === 0) return respondWithTool("get_cart", {});
  const cart = parseJson(exchanges[0].content);
  const items = cart.items ?? [];
  const target = findCartMatches(items, rawText)[0] ?? findCartMatches(items, pcl.query)[0];
  if (!target) {
    return { message: { role: "assistant", content: phrases.notFound(pcl.query) }, finishReason: "stop", contextUpdate: { pendingClarification: null } };
  }
  const displayName = `${target.brand} ${target.name}`;

  if (pcl.action === "remove_from_cart") {
    if (exchanges.length === 1) return respondWithTool("remove_from_cart", { productId: target.productId });
    const removeResult = parseJson(exchanges[1].content);
    if (!removeResult.ok) {
      return { message: { role: "assistant", content: phrases.notFound(displayName) }, finishReason: "stop", contextUpdate: { pendingClarification: null } };
    }
    return {
      message: { role: "assistant", content: phrases.itemRemoved(displayName) },
      finishReason: "stop",
      contextUpdate: { pendingClarification: null, lastDiscussedProductId: null, lastDiscussedProductName: null },
    };
  }

  if (exchanges.length === 1) return respondWithTool("update_cart_quantity", { productId: target.productId, quantity: pcl.pendingQty ?? 0 });
  const updateResult = parseJson(exchanges[1].content);
  if (!updateResult.ok) {
    const content = updateResult.error === "INSUFFICIENT_STOCK" ? phrases.insufficientStock(displayName, updateResult.stock ?? 0) : phrases.notFound(displayName);
    return { message: { role: "assistant", content }, finishReason: "stop", contextUpdate: { pendingClarification: null } };
  }
  const item = updateResult.cart.items.find((i: any) => i.productId === target.productId);
  const content = item ? phrases.quantityUpdated(item.qty, displayName, item.lineTotal) : phrases.genericHelp;
  return {
    message: { role: "assistant", content },
    finishReason: "stop",
    contextUpdate: { pendingClarification: null, lastDiscussedProductId: target.productId, lastDiscussedProductName: displayName },
  };
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

function collectToolExchangesSince(messages: AIMessage[], sinceIndex: number): ToolExchange[] {
  const exchanges: ToolExchange[] = [];
  for (let i = sinceIndex + 1; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "tool" && m.name) {
      const args = findOriginatingArgs(messages, m.toolCallId);
      exchanges.push({ toolCallId: m.toolCallId ?? "", name: m.name, content: m.content, args });
    }
  }
  return exchanges;
}

function findOriginatingArgs(messages: AIMessage[], toolCallId?: string): Record<string, any> | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.toolCalls) {
      const match = m.toolCalls.find((tc) => tc.id === toolCallId);
      if (match) return match.arguments;
    }
  }
  return undefined;
}

function detectLanguageFromSystemPrompt(messages: AIMessage[]): SupportedLanguageCode {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const match = system.match(/LANGUAGE_CODE:(en|ta|te|hi)/);
  return (match?.[1] as SupportedLanguageCode) ?? "en";
}

function detectContextFromSystemPrompt(messages: AIMessage[]): ConversationContext {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const match = system.match(/CONTEXT_JSON:(\{.*\})/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}
