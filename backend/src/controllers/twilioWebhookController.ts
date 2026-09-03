import { FastifyReply, FastifyRequest } from "fastify";

/**
 * Stub webhook handlers for a future real Twilio integration. None of these
 * do anything real yet — no TWILIO_* credentials are required for the app to
 * run, and nothing here claims to place or receive an actual phone call.
 * They exist so the eventual integration has a documented, reviewable shape
 * to fill in, and so a webhook URL can be pointed at this backend today
 * without 404ing.
 *
 * IMPORTANT for a real implementation: every one of these must verify the
 * `X-Twilio-Signature` header against the request body and your Twilio auth
 * token before trusting the payload (see Twilio's webhook security docs) —
 * not implemented here since there's no real Twilio account to sign against.
 */

/**
 * Twilio calls this when a call comes in to your Twilio number, with a
 * `application/x-www-form-urlencoded` body including (among others):
 *   CallSid, From, To, CallStatus, Direction
 * A real implementation would respond with TwiML — either a simple
 * <Say>/<Gather> turn-based flow, or a <Connect><Stream> pointing at a
 * WebSocket endpoint for real-time Media Streams — and internally translate
 * the payload into an InboundCallEvent for `providers/telephony/index.ts`'s
 * active provider, then hand off to `services/callService.ts` exactly like
 * the mock simulator does.
 */
export async function twilioIncomingCallHandler(_req: FastifyRequest, reply: FastifyReply) {
  reply.header("Content-Type", "text/xml");
  return reply.send(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not yet configured for live calls.</Say></Response>`
  );
}

/**
 * Twilio calls this as a call's status changes (ringing, in-progress,
 * completed, failed, ...) if `statusCallback` is configured on the call. A
 * real implementation would update the matching TelephonyCall's status via
 * callService and let it feed the dashboard's call metrics.
 */
export async function twilioStatusCallbackHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.status(200).send({ received: true, note: "Twilio integration not yet configured." });
}

/**
 * Twilio would connect a Media Streams WebSocket for real-time audio, not a
 * plain POST — Fastify's `@fastify/websocket` (already a project dependency)
 * would need to be wired up for this route to actually stream audio frames
 * in both directions. This POST stub exists only as a placeholder/reminder
 * of the endpoint's eventual purpose; it does not stream audio.
 */
export async function twilioMediaHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply
    .status(501)
    .send({ received: false, note: "Real-time media streaming requires a WebSocket integration, not yet implemented." });
}
