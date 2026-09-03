import { v4 as uuid } from "uuid";
import { AudioPayload } from "../../types/telephony.js";
import { CallLifecycleEvent, InboundCallEvent, OutboundSpeechRequest, TelephonyProvider } from "./TelephonyProvider.js";

/**
 * Simulates a telephony provider (stand-in for Twilio/Telnyx/Vonage) so the
 * rest of the platform — inbound call handling, routing speech to the AI
 * agent, sending spoken responses back — can be built and demoed without
 * real phone credentials. Swap this for a real provider implementation
 * later without changing any calling code, since both implement
 * TelephonyProvider.
 *
 * This mock is text-based (no real audio): `playAudio` just logs what was
 * "said", and `receiveAudio` is a no-op registration — the demo pipeline
 * (see `services/callService.ts`) exchanges text directly rather than audio
 * frames.
 */
export class MockTelephonyProvider implements TelephonyProvider {
  readonly name = "mock";
  private inboundHandlers: Array<(event: InboundCallEvent) => Promise<void>> = [];
  private activeCalls = new Map<string, CallLifecycleEvent>();

  onInboundCall(handler: (event: InboundCallEvent) => Promise<void>): void {
    this.inboundHandlers.push(handler);
  }

  async answerCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.status = "in-progress";
      call.timestamp = new Date().toISOString();
    }
  }

  async playAudio(request: OutboundSpeechRequest): Promise<void> {
    // No real audio device to play to — the mock's "speaking" is just the
    // text itself, which callService already records in the conversation
    // transcript. Nothing to do here beyond satisfying the interface.
    void request;
  }

  receiveAudio(_callId: string, _handler: (payload: AudioPayload) => void): void {
    // Text-based simulation never produces inbound audio chunks; a real
    // streaming provider would store the handler and invoke it per frame.
  }

  async endCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.status = "completed";
      call.timestamp = new Date().toISOString();
    }
  }

  async simulateInboundCall(fromNumber: string, toNumber: string): Promise<InboundCallEvent> {
    const event: InboundCallEvent = {
      callId: `call_${uuid().slice(0, 8)}`,
      fromNumber,
      toNumber,
      receivedAt: new Date().toISOString(),
    };
    this.activeCalls.set(event.callId, { callId: event.callId, status: "ringing", timestamp: event.receivedAt });
    for (const handler of this.inboundHandlers) {
      await handler(event);
    }
    return event;
  }

  getCallStatus(callId: string): CallLifecycleEvent | undefined {
    return this.activeCalls.get(callId);
  }
}
