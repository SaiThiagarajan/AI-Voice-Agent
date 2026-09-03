import { store } from "../data/store.js";
import { getTelephonyProvider } from "../providers/telephony/index.js";
import * as aiService from "./aiService.js";
import { CallSession, CallTranscriptEntry, TelephonyCall } from "../types/telephony.js";
import { SupportedLanguageCode } from "../types/language.js";

const DEFAULT_FROM_NUMBER = "+91 90000 00000";
const DEFAULT_TO_NUMBER = "+91 80000 00000";

/**
 * Orchestrates a phone call end-to-end, on top of two existing building
 * blocks it does NOT duplicate:
 *
 *   - `providers/telephony/*` for the phone-network-level concerns (ringing,
 *     answering, ending a call).
 *   - `services/aiService.ts` for ALL AI reasoning and tool-calling — the
 *     exact same code path the browser voice agent uses. A phone call is
 *     just a `ConversationSession` with `channel: "phone"`; the AI, the
 *     grocery tools, and the mock data layer neither know nor care whether
 *     the words came from a browser microphone or a phone call.
 *
 * This is the "ONE AI brain" the architecture requires: browser voice and
 * phone calls both terminate in `aiService.sendMessage()`.
 */

export type CreateCallResult =
  | { ok: true; call: TelephonyCall }
  | { ok: false; error: "INVALID_LANGUAGE" };

export function createCall(
  customerId: string,
  language: SupportedLanguageCode,
  fromNumber = DEFAULT_FROM_NUMBER
): Promise<CreateCallResult> {
  return doCreateCall(customerId, language, fromNumber);
}

async function doCreateCall(customerId: string, language: SupportedLanguageCode, fromNumber: string): Promise<CreateCallResult> {
  const provider = getTelephonyProvider();
  const inbound = await provider.simulateInboundCall(fromNumber, DEFAULT_TO_NUMBER);

  // Auto-answer immediately — this is a turn-based REST simulation, not a
  // real ringing phone, so there's no reason to make the caller wait. The
  // frontend simulator still animates "Incoming call... -> Answering... ->
  // Connected" for the demo feel; the backend just settles straight to
  // "connected".
  await provider.answerCall(inbound.callId);

  const now = new Date().toISOString();
  const call: TelephonyCall = {
    callId: inbound.callId,
    customerId,
    phoneNumber: fromNumber,
    language,
    status: "connected",
    startedAt: now,
  };
  store.calls.set(call.callId, call);

  // Pre-create the conversation session with channel "phone" so the
  // dashboard can distinguish phone calls from browser sessions.
  // aiService.sendMessage() will find and reuse this exact session on the
  // first message rather than creating a fresh "web" one — see
  // aiService.getOrCreateSession (it returns an existing session by id
  // untouched, regardless of the channel argument passed on lookup).
  aiService.getOrCreateSession(call.callId, customerId, "phone", language);

  return { ok: true, call };
}

export type SendCallMessageResult =
  | { ok: true; call: TelephonyCall; response: string; toolCalls: aiService.ToolCallSummary[]; ordersCreated: string[] }
  | { ok: false; error: "CALL_NOT_FOUND" | "CALL_ENDED" };

export async function sendCallMessage(callId: string, message: string): Promise<SendCallMessageResult> {
  const call = store.calls.get(callId);
  if (!call) return { ok: false, error: "CALL_NOT_FOUND" };
  if (call.status === "ended") return { ok: false, error: "CALL_ENDED" };

  const provider = getTelephonyProvider();

  const result = await aiService.sendMessage(callId, message, call.language);

  // "Speak" the reply back through the telephony provider (a no-op for the
  // mock — see MockTelephonyProvider.playAudio — but exercises the same
  // interface a real provider would use to send TTS audio to the caller).
  await provider.playAudio({ callId, text: result.reply, languageCode: call.language });

  call.status = "connected"; // settled back to "ready for next turn" after this synchronous turn completes
  store.calls.set(callId, call);

  return { ok: true, call, response: result.reply, toolCalls: result.toolCalls, ordersCreated: result.session.ordersCreated };
}

export type GetCallResult = { ok: true; session: CallSession } | { ok: false; error: "CALL_NOT_FOUND" };

export function getCall(callId: string): GetCallResult {
  const call = store.calls.get(callId);
  if (!call) return { ok: false, error: "CALL_NOT_FOUND" };
  return { ok: true, session: { call, transcript: buildTranscript(call) } };
}

export type EndCallResult = { ok: true; call: TelephonyCall } | { ok: false; error: "CALL_NOT_FOUND" };

export async function endCall(callId: string): Promise<EndCallResult> {
  const call = store.calls.get(callId);
  if (!call) return { ok: false, error: "CALL_NOT_FOUND" };

  const provider = getTelephonyProvider();
  await provider.endCall(callId);
  aiService.endSession(callId); // computes and stores call duration on the conversation session

  const session = aiService.getOrCreateSession(callId, call.customerId, "phone", call.language);
  call.status = "ended";
  call.endedAt = session.updatedAt;
  call.durationSeconds = session.callDurationSeconds;
  store.calls.set(callId, call);

  return { ok: true, call };
}

/**
 * The transcript is derived from the aiService conversation session rather
 * than stored a second time here — the session's `messages` are already the
 * single source of truth for what was said, for both browser and phone
 * conversations.
 */
function buildTranscript(call: TelephonyCall): CallTranscriptEntry[] {
  const session = aiService.getOrCreateSession(call.callId, call.customerId, "phone", call.language);
  return session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      speaker: m.role === "user" ? "customer" : "ai",
      language: session.language,
      text: m.content,
      timestamp: m.createdAt,
    }));
}
