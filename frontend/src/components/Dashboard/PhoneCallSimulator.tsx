import { useState } from "react";
import { api } from "../../services/api";
import { CallTranscriptEntry, SUPPORTED_LANGUAGES, SupportedLanguageCode } from "../../types";
import { LanguageSelector } from "../VoiceAssistant/LanguageSelector";

type SimPhase = "idle" | "ringing" | "answering" | "connected" | "listening" | "thinking" | "speaking" | "ended";

const PHASE_LABEL: Record<SimPhase, string> = {
  idle: "Ready",
  ringing: "Incoming Call…",
  answering: "Answering…",
  connected: "Connected",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  ended: "Call Ended",
};

const PHASE_COLOR: Record<SimPhase, string> = {
  idle: "bg-gray-300",
  ringing: "bg-accent-400 animate-pulse",
  answering: "bg-accent-400 animate-pulse",
  connected: "bg-emerald-500",
  listening: "bg-emerald-500 animate-pulse",
  thinking: "bg-yellow-400 animate-pulse",
  speaking: "bg-brand-500 animate-pulse",
  ended: "bg-gray-400",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function languageLabel(code: SupportedLanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * A local, in-browser simulation of an inbound phone call — no real phone
 * network involved (see docs/TELEPHONY.md). Every message typed here is
 * answered by the exact same aiService/tool-calling pipeline the browser
 * voice widget uses, via the backend's callService + /api/calls/* routes.
 */
export function PhoneCallSimulator() {
  const [language, setLanguage] = useState<SupportedLanguageCode>("en");
  const [phase, setPhase] = useState<SimPhase>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<CallTranscriptEntry[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = phase !== "idle" && phase !== "ended";
  const canType = phase === "connected" || phase === "listening" || phase === "thinking" || phase === "speaking";

  const handleSimulateCall = async () => {
    setError(null);
    setTranscript([]);
    setDuration(null);
    try {
      setPhase("ringing");
      await sleep(600);
      setPhase("answering");
      const demoCustomerId = `demo-customer-${Date.now().toString(36)}`;
      const { call } = await api.simulateCall(language, demoCustomerId);
      setCallId(call.callId);
      await sleep(400);
      setPhase("connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the telephony provider.");
      setPhase("idle");
    }
  };

  const handleSend = async () => {
    const text = messageInput.trim();
    if (!text || !callId || sending) return;
    setSending(true);
    setError(null);
    setMessageInput("");
    try {
      setPhase("listening");
      await sleep(400);
      setPhase("thinking");
      await api.sendCallMessage(callId, text);
      setPhase("speaking");
      const { transcript: fullTranscript } = await api.getCall(callId);
      setTranscript(fullTranscript);
      await sleep(600);
      setPhase("connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI assistant is temporarily unavailable.");
      setPhase("connected");
    } finally {
      setSending(false);
    }
  };

  const handleEndCall = async () => {
    if (!callId) return;
    try {
      const { call } = await api.endCall(callId);
      setDuration(call.durationSeconds ?? null);
    } catch {
      // Ending is best-effort for the demo — still reset the UI either way.
    }
    setPhase("ended");
  };

  const handleReset = () => {
    setPhase("idle");
    setCallId(null);
    setTranscript([]);
    setDuration(null);
    setError(null);
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900">📞 Phone Call Simulator</h2>
          <p className="text-xs text-gray-500">+91 90000 00000 · Demo Customer — no real phone network involved</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-brand-25 px-3 py-1.5 text-xs font-semibold text-gray-700">
          <span className={`h-2 w-2 rounded-full ${PHASE_COLOR[phase]}`} />
          {PHASE_LABEL[phase]}
        </div>
      </div>

      {!isActive && phase !== "ended" && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <LanguageSelector value={language} onChange={setLanguage} variant="light" compact />
          <button onClick={handleSimulateCall} className="btn-primary shrink-0 text-sm">
            Simulate Incoming Call
          </button>
        </div>
      )}

      {phase === "ended" && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Call ended{duration !== null ? ` · duration ${duration}s` : ""}. Transcript stays below for review.
          </p>
          <button onClick={handleReset} className="btn-secondary shrink-0 text-sm">
            New Call
          </button>
        </div>
      )}

      {isActive && (
        <div className="mt-1 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-medium text-gray-500">Language: {languageLabel(language)}</span>
          <button onClick={handleEndCall} className="btn-secondary shrink-0 !border-red-100 !text-red-600 text-sm hover:!bg-red-50">
            End Call
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {(transcript.length > 0 || canType) && (
        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl2 border border-gray-100 bg-brand-25 p-3">
          {transcript.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">
              Type what the customer says below — e.g. “I need two kilos of basmati rice.”
            </p>
          ) : (
            transcript.map((entry, i) => (
              <div key={i} className={`flex ${entry.speaker === "customer" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    entry.speaker === "customer" ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm border border-gray-100 bg-white text-gray-800"
                  }`}
                >
                  <div className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wide ${entry.speaker === "customer" ? "text-white/70" : "text-gray-400"}`}>
                    {entry.speaker === "customer" ? "Customer" : "AI"} · {languageLabel(entry.language)} · {formatTime(entry.timestamp)}
                  </div>
                  {entry.text}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {canType && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type what the customer says…"
            aria-label="Type what the customer says"
            disabled={sending}
            className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button type="submit" disabled={sending || !messageInput.trim()} className="btn-primary text-sm">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
