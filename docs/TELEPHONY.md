# Telephony Architecture

Phase 3: real phone-call architecture *preparation*. No Twilio/Telnyx/Vonage account or credentials are
required for anything in this document to work today — the entire phone-call experience is simulated
locally, on top of the exact same AI/business logic the browser voice agent already uses.

## 1. Current architecture (recap)

```
frontend/   React storefront + browser voice assistant + agent dashboard
backend/    Fastify API — mock GroceryNxt data, AIProvider abstraction, tool-calling loop
```

The backend's AI/business layer (`services/aiService.ts`, `tools/toolExecutor.ts`, `services/productService.ts`
etc.) has no concept of "browser" or "phone" — it only knows about a `ConversationSession` (a `channel` of
`"web"` or `"phone"`, a `customerId`, a `language`, and a message history). Both entry points below funnel
into it identically.

## 2. Browser voice architecture (Phase 2, unchanged)

```
Browser microphone → SpeechRecognition → POST /api/agent/chat → aiService → tools → mock data
                                                                      ↓
Browser  ←  speechSynthesis  ←  transcript update  ←  AI reply
```

See `docs/VOICE.md` for full detail. Nothing in this phase changes this flow.

## 3. Phone call architecture (this phase)

```
Customer Phone
      ↓
Telephony Provider        (providers/telephony/*)
      ↓
Our Backend
      ↓
callService.ts            (services/callService.ts — call session + state)
      ↓
aiService.ts               ← the SAME AI brain the browser uses
      ↓
Grocery Tools               ← the SAME tools (search_products, check_inventory, add_to_cart, ...)
      ↓
Mock Grocery API
      ↓
AI Response
      ↓
callService.ts → TelephonyProvider.playAudio()
      ↓
Telephony Provider
      ↓
Customer
```

`services/callService.ts` is the only new orchestration code. It does not reimplement any AI or business
logic — it creates a `ConversationSession` with `channel: "phone"` and calls `aiService.sendMessage()`
exactly like the browser path does, then routes the reply through the active `TelephonyProvider`. This is
the "one AI brain" architecture rule: browser and phone both terminate in the same `aiService`/tool
executor/grocery services/language abstraction.

### Types (`types/telephony.ts`)

Provider-neutral call-domain types: `CallStatus`, `TelephonyCall`, `IncomingCall`, `CallTranscriptEntry`,
`CallSession`, `AudioPayload`, `VoiceResponse`. These describe the conversation/session layer and know
nothing about Twilio or any other vendor.

### `TelephonyProvider` interface (`providers/telephony/TelephonyProvider.ts`)

Mirrors the existing `providers/ai/AIProvider.ts` pattern: a small interface any vendor can implement.
`onInboundCall`, `answerCall`, `endCall`, `playAudio`, `receiveAudio`, `getCallStatus`,
`simulateInboundCall`. `providers/telephony/index.ts` selects the active implementation from
`TELEPHONY_PROVIDER` (defaults to `mock`).

### `callService.ts` responsibilities

- `createCall(customerId, language)` — asks the active `TelephonyProvider` to simulate/answer an inbound
  call, then pre-creates a `channel: "phone"` conversation session via `aiService.getOrCreateSession`.
- `sendCallMessage(callId, message)` — the customer's turn: calls `aiService.sendMessage(callId, message,
  call.language)` (identical call shape to the browser path, just with the call id as the session key),
  then "speaks" the reply via `TelephonyProvider.playAudio()`.
- `getCall(callId)` — returns the call plus a transcript **derived from** the conversation session's
  message history (not stored a second time — the session is the single source of truth for what was
  said, for both channels).
- `endCall(callId)` — ends the call via the provider and `aiService.endSession()`, which computes and
  records call duration exactly as it already did for the old telephony demo endpoints.

## 4. Mock phone simulator

`providers/telephony/MockTelephonyProvider.ts` simulates the entire call lifecycle in memory — no real
audio, no real phone number. `playAudio` just logs what was "said" (the reply is already recorded in the
conversation transcript); `receiveAudio` is a no-op registration since this pipeline exchanges text
directly rather than audio frames. This lets the whole call flow — ring, answer, multi-turn conversation,
hang up — be exercised and demoed with zero external dependencies.

Try it directly:

```bash
curl -X POST http://localhost:4000/api/calls/simulate \
  -H "Content-Type: application/json" \
  -d '{"language":"en","customerId":"demo-customer"}'
