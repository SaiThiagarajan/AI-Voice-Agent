import { AudioPayload } from "../../types/telephony.js";

/**
 * Provider-agnostic telephony abstraction — the phone-network-level
 * counterpart to `providers/ai/AIProvider.ts`. Implementations (mock, Twilio,
 * Telnyx, ...) only ever deal with call lifecycle and audio; they know
 * nothing about grocery products, carts, or the AI. All of that lives in
 * `services/callService.ts`, which uses this interface plus the existing
 * `aiService` to run a phone conversation.
 */

export interface InboundCallEvent {
  callId: string;
  fromNumber: string;
  toNumber: string;
  receivedAt: string;
}

/** Text (and/or synthesized audio) to send back to an active call. */
export interface OutboundSpeechRequest {
  callId: string;
  text: string;
  languageCode: string;
  audio?: AudioPayload;
}

export interface CallLifecycleEvent {
  callId: string;
  status: "ringing" | "in-progress" | "completed" | "failed";
  timestamp: string;
}

export interface TelephonyProvider {
  readonly name: string;

  /** Register a webhook-style handler invoked whenever a new call comes in. */
  onInboundCall(handler: (event: InboundCallEvent) => Promise<void>): void;

  /** Answer a ringing call, transitioning it to in-progress. */
  answerCall(callId: string): Promise<void>;

  /** End an active call. */
  endCall(callId: string): Promise<void>;

  /** Send synthesized speech/audio (or plain text, for providers that do their own TTS) to the caller. */
  playAudio(request: OutboundSpeechRequest): Promise<void>;

  /**
   * Register a handler for inbound audio/speech chunks from the caller.
   * Real-time streaming providers (e.g. Twilio Media Streams) call this
   * repeatedly as audio arrives. The mock/demo pipeline is text-based and
   * never invokes it — it exists so a real provider has a place to plug in
   * without changing `callService`.
   */
  receiveAudio(callId: string, handler: (payload: AudioPayload) => void): void;

  /** Look up the current provider-level lifecycle status of a call. */
  getCallStatus(callId: string): CallLifecycleEvent | undefined;

  /** Simulate/initiate an inbound call (used by the mock provider + demo tooling). */
  simulateInboundCall(fromNumber: string, toNumber: string): Promise<InboundCallEvent>;
}
