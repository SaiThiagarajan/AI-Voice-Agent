# AI Voice Agent Platform — GroceryNxt Demo

A multilingual AI voice-agent platform. The first demo integration is **GroceryNxt**, a mock grocery
e-commerce storefront: customers can talk (or type) to an AI shopping assistant in English, Tamil,
Telugu, or Hindi, and it searches a realistic mock product catalog, checks real stock/price data, adds
items to a cart, and places mock orders — all without ever inventing business data itself.

There is no access to a real GroceryNxt backend, so `backend/src/data/products.ts` is a hand-built mock
catalog and data layer standing in for it.

## Problem

Grocery delivery apps in India serve customers across many languages, and typing a shopping list on a
small screen is slower and more error-prone than just saying it. A voice-first assistant needs to do three
things reliably at once: understand natural, code-switched, multilingual speech; never guess at business
facts (price, stock, order status) that only the store's own systems actually know; and behave identically
whether the customer is talking through a browser or on a phone call. This project is a working,
end-to-end demonstration of that pattern — LLM tool-calling grounded in authoritative backend services —
built without needing a real grocery backend, a real phone carrier, or even a real LLM API key to run and
be evaluated.

## Architecture

```
Frontend (React)             Phone call (mock or future Twilio)
      |                              |
      v                              v
Backend REST API (Fastify)  <---  TelephonyProvider
      |
      v
aiService.sendMessage()  (the ONE AI brain — same for browser and phone)
      |
      v
AIProvider.chat()  --->  OpenAI (if OPENAI_API_KEY set) | MockAIProvider (rule-based fallback)
      |
      v
Tool call requested (search_products, add_to_cart, create_order, ...)
      |
      v
toolExecutor.ts  --->  productService / cartService / orderService
      |
      v
Mock GroceryNxt data layer (data/products.ts, data/store.ts) — the only source of truth
```

The model never touches price, stock, cart, or order data directly — it can only read or change that state
by calling a tool, and every tool call is executed against the same backend services regardless of which
`AIProvider` answered, or whether the customer is on the web widget or the phone simulator. See
`docs/ARCHITECTURE.md` for the full module-by-module breakdown, and `docs/VOICE.md` /
`docs/TELEPHONY.md` for the two input channels.

## Features

- Multilingual voice interaction (English, Tamil, Telugu, Hindi) — see `docs/MULTILINGUAL.md`
- LLM tool-calling grounded in authoritative backend services (search, inventory, cart, orders)
- Cross-turn conversation context (clarifying questions, quantity corrections, "add that too")
- Product search, real inventory checks, cart management, mock order placement/cancellation
- Browser voice input/output (Web Speech API) with graceful text-input fallback on unsupported browsers
- A phone-call simulator that exercises the identical AI/tool pipeline as browser voice, no real telephony
  involved — plus a `TelephonyProvider` abstraction already shaped for a real Twilio integration later
- An `AIProvider` abstraction with a rule-based `MockAIProvider` fallback, so the entire product — storefront,
  voice, dashboard, phone simulator — runs and can be graded with zero API credentials

## Tech Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router

**Backend:** Node.js, TypeScript, Fastify, Zod, an in-memory data store standing in for a real database

