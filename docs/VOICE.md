# Browser Voice Pipeline

This is the Phase 2 implementation: a real browser-based AI voice shopping agent, built entirely on the
existing architecture (`AIProvider`, tool-calling loop, mock GroceryNxt data). No telephony, no real
payments — those are later phases (see `docs/TELEPHONY.md`).

## The pipeline

```
Browser microphone
      ↓
SpeechRecognition (browser, Web Speech API)
      ↓
Transcript (text)
      ↓
POST /api/agent/chat  { message, language, customerId }
      ↓
Fastify backend
      ↓
AIProvider.chat()  — OpenAIProvider (real) or MockAIProvider (fallback)
      ↓
Tool Executor  — search_products / check_inventory / add_to_cart / ...
      ↓
Mock GroceryNxt data layer (products, cart, orders)
      ↓
AI natural-language response
      ↓
Frontend transcript + cart refresh
      ↓
speechSynthesis (browser, Web Speech API)
      ↓
Customer hears the response
```

## Where each piece runs

| Concern | Runs in | Why |
|---|---|---|
| Speech-to-text | **Browser** (`useSpeechRecognition` → Web Speech `SpeechRecognition`) | No audio upload needed; works offline of any AI provider; zero added latency/cost for STT. |
| Text-to-speech | **Browser** (`useSpeechSynthesis` → `speechSynthesis`) | Same reasons — the reply text is all that ever leaves the backend. |
| Language understanding & tool-calling | **Backend** (`aiService.sendMessage` → `AIProvider` → tool executor) | This is the only place that can safely hold the OpenAI key and the only place allowed to touch business data. |
| Product/price/stock/cart/order truth | **Backend mock data layer** (`productService`, `cartService`, `orderService`) | The AI is instructed to never invent this data — it always comes from a tool call against these services. |

## Why the OpenAI API key never reaches the browser

`OPENAI_API_KEY` is read once in `backend/src/config/env.ts` from a server-side environment variable and
used exclusively inside `backend/src/providers/ai/OpenAIProvider.ts`. The frontend never imports the
`openai` package, never sees the key, and its `.env` only carries `VITE_API_BASE_URL` (the backend's own
public URL) — Vite only exposes `VITE_`-prefixed variables to client code, so there is no accidental way
for a secret to leak through a `VITE_OPENAI_API_KEY`-style mistake as long as the key is only ever named
`OPENAI_API_KEY` in `backend/.env`. Every AI call the browser triggers goes through `POST /api/agent/chat`,
which runs entirely on the server.

## Request flow in code

1. `frontend/src/hooks/useSpeechRecognition.ts` wraps `SpeechRecognition`, listening in the locale for the
   selected language (`en-IN` / `ta-IN` / `te-IN` / `hi-IN`), and calls back with the final transcript (or
   a friendly error message for permission-denied/no-speech/network failures — never a raw browser error
   code).
2. `frontend/src/hooks/useVoiceAssistant.ts` receives that transcript, appends it to the on-screen
   transcript, sets state to `"thinking"`, and calls `api.sendAgentChat(message, language)`.
3. `frontend/src/services/api.ts` posts to `POST /api/agent/chat` with `{ message, language, customerId }`
   — `customerId` is the same persisted guest id (`localStorage`) used for every cart/order REST call, so
   the AI's tool calls operate on the exact cart the storefront UI displays.
4. `backend/src/controllers/agentController.ts` (`chatHandler`) validates the request and calls
   `aiService.sendMessage(customerId, message, language)`.
5. `aiService.sendMessage` runs the tool-calling loop against the active `AIProvider`, executing tools via
   `tools/toolExecutor.ts` against the mock GroceryNxt data, and returns the final reply plus a
   `toolCalls: [{ tool, status }]` list of everything it called along the way.
6. The response comes back to the browser; `useVoiceAssistant` appends the AI's reply to the transcript,
   refreshes the cart (`CartContext`), and speaks the reply via `speechSynthesis` in the matching locale.
7. If the customer starts talking again (or sends another message) while the assistant is still speaking,
   `speechSynthesis.cancel()` is called first — replies never overlap, and interrupting always returns to
   listening.

## Voice state machine

`VoiceAssistantState = "idle" | "listening" | "thinking" | "speaking" | "error"`, shared via
`VoiceAssistantContext` between the hero mic button and the floating assistant panel so both always show
the same live state:

- **idle** — "Tap to talk" (mic gently pulses)
- **listening** — "Listening…" (animated pulse rings + waveform)
- **thinking** — "Thinking…" (spinner ring while the backend/AI call is in flight)
- **speaking** — "Speaking…" (waveform + soft glow while `speechSynthesis` plays)
- **error** — a friendly message (see below), never a raw error code or stack trace

## Multilingual voice

See `docs/MULTILINGUAL.md` for the full explanation. In short: the language picker controls both the
`SpeechRecognition` locale and the `speechSynthesis` locale client-side, and is sent to the backend on
every request so the system prompt instructs the AI to reply in that language. `MockAIProvider` includes a
small dictionary to recognize common native-script Tamil/Telugu/Hindi grocery/number words for the primary
demo flow; `OpenAIProvider` understands all four languages natively without any special-casing.

