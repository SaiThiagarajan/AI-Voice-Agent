# AI Voice Platform — GroceryNxt Demo

A multilingual AI voice-agent platform. The first demo integration is **GroceryNxt**, a mock grocery
e-commerce storefront: customers can talk (or type) to an AI shopping assistant in English, Tamil,
Telugu, or Hindi, and it searches a realistic mock product catalog, checks real stock/price data, adds
items to a cart, and places mock orders — all without ever inventing business data itself.

There is no access to a real GroceryNxt backend, so `backend/src/data/products.ts` is a hand-built mock
catalog and data layer standing in for it. See `docs/ARCHITECTURE.md` for the full system design and
`docs/VOICE.md` for the browser voice pipeline (microphone → speech-to-text → `/api/agent/chat` →
AI + tool calling → text-to-speech).

## Tech stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + TypeScript + Fastify
- **AI:** OpenAI API behind a provider abstraction (`AIProvider`), with a rule-based mock fallback so the
  whole product works with zero API credentials
- **Voice:** Browser-first (Web Speech API for STT/TTS), with a clean `TelephonyProvider` abstraction
  prepared for a future real phone integration

## Project structure

```
AI-VOICE-PLATFORM/
├── frontend/   React storefront + voice assistant + agent dashboard
├── backend/    Fastify API, mock GroceryNxt data, AI orchestration, tool calling
├── docs/       Architecture, API reference, voice pipeline, telephony roadmap, multilingual notes
└── README.md
```

## Quick start

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
phone number or Twilio account involved). See `docs/TELEPHONY.md` for the phone-call architecture.

## Environment variables

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

## What works without any API credentials

- The entire storefront: browsing, search, categories, cart, mock checkout
- Voice input/output in the browser (Web Speech API — no backend audio calls involved)
- The AI agent's tool-calling flow — search → resolve product → add to cart → checkout → order status —
  driven by a rule-based `MockAIProvider` with per-language canned responses
- The agent dashboard (call counts, language breakdown, recent conversations, orders) — automatically
  includes both browser and simulated phone-call sessions, since both write into the same conversation store
- The full mock **phone call simulation** (`/api/calls/*`, `MockTelephonyProvider`, and the Dashboard's
  Phone Call Simulator): incoming call → answer → multi-turn conversation in any of the 4 languages → end
  call, all answered by the same `search_products → check_inventory → add_to_cart` pipeline as the browser

## What requires real credentials

- Natural, open-ended multilingual understanding (rather than keyword matching) requires
  `OPENAI_API_KEY` set in `backend/.env` — this swaps `MockAIProvider` for `OpenAIProvider` with zero
  other code changes, for both the browser and phone-call channels.
- Server-side text-to-speech/transcription via `/api/agent/speak` and `AIProvider.transcribeAudio()` also
  require `OPENAI_API_KEY`.
- Anything under `TwilioTelephonyProvider` or the `/api/telephony/twilio/*` webhooks doing real work —
  today they are documented stubs that throw or return a placeholder rather than pretending to place a
  real call (see `docs/TELEPHONY.md`).

## What remains for real phone calling

See `docs/TELEPHONY.md` for full detail. In short: implement `TwilioTelephonyProvider`'s stubbed methods
for real, decide on an audio strategy (a simple TwiML `<Gather>` turn-based loop, or real-time Media
Streams over WebSocket), wire up webhook signature verification, and supply real Twilio credentials — none
of the AI reasoning, grocery tools, `callService`, or data layer need to change, since the phone-call
architecture is already fully isolated behind `TelephonyProvider`.

## Security notes

- OpenAI API keys never reach the frontend; all AI calls happen server-side.
- No real payment processing is implemented; checkout is explicitly mocked.
- The AI is instructed never to request or process card numbers, CVV, OTP, or UPI PINs.