**AI:** OpenAI (function/tool calling) behind a provider abstraction, with a deterministic rule-based
`MockAIProvider` fallback — see [Architecture Decisions](#architecture-decisions)

**Telephony:** `TelephonyProvider` abstraction with a local `MockTelephonyProvider`, and a documented
`TwilioTelephonyProvider` stub for a future real integration (see `docs/TELEPHONY.md`)

## Testing

```bash
# Backend — 126 tests: conversation flow, cart/inventory invariants, multilingual parsing,
# provider behavior, HTTP-level route validation
cd backend
npm test          # run the suite
npm run typecheck  # tsc --noEmit
npm run build      # tsc -p tsconfig.build.json

# Frontend — component + hook tests (React Testing Library / Vitest)
cd frontend
npm test
npm run typecheck
npm run build      # tsc -b && vite build
```

Backend tests drive the real `aiService.sendMessage()` / `MockAIProvider` / service layer directly (no
mocked business logic), including HTTP-level tests via Fastify's `app.inject()` for route validation.
Frontend tests cover the speech-recognition hook's lifecycle/error handling and cart UI error states with
mocked API calls.

## Local Setup

Requires Node.js 20+.

```bash
# 1. Backend
cd backend
cp .env.example .env      # optionally set OPENAI_API_KEY for real AI responses
npm install
npm run dev                # http://localhost:4000

# 2. Frontend (in a second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

Open http://localhost:5173, click **"Talk to GroceryNxt AI"**, allow microphone access, and say:

> "I need two kilos of basmati rice."

(Voice input requires a Chromium-based browser — Chrome/Edge — for the Web Speech API. Other browsers
fall back to a text input in the same widget.)

Visit http://localhost:5173/dashboard for the live agent dashboard — including a **Phone Call Simulator**
card that exercises the exact same AI/tool-calling pipeline over a simulated inbound phone call (no real
phone number or Twilio account involved).

### Environment variables

**backend/.env**

| Variable | Required | Purpose |
|---|---|---|
| `PORT`, `HOST` | no | Server bind address (default `4000` / `0.0.0.0`) |
| `CORS_ORIGIN` | no | Allowed frontend origin(s), comma-separated |
| `OPENAI_API_KEY` | **no** — enables real AI | Without it, a rule-based mock AI provider is used |
| `OPENAI_MODEL` | no | Chat model, default `gpt-4o-mini` |
| `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`, `OPENAI_STT_MODEL` | no | Only used by the optional server-side `/api/agent/speak` endpoint; the browser demo doesn't need these |
| `TELEPHONY_PROVIDER` | no | `mock` (default) — see `docs/TELEPHONY.md` |
| `TWILIO_*` | no | Placeholders for a future real telephony integration; unused today |

**frontend/.env**

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | no | Backend URL, default `http://localhost:4000` |

No secrets are ever sent to or stored in the frontend; the OpenAI key lives only in the backend process.

### What works without any API credentials

- The entire storefront: browsing, search, categories, cart, mock checkout
- Voice input/output in the browser (Web Speech API — no backend audio calls involved)
- The AI agent's tool-calling flow — search → resolve product → add to cart → checkout → order status —
  driven by a rule-based `MockAIProvider` with per-language canned responses
- The agent dashboard (call counts, language breakdown, recent conversations, orders) — automatically
  includes both browser and simulated phone-call sessions, since both write into the same conversation store
- The full mock **phone call simulation** (`/api/calls/*`, `MockTelephonyProvider`, and the Dashboard's
  Phone Call Simulator): incoming call → answer → multi-turn conversation in any of the 4 languages → end
  call, all answered by the same `search_products → check_inventory → add_to_cart` pipeline as the browser

### What requires real credentials

- Natural, open-ended multilingual understanding (rather than keyword matching) requires
  `OPENAI_API_KEY` set in `backend/.env` — this swaps `MockAIProvider` for `OpenAIProvider` with zero
  other code changes, for both the browser and phone-call channels.
- Server-side text-to-speech/transcription via `/api/agent/speak` and `AIProvider.transcribeAudio()` also
  require `OPENAI_API_KEY`.
- Anything under `TwilioTelephonyProvider` or the `/api/telephony/twilio/*` webhooks doing real work —
  today they are documented stubs that throw or return a placeholder rather than pretending to place a
  real call (see `docs/TELEPHONY.md`).

## API

Full endpoint reference: `docs/API.md`. Summary:

| Area | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Products | `GET /api/products`, `/api/products/categories`, `/api/products/:id`, `/api/products/:id/inventory` |
| Cart | `GET /api/cart`, `POST /api/cart/items`, `DELETE /api/cart/items` |
| Orders | `GET /api/orders`, `POST /api/orders`, `GET /api/orders/:orderId`, `POST /api/orders/:orderId/cancel` |
| AI Agent | `POST /api/agent/chat`, `GET /api/agent/session/:id`, `POST /api/agent/session/:id/end`, `POST /api/agent/speak` |
| Dashboard | `GET /api/dashboard` |
| Phone calls (mock) | `POST /api/calls/simulate`, `POST /api/calls/:callId/message`, `GET /api/calls/:callId`, `POST /api/calls/:callId/end` |
| Telephony webhooks (stubs) | `POST /api/telephony/twilio/incoming`, `/status`, `/media` |

## Architecture Decisions

**Why an `AIProvider` abstraction exists.** The rest of the app (`aiService`, `toolExecutor`, every route
and controller) talks to `AIProvider.chat({ messages, tools })` and never to the OpenAI SDK directly. That
means swapping models, adding a second vendor, or running fully offline is a one-file change in
`providers/ai/index.ts` — nothing about conversation handling, tool execution, or business logic needs to
know which model answered.

**Why `MockAIProvider` exists.** A grading/demo environment shouldn't require a paid API key to prove the
architecture works. `MockAIProvider` is a small, table-driven rule engine (see
`services/queryNormalization.ts`) that drives the *exact same* tool-calling contract
(`search_products → check_inventory → add_to_cart`, corrections via `update_cart_quantity`, etc.) as the
system prompt asks the real model to follow. It is explicitly **not** a general NLP pipeline — it's scoped
to the specific conversational patterns this app needs (ambiguous product → clarify, quantity corrections,
removals, yes/no confirmations, multilingual keyword extraction), and its limits are documented inline
where they matter (see `providers/ai/MockAIProvider.ts`).

**Why business logic lives outside the LLM.** Prices, stock, cart contents, and order state are read and
written exclusively by `services/*.ts`, called only through `tools/toolExecutor.ts`. The AI — real or mock
— can *request* an action, but `cartService.addToCart`/`updateCartQuantity` independently re-validates
every quantity against real stock before mutating anything. No prompt, tool-call argument, or provider
response is ever trusted as ground truth for business state. This is enforced by tests, not just
convention (e.g. `backend/src/__tests__/cartService.test.ts`).

**Why conversation context exists.** A real LLM gets multi-turn memory "for free" from the full message
history. `MockAIProvider` re-parses each turn independently and has no such memory, so `aiService` embeds a
small `ConversationContext` (pending clarification, most recently discussed product, a pending yes/no
confirmation) into the system prompt each turn, and `MockAIProvider` returns a `contextUpdate` describing
how that memory should change. This is what lets a bare reply like "basmati" or "2 kilos" resolve correctly
against whatever was just asked, and what lets a follow-up like "actually make that 3 kilos" resolve
against the right cart line without restating the product name.

**Why telephony is abstracted.** `TelephonyProvider` isolates phone-network concerns (ringing, answering,
audio) from AI reasoning entirely. `callService.ts` is a thin orchestration layer that calls the exact same
`aiService.sendMessage()` the browser widget uses — a phone call is just a `ConversationSession` with
`channel: "phone"`. Swapping `MockTelephonyProvider` for a real `TwilioTelephonyProvider` implementation
later touches zero AI, tool-calling, or grocery-domain code (see `docs/TELEPHONY.md`).

**Why there's no RAG / vector search.** The product catalog, prices, and stock are small, structured,
exact-match data — a keyword search over ~40 fields-per-row (`productService.searchProducts`) answers
"do you have rice?" correctly and cheaply; embeddings and vector similarity would add real cost, latency,
and a new failure mode (a near-miss retrieval) without improving correctness for this kind of lookup.
RAG earns its complexity for *unstructured* knowledge a customer might ask about — a refund policy,
delivery-area coverage, store timings, FAQ text — none of which exists as real content in this project yet.
See [Future Work](#future-work) for the shape that would take if it were added.

## Future Work

Clearly separating what's implemented from what isn't:

**Implemented:** multilingual voice + text conversation, LLM tool-calling (both `OpenAIProvider` and
`MockAIProvider`), cross-turn conversation context, product search/inventory/cart/order flows with
authoritative server-side validation, a browser voice pipeline, a phone-call simulator sharing the same AI
pipeline, an HTTP API with request validation and clean error responses, and a `TelephonyProvider`
abstraction shaped for real telephony.

**Not implemented (by design, documented rather than faked):**

- **Real phone calls.** `TwilioTelephonyProvider` and the `/api/telephony/twilio/*` webhooks are stubs.
  Making calls real requires: implementing the provider's methods against the real Twilio API, choosing an
  audio strategy (TwiML `<Gather>` turn-based, or real-time Media Streams over WebSocket), webhook
  signature verification, and real credentials. None of the AI, tool-calling, or grocery logic changes —
  see `docs/TELEPHONY.md`.
- **A real GroceryNxt backend / persistent database.** `data/store.ts` and `data/products.ts` are an
  in-memory stand-in. Swapping in a real database means replacing those two modules' exports; the service
  layer's function signatures wouldn't need to change.
- **Knowledge-base retrieval (RAG).** If real, unstructured policy/FAQ content (refund policy, delivery
  areas, store timings) were added, the shape would be: policy documents → chunking → embeddings → a vector
  store → a new `get_store_info` tool that retrieves relevant chunks → fed into the same tool-calling loop
  already in place. Deliberately not built now — see
  [Why there's no RAG / vector search](#architecture-decisions) above.
- **Payments.** Checkout is explicitly mocked; the AI is instructed to never request or process card
  numbers, CVV, OTP, or UPI PINs (see the system prompt in `aiService.ts`).
- **Price/inventory disambiguation in `MockAIProvider`.** The purchase pipeline
  (`resolveProductThenTail`) asks a clarifying question when a search matches multiple distinct products;
  the price/inventory *question* pipelines currently answer using only the top search match. A real
  `OpenAIProvider` conversation handles this correctly via the system prompt's disambiguation rule (#17);
  extending the mock's rule table to do the same is a scoped, known follow-up.

## Security notes

- OpenAI API keys never reach the frontend; all AI calls happen server-side.
- CORS is restricted to the configured frontend origin(s) (`CORS_ORIGIN`), not left open (`*`).
- All HTTP endpoints validate required fields and return typed 4xx errors rather than leaking raw
  exception messages; tool-execution failures inside the AI loop are caught and sanitized before logging
  (see `sanitizeError` in `aiService.ts`) and never surfaced to the client as raw error text.
- No real payment processing is implemented; checkout is explicitly mocked.
- The AI is instructed never to request or process card numbers, CVV, OTP, or UPI PINs.
