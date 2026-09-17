import { FastifyInstance } from "fastify";
import { twilioIncomingCallHandler, twilioMediaHandler, twilioStatusCallbackHandler } from "../controllers/twilioWebhookController.js";

/**
 * Stub routes for a future real Twilio integration (see
 * controllers/twilioWebhookController.ts for what each will eventually do).
 * The mock/demo phone-call simulator used by the dashboard lives at
 * /api/calls/* (see routes/callRoutes.ts) — these routes are unrelated to it
 * and exist purely so a Twilio webhook URL can point here without 404ing.
 */
export async function telephonyRoutes(app: FastifyInstance) {
  app.post("/api/telephony/twilio/incoming", twilioIncomingCallHandler);
  app.post("/api/telephony/twilio/status", twilioStatusCallbackHandler);
  app.post("/api/telephony/twilio/media", twilioMediaHandler);
}
