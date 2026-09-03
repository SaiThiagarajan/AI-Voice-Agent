import { env } from "../../config/env.js";
import { AudioPayload } from "../../types/telephony.js";
import { CallLifecycleEvent, InboundCallEvent, OutboundSpeechRequest, TelephonyProvider } from "./TelephonyProvider.js";

/**
 * Preparation for a real Twilio integration. This class exists so the shape
 * of a real provider is visible and reviewable ahead of time, and so
 * `providers/telephony/index.ts` has somewhere to route to once credentials
 * exist — but it does NOT implement real phone calling. Every method below
 * is a documented stub that throws rather than pretending to work.
 *
 * Twilio-specific code is intentionally isolated to this one file: nothing
 * in `callService.ts`, `aiService.ts`, or the tool executor knows Twilio
 * exists. A future implementation only needs to fill in the bodies below —
 * no other file should need to change.
 *
 * What a real implementation would need (see docs/TELEPHONY.md for detail):
 *   - The `twilio` npm SDK (not installed — this class has zero Twilio
 *     dependencies today, deliberately, since it's unused without credentials).
 *   - A publicly reachable webhook URL for Twilio to call
 *     (`routes/telephonyRoutes.ts` already stubs the endpoints Twilio would hit).
 *   - Signature verification on every inbound webhook (`X-Twilio-Signature`).
 *   - A strategy for real-time audio: either TwiML `<Say>`/`<Gather>` for a
 *     simple turn-based IVR-style flow, or a WebSocket bridge consuming
 *     Twilio Media Streams for true real-time conversation — the latter is
 *     substantially more work and is not attempted here.
 */
export class TwilioTelephonyProvider implements TelephonyProvider {
  readonly name = "twilio";

  constructor() {
    if (!env.telephony.twilio.accountSid || !env.telephony.twilio.authToken) {
      throw new Error(
        "TwilioTelephonyProvider requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN. " +
          "This is a stub for future integration — see docs/TELEPHONY.md."
      );
    }
  }

  onInboundCall(_handler: (event: InboundCallEvent) => Promise<void>): void {
    // TODO(twilio): inbound calls arrive via the POST /api/telephony/twilio/incoming
    // webhook (see routes/telephonyRoutes.ts + controllers/twilioWebhookController.ts),
    // not a registered callback — Twilio calls us. That handler would translate
    // the webhook payload into an InboundCallEvent and invoke registered handlers.
    throw new Error("TwilioTelephonyProvider.onInboundCall is not implemented — requires a real Twilio integration.");
  }

  async answerCall(_callId: string): Promise<void> {
    // TODO(twilio): answering happens by returning TwiML from the incoming-call
    // webhook response, not via a separate API call — there is nothing to "do"
    // here for Twilio's REST API in the simple TwiML flow.
    throw new Error("TwilioTelephonyProvider.answerCall is not implemented — requires a real Twilio integration.");
  }

  async endCall(_callId: string): Promise<void> {
    // TODO(twilio): call `client.calls(callSid).update({ status: "completed" })`
    // via the Twilio REST API once the `twilio` SDK is installed and configured.
    throw new Error("TwilioTelephonyProvider.endCall is not implemented — requires a real Twilio integration.");
  }

  async playAudio(_request: OutboundSpeechRequest): Promise<void> {
    // TODO(twilio): for a TwiML-based flow, respond to the current webhook
    // with <Say> (Twilio TTS) or <Play> (a URL to audio synthesized via
    // AIProvider.synthesizeSpeech). For a Media Streams flow, write audio
    // frames to the open WebSocket instead.
    throw new Error("TwilioTelephonyProvider.playAudio is not implemented — requires a real Twilio integration.");
  }

  receiveAudio(_callId: string, _handler: (payload: AudioPayload) => void): void {
    // TODO(twilio): only relevant for a Media Streams integration — would
    // decode base64 audio frames from the Twilio WebSocket and invoke
    // `handler` with an AudioPayload per frame.
    throw new Error("TwilioTelephonyProvider.receiveAudio is not implemented — requires a real Twilio integration.");
  }

  getCallStatus(_callId: string): CallLifecycleEvent | undefined {
    // TODO(twilio): fetch via `client.calls(callSid).fetch()` and map Twilio's
    // status enum (queued/ringing/in-progress/completed/...) onto CallLifecycleEvent.
    throw new Error("TwilioTelephonyProvider.getCallStatus is not implemented — requires a real Twilio integration.");
  }

  async simulateInboundCall(_fromNumber: string, _toNumber: string): Promise<InboundCallEvent> {
    throw new Error(
      "TwilioTelephonyProvider cannot simulate calls — that's what MockTelephonyProvider is for. " +
        "Real calls arrive via the incoming-call webhook, not this method."
    );
  }
}
