# Architecture

## Overview

```
frontend/   React + TypeScript + Vite + Tailwind — GroceryNxt storefront, voice widget, dashboard
backend/    Node.js + TypeScript + Fastify — mock GroceryNxt API, AI orchestration, tool calling
docs/       This documentation
```

## Backend module layout

```
backend/src/
  config/       env.ts — loads and types all environment variables
  types/        shared TypeScript types (Product, Cart, Order, Conversation, Language, Telephony)
  data/         mock GroceryNxt catalog (products.ts) and in-memory store (store.ts — carts, orders,
                conversation sessions, and phone calls)
  services/     business logic — productService, cartService, orderService, aiService (the one AI brain),
                callService (phone-call orchestration on top of aiService), dashboardService,
                localization (per-language phrase templates)
  providers/
    ai/         AIProvider interface + OpenAIProvider + MockAIProvider (fallback, no API key needed)
    telephony/  TelephonyProvider interface + MockTelephonyProvider (local call simulation) +
                TwilioTelephonyProvider (documented stub, no credentials required to load)
  tools/        toolDefinitions.ts (provider-agnostic function-calling schemas) +
                toolExecutor.ts (dispatches a tool call to the matching service function)
  controllers/  Fastify request handlers, one per resource
  routes/       Fastify route registration, one per resource
  app.ts        builds the Fastify app (CORS, route registration)
  server.ts     boots the HTTP server
```

## Why a mock data layer

GroceryNxt's real backend/database is not available. `data/products.ts` is a realistic, hand-authored
catalog (rice, atta, dal, oil, milk, biscuits, snacks, vegetables, fruits, beverages, household) with
id/name/brand/category/quantity/price/discount/stock on every item. `services/productService.ts`,
`cartService.ts`, and `orderService.ts` are the only code paths allowed to read or mutate this data.
`data/store.ts` is an in-memory substitute for a real database (carts, orders, conversation sessions) —
swap it for a real DB by replacing that module's exports; nothing else needs to change.

## AI tool-calling loop

1. `services/aiService.ts` builds a system prompt (in the customer's selected language) instructing the
   model to never invent price/stock/order data and to always call a tool first.
2. It calls `AIProvider.chat({ messages, tools })` via `providers/ai/index.ts`, which resolves to
   `OpenAIProvider` if `OPENAI_API_KEY` is set, or `MockAIProvider` otherwise.
3. If the model requests tool calls, `tools/toolExecutor.ts` executes them against the mock services and
   the results are fed back into the conversation as `tool` role messages.
4. The loop repeats (capped at `MAX_TOOL_ITERATIONS`) until the model returns a final natural-language
   reply, which is stored in the session transcript and returned to the caller.

This loop is identical regardless of which `AIProvider` is active — the mock provider implements the same
multi-step tool-call contract (search_products → check_inventory → add_to_cart, or search → resolve →
mutate → confirm more generally) using simple keyword/quantity parsing instead of a real LLM, so the whole
product (frontend, cart, orders, dashboard) is fully exercised without any API credentials. Swapping in a
real OpenAI key immediately upgrades language understanding without any other code changes.

Every tool call made during the loop is recorded as `{ tool, status: "completed" | "error" }` and returned
to the caller alongside the reply (see `POST /api/agent/chat` in `docs/API.md`) — useful for the frontend,
tests, and debugging to see exactly which tools ran for a given request. See `docs/VOICE.md` for the full
browser voice pipeline this endpoint sits behind.

## Provider abstractions

- **`AIProvider`** (`providers/ai/AIProvider.ts`): `chat()`, plus optional `transcribeAudio()` /
  `synthesizeSpeech()`. Add a new vendor by implementing this interface and wiring it into
  `providers/ai/index.ts`.
- **`TelephonyProvider`** (`providers/telephony/TelephonyProvider.ts`): `onInboundCall()`, `answerCall()`,
  `endCall()`, `playAudio()`, `receiveAudio()`, `getCallStatus()`, `simulateInboundCall()`. See
  `docs/TELEPHONY.md` for the phone-call architecture and real-phone integration path.

## Frontend module layout

```
frontend/src/
  components/            Header, CategoryNav, ProductGrid/ProductCard, CartDrawer, CheckoutModal
  components/VoiceAssistant/  VoiceHero (the "Talk to GroceryNxt AI" hero), AssistantPanel (transcript +
                          mic controls), FloatingAssistant (collapsed/expanded panel + mobile sheet),
                          LanguageSelector, ConversationTranscript, StatusIndicator, VoiceWaveform
  components/Dashboard/  StatCard, Dashboard, PhoneCallSimulator (mock phone-call demo, see docs/TELEPHONY.md)
  hooks/                 useSpeechRecognition (browser STT), useSpeechSynthesis (browser TTS),
                          useVoiceAssistant (orchestrates both + backend calls), useApiHealth
  context/               CartContext, LanguageContext, VoiceAssistantContext (one shared voice session
                          used by both VoiceHero and FloatingAssistant)
  services/api.ts        typed fetch wrapper around the backend REST API
  pages/                 HomePage (storefront), DashboardPage
```

See `docs/VOICE.md` for the full browser voice pipeline (why STT/TTS run client-side, why the OpenAI key
never leaves the backend, and how the pieces above fit together).
