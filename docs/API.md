# Backend API Reference

Base URL: `http://localhost:4000` (configurable via `PORT`/`HOST`).
All cart/order endpoints identify the customer via the `x-customer-id` header (the frontend generates and
persists a random guest id in `localStorage`).

## Health

- `GET /api/health` → `{ status, ai: { provider, configured, model } }`

## Products

- `GET /api/products?q=&category=&inStockOnly=&limit=` — search the mock catalog
- `GET /api/products/categories` — list distinct categories
- `GET /api/products/:id` — full product detail
- `GET /api/products/:id/inventory?qty=` — stock check for a requested quantity

## Cart

- `GET /api/cart`
- `POST /api/cart/items` `{ productId, qty }`
- `DELETE /api/cart/items` `{ productId, qty? }` (omit `qty` to remove the line entirely)

## Orders

- `GET /api/orders` — all orders (demo/dashboard use)
- `POST /api/orders` `{ deliveryAddress? }` — places an order from the current cart
- `GET /api/orders/:orderId`
- `POST /api/orders/:orderId/cancel`

## AI Agent (text — the browser handles speech-to-text/text-to-speech locally)

- `POST /api/agent/chat` `{ message, language, customerId }` → the primary voice/text agent endpoint.
  `customerId` is the same persisted guest id the frontend uses for cart/order REST calls (see
  `frontend/src/services/api.ts`) — using it as the conversation's session key too means every tool call
  the AI makes (`add_to_cart`, `create_order`, ...) operates on the exact cart the storefront UI displays.

  Request:
  ```json
  { "message": "I need two kilos of basmati rice.", "language": "en", "customerId": "guest_ab12cd34" }
  ```
  Response (success):
  ```json
  {
    "success": true,
    "response": "Added 2 x India Gate Basmati Rice to your cart (₹324).",
    "language": "en",
    "toolCalls": [
      { "tool": "search_products", "status": "completed" },
      { "tool": "check_inventory", "status": "completed" },
      { "tool": "add_to_cart", "status": "completed" }
    ],
    "ordersCreated": [],
    "sessionId": "guest_ab12cd34"
  }
  ```
  On failure (missing fields, or the AI provider/tooling throws) the response is `{ success: false, error }`
  with a friendly message — no stack traces are ever returned; failures are logged server-side via the
  Fastify request logger.
- `GET /api/agent/session/:id` — full conversation transcript for a given customer/session id
- `POST /api/agent/session/:id/end` — marks a session ended and records call duration for the dashboard
- `POST /api/agent/speak` `{ text, language }` → `audio/mpeg` (requires `OPENAI_API_KEY`; optional, not used by the default browser demo — see `docs/VOICE.md`)

## Dashboard

- `GET /api/dashboard` → agent status, call counts, average duration, language breakdown, recent
  conversations, orders generated, revenue

## Phone Calls (mock simulator — see docs/TELEPHONY.md)

Backs the Dashboard's "Phone Call Simulator". Every call is answered by the exact same
`aiService`/tool-calling pipeline as `POST /api/agent/chat` — no real phone network involved.

- `POST /api/calls/simulate` `{ language, customerId, fromNumber? }` → `{ success, call }` — simulates and
  auto-answers an inbound call.
  ```json
  { "language": "en", "customerId": "demo-customer" }
  ```
  ```json
  { "success": true, "call": { "callId": "call_a70dbac4", "customerId": "demo-customer", "phoneNumber": "+91 90000 00000", "language": "en", "status": "connected", "startedAt": "..." } }
  ```
- `POST /api/calls/:callId/message` `{ message }` → `{ success, response, toolCalls, ordersCreated, status }`
  — one customer turn, answered by `aiService.sendMessage()` exactly like the browser agent.
- `GET /api/calls/:callId` → `{ success, call, transcript }` — the call plus its full conversation
  transcript (derived from the underlying session's message history, not stored separately).
- `POST /api/calls/:callId/end` → `{ success, call }` — ends the call and records its duration.

## Telephony — Twilio webhooks (stubs — see docs/TELEPHONY.md)

Unrelated to the mock simulator above. These exist so a real Twilio phone number can eventually point a
webhook at this backend; none of them do real work yet, and none require Twilio credentials to respond.

- `POST /api/telephony/twilio/incoming` — stub; always returns a static "not yet configured" TwiML `<Say>`
- `POST /api/telephony/twilio/status` — stub; acknowledges receipt only
- `POST /api/telephony/twilio/media` — stub; returns `501 Not Implemented` (real-time audio requires a
  WebSocket integration not yet built)