## Browser compatibility

- If `window.SpeechRecognition`/`webkitSpeechRecognition` is unavailable, `sttSupported` is `false` and the
  UI shows a text input with a **Send** button instead of crashing or hiding the assistant.
- If `speechSynthesis` is unavailable, replies still appear in the transcript — they're just not spoken.
- All of this detection lives in `useSpeechRecognition`/`useSpeechSynthesis` (`isSpeechRecognitionSupported`
  / `isSpeechSynthesisSupported`) and is checked once at mount, not assumed.

## Error handling

Every failure mode is mapped to a short, friendly, spoken-safe message — never a stack trace or raw error
code:

| Failure | Where handled | Message shown |
|---|---|---|
| Microphone permission denied | `useSpeechRecognition` (`onerror` → `not-allowed`) | "Microphone access was denied. Please allow microphone permissions and try again." |
| No speech detected | `useSpeechRecognition` (`onerror` → `no-speech`) | "I didn't hear anything. Please try again." |
| No microphone found | `useSpeechRecognition` (`onerror` → `audio-capture`) | "No microphone was found. Please check your device and try again." |
| Backend unreachable | `useVoiceAssistant` (`TypeError` from `fetch`) | "Can't reach the GroceryNxt server. Please check your connection and try again." |
| AI provider / tool execution error | `agentController.chatHandler` catch block (logged via `req.log.error`) | "The AI assistant is temporarily unavailable. Please try again." |
| Product not found / insufficient stock | Not an error — a normal AI reply, sourced from the real `search_products`/`check_inventory` tool results | e.g. "Sorry, only 12 units of ... are available right now." |
| Empty transcript | `useSpeechRecognition` only calls back on a non-empty final transcript | (silently ignored, no request sent) |
| Cart add fails (REST panel) | `ProductCard` catch block | Small inline red message under the Add button, auto-clears |

## The mock provider still supports the full primary flow

With no `OPENAI_API_KEY` configured, `MockAIProvider` drives the exact same
`search_products → check_inventory → add_to_cart` pipeline for a request like "I need two kilos of basmati
rice": it extracts the quantity and a search query, calls `search_products`, resolves the top match, calls
`check_inventory` with the requested quantity, and only calls `add_to_cart` if enough stock exists —
otherwise it reports the real available quantity and stops. This is not real NLU (see
`docs/MULTILINGUAL.md`), but it makes the whole demo — cart, dashboard, multilingual replies — work with
zero API credentials.

## Running with a real OpenAI API key

1. Get an API key from https://platform.openai.com/api-keys.
2. In `backend/.env` (copy from `.env.example` if you haven't already), set:
   ```
   OPENAI_API_KEY=sk-...your real key...
   OPENAI_MODEL=gpt-4o-mini
   ```
   Never commit `backend/.env` — it's already gitignored — and never put the key anywhere under
   `frontend/` or in a `VITE_`-prefixed variable (Vite exposes those to the browser bundle).
3. Restart the backend (`npm run dev` in `backend/`). On startup it logs which provider is active:
   ```
   AI provider: OpenAI (gpt-4o-mini)
   ```
   (or the mock-fallback line if the key is empty/missing).
4. Nothing else changes — `providers/ai/index.ts`'s `getAIProvider()` selects `OpenAIProvider` automatically
   whenever `OPENAI_API_KEY` is non-empty, and every existing entry point (`POST /api/agent/chat`, the
   phone simulator's `POST /api/calls/:callId/message`, the browser voice widget) is already wired to
   `aiService.sendMessage()`, so real OpenAI responses flow through unchanged — no frontend or route
   changes are needed to go from mock to real.
5. Test the primary flow directly against the running backend:
   ```bash
   curl -X POST http://localhost:4000/api/agent/chat -H "Content-Type: application/json" \
     -d '{"message":"I need two kilos of basmati rice.","language":"en","customerId":"real-openai-test"}'
   ```
   Check the response's `toolCalls` array — it should show `search_products` → `check_inventory` →
   `add_to_cart` in order (see `parallel_tool_calls: false` in `OpenAIProvider.chat()`, which forces the
   model to make one tool call at a time rather than batching several before seeing any results).

### What's already verified without a real key

`backend/src/__tests__/openAIProvider.test.ts` drives `OpenAIProvider` end-to-end against the **real**
`toolExecutor`/`cartService` using a queue of scripted fake completions (the underlying OpenAI SDK client
is monkey-patched, so no network call happens) — this proves the message translation, tool-call-argument
parsing, `parallel_tool_calls: false` request shape, error propagation, and the full
search → check_inventory → add_to_cart wiring are all correct. What it can *not* prove is how the real
model behaves on genuinely novel phrasing — that requires a live key (step 5 above, or the broader manual
checklist a real-key validation pass should run: natural phrasing variations, price/inventory questions,
insufficient stock, product-not-found, all 4 languages, multi-turn context and corrections, and basic
prompt-injection resistance — in every case the invariant that matters is that `cartService`/`productService`
remain the sole source of truth, which holds regardless of what the model says, since those services
enforce their own rules independent of the AI layer).