# → { "success": true, "call": { "callId": "call_xxxxx", "status": "connected", ... } }

curl -X POST http://localhost:4000/api/calls/call_xxxxx/message \
  -H "Content-Type: application/json" \
  -d '{"message":"I need two kilos of basmati rice"}'
# → { "success": true, "response": "...", "toolCalls": [...], "status": "connected" }

curl http://localhost:4000/api/calls/call_xxxxx        # call + transcript
curl -X POST http://localhost:4000/api/calls/call_xxxxx/end
```

Or use the **Phone Call Simulator** card on the Agent Dashboard (`/dashboard`), which drives the exact
same endpoints with a small animated UI (Incoming Call → Answering → Connected → Listening → Thinking →
Speaking) and a live transcript.

## 5. Twilio integration plan

`providers/telephony/TwilioTelephonyProvider.ts` is a stub implementation of `TelephonyProvider` — every
method throws a clear "not implemented, requires a real Twilio integration" error rather than pretending
to work. It exists so the shape of the real integration is reviewable today. To make it real:

1. Add the `twilio` npm package (not installed — this stub has zero Twilio dependencies today).
2. Implement each method using the Twilio REST API / SDK (see the `TODO(twilio)` comments in the file for
   what each one needs).
3. Fill in `controllers/twilioWebhookController.ts`'s three handlers so they actually process Twilio's
   webhook payloads and drive `callService` (see §6 below).
4. Expose a public webhook URL (a tunnel in dev, e.g. ngrok, or a real deployment) and configure it on the
   Twilio phone number.
5. Set `TELEPHONY_PROVIDER=twilio` plus `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`
   in `.env`.

No changes are needed to `aiService.ts`, the tool-calling loop, `callService.ts`, or the mock GroceryNxt
data layer — the integration is fully isolated behind `TelephonyProvider`.

### Twilio webhook routes (`routes/telephonyRoutes.ts`, stubs today)

- `POST /api/telephony/twilio/incoming` — Twilio calls this when a call arrives at your Twilio number,
  with a form-encoded body including `CallSid`, `From`, `To`, `CallStatus`. A real implementation responds
  with TwiML. Today it always returns a static "not yet configured" `<Say>`.
- `POST /api/telephony/twilio/status` — Twilio's call-status-changed callback (ringing → in-progress →
  completed/failed). Today it just acknowledges receipt.
- `POST /api/telephony/twilio/media` — where a Media Streams WebSocket would eventually be upgraded to for
  real-time audio. Today it returns `501 Not Implemented`.

**Security note for later:** every real webhook handler must verify the `X-Twilio-Signature` header
against the request body and your auth token before trusting the payload — not implemented here since
there is no real Twilio account to sign against yet.

These are distinct from `/api/calls/*` (§4 above), which is the mock simulator the dashboard uses today —
the two are not related and won't be confused once real Twilio credentials exist.

## 6. Audio streaming architecture

The mock/demo pipeline is entirely **text-based turn-based request/response** — there is no real audio
anywhere in `/api/calls/*`. A real phone call is fundamentally different: audio arrives continuously and
needs a response with low latency. Two realistic paths for a future implementation:

- **Simple (TwiML `<Gather>` loop):** Twilio does the speech-to-text and text-to-speech itself via
  `<Gather input="speech">` / `<Say>`; your webhook just receives already-transcribed text and returns
  TwiML with the reply. Turn-based, higher latency, but no WebSocket/streaming code needed — closest to
  what `callService.ts` already assumes.
- **Real-time (Media Streams):** Twilio streams raw audio to a WebSocket you host; you'd run STT
  (`AIProvider.transcribeAudio()`, already implemented via OpenAI Whisper) on it, feed the transcript to
  `aiService.sendMessage()`, run TTS (`AIProvider.synthesizeSpeech()`, already implemented via OpenAI TTS)
  on the reply, and stream the resulting audio back over the same WebSocket. Lower latency, much more
  implementation work (buffering, backpressure, interruption handling), and would need
  `@fastify/websocket` (already a dependency) wired up on `/api/telephony/twilio/media`.

Neither is implemented — both `AudioPayload`/`VoiceResponse` types and the `playAudio`/`receiveAudio`
interface methods exist specifically so either path can be added later without touching `aiService` or
the tool-calling logic.

## 7. STT/TTS architecture

Unchanged from Phase 2: `AIProvider.transcribeAudio()` (OpenAI Whisper) and `AIProvider.synthesizeSpeech()`
(OpenAI TTS) already exist on the provider interface and are used today by the browser demo's optional
`/api/agent/speak` endpoint. A real telephony integration would call these same methods rather than
duplicating STT/TTS logic — there is exactly one place either capability is implemented.

## 8. Multilingual phone calls

Identical mechanism to the browser (see `docs/MULTILINGUAL.md`) — a call's `language` is set once at
`POST /api/calls/simulate` and stored on both the `TelephonyCall` and its underlying `ConversationSession`.
Every message on that call reuses `aiService.buildSystemPrompt()`'s existing `LANGUAGE_CODE:<code>`
mechanism, so English/Tamil/Telugu/Hindi all work exactly as they do for browser voice, with zero
phone-specific language code. `MockAIProvider`'s native-script keyword dictionary (see
`docs/MULTILINGUAL.md`) applies here too, since it's the same `aiService.sendMessage()` call.

## 9. Environment variables

```bash
TELEPHONY_PROVIDER=mock   # "mock" (default) or "twilio"
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

All four already exist in `backend/.env.example`. Leaving them empty is the expected, fully-supported
default — the app boots and every mock/demo feature (browser voice, phone call simulator, dashboard) works
with `TELEPHONY_PROVIDER=mock`. Setting `TELEPHONY_PROVIDER=twilio` without real credentials makes
`TwilioTelephonyProvider`'s constructor throw immediately with a clear message — it fails loudly rather
than silently pretending to place real calls.

## 10. Security considerations

- No Twilio secret (`TWILIO_AUTH_TOKEN`) or OpenAI key ever reaches the frontend — both are read only from
  backend environment variables (`config/env.ts`) and used only in backend provider code.
- The Phone Call Simulator UI never asks for or displays a real phone number, card number, CVV, OTP, or
  UPI PIN — it's a text-based internal testing tool.
- The AI's system prompt (`aiService.buildSystemPrompt`) explicitly forbids asking for or processing
  payment credentials, on both channels.
- A real Twilio webhook implementation must verify `X-Twilio-Signature` on every request (see §5) — not
  yet implemented, since there's no real account to test it against.

## 11. What currently works (no credentials required)

- Full mock phone-call simulation: incoming call → answer → multi-turn conversation → end call, in all
  four languages, via `/api/calls/*` or the Dashboard's Phone Call Simulator.
- The exact same `search_products → check_inventory → add_to_cart` pipeline as the browser agent, backed
  by real mock-catalog prices/stock — the AI never invents product, price, stock, or order data on either
  channel.
- Dashboard metrics (Total Calls, Active Calls, Average Call Duration, Languages Used, Recent
  Conversations, Orders Generated) automatically include simulated phone calls alongside browser sessions
  — no dashboard code changes were needed, since both channels write into the same conversation-session
  store the dashboard already aggregates.
- Graceful, friendly errors for a call to an unknown or already-ended call id.

## 12. What requires Twilio credentials

- Anything under `TwilioTelephonyProvider` or the `/api/telephony/twilio/*` webhooks doing real work —
  today they are documented stubs that either throw or return a placeholder response.
- Receiving an actual inbound phone call from a real PSTN number.

## 13. What remains for production phone calling

- Implement `TwilioTelephonyProvider`'s methods for real (§5).
- Decide and build one of the two audio strategies in §6 (TwiML `<Gather>` loop is the faster path to a
  working demo; Media Streams is needed for a natural, low-latency conversation).
- Wire `X-Twilio-Signature` verification into the webhook handlers.
- Handle call recording/compliance requirements if needed for the target market.
- Real payment processing remains explicitly out of scope for this platform regardless of phase — see the
  root `README.md`.
