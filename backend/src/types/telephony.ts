import { SupportedLanguageCode } from "./language.js";

/**
 * Provider-neutral phone-call domain types, used by `services/callService.ts`
 * and the `/api/calls/*` routes. These describe the CONVERSATION/session
 * layer (who is calling, in what language, what did they say) — separate
 * from the lower-level telephony-network concerns (ringing, audio) defined
 * in `providers/telephony/TelephonyProvider.ts`.
 */

/**
 * High-level call state machine (see docs/TELEPHONY.md). `ringing` /
 * `connected` / `ended` are the states actually persisted server-side in
 * this REST/simulation model. `listening` / `thinking` / `speaking` describe
 * what happens *within* a single POST /api/calls/:callId/message
 * request-response cycle — the frontend simulator animates through them
 * client-side, exactly like the existing browser voice assistant's state
 * machine, since there is no persistent duplex connection to push them over.
 */
export type CallStatus = "ringing" | "connected" | "listening" | "thinking" | "speaking" | "ended";

/** A call as seen by the business/domain layer — the record `callService` owns. */
export interface TelephonyCall {
  callId: string;
  customerId: string;
  phoneNumber: string;
  language: SupportedLanguageCode;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
}

/** A freshly-received inbound call, before it has been answered/assigned a session. */
export interface IncomingCall {
  callId: string;
  fromNumber: string;
  toNumber: string;
  language: SupportedLanguageCode;
  receivedAt: string;
}

export interface CallTranscriptEntry {
  speaker: "customer" | "ai";
  language: SupportedLanguageCode;
  text: string;
  timestamp: string;
}

/** A call plus its conversation so far — returned by GET /api/calls/:callId. */
export interface CallSession {
  call: TelephonyCall;
  transcript: CallTranscriptEntry[];
}

/**
 * A chunk of inbound audio from the caller. Real-time telephony providers
 * (Twilio Media Streams, etc.) deliver audio this way; our mock/demo
 * pipeline is text-based and never actually constructs one of these today —
 * the shape exists so a real provider integration has somewhere to plug in
 * without changing the call/AI orchestration layer.
 */
export interface AudioPayload {
  callId: string;
  mimeType: string;
  /** Base64-encoded audio bytes for a single chunk/frame. */
  data: string;
}

/** What the AI wants to say back to the caller, and (optionally) synthesized audio for a provider that needs raw audio rather than TwiML/text. */
export interface VoiceResponse {
  callId: string;
  text: string;
  language: SupportedLanguageCode;
  audio?: AudioPayload;
}
