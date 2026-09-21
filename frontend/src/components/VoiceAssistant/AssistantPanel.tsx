import { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useVoiceAssistantContext } from "../../context/VoiceAssistantContext";
import { useApiHealth } from "../../hooks/useApiHealth";
import { LanguageSelector } from "./LanguageSelector";
import { ConversationTranscript } from "./ConversationTranscript";
import { StatusIndicator } from "./StatusIndicator";
import { VoiceWaveform } from "./VoiceWaveform";
import { SupportedLanguageCode } from "../../types";

const WELCOME_HINT: Record<SupportedLanguageCode, string> = {
  en: "👋 Hi! How can I help you today? Try “I need two kilos of basmati rice.”",
  ta: "வணக்கம்! 👋 இன்று நான் உங்களுக்கு எப்படி உதவலாம்?",
  te: "నమస్కారం! 👋 ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?",
  hi: "नमस्ते! 👋 आज मैं आपकी कैसे मदद कर सकता हूँ?",
};

/**
 * The real AI assistant panel — header, transcript, mic controls — backed
 * entirely by the shared VoiceAssistantContext (real SpeechRecognition +
 * SpeechSynthesis + backend agent calls). Used both docked in the desktop
 * layout and inside the mobile bottom sheet, so voice/transcript behavior
 * is identical everywhere it appears.
 */
export function AssistantPanel({ onClose, className = "" }: { onClose?: () => void; className?: string }) {
  const { language, setLanguage } = useLanguage();
  const apiOnline = useApiHealth();
  const [textInput, setTextInput] = useState("");
  const {
    state,
    transcript,
    interimText,
    error,
    startListening,
    stopListening,
    sendTextMessage,
    sttSupported,
  } = useVoiceAssistantContext();

  const isListening = state === "listening";
  const isWaveformActive = isListening || state === "speaking";

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendTextMessage(textInput.trim());
    setTextInput("");
  };

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-panel ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-base text-white">🤖</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-sm font-bold text-brand-900">GroceryNxt AI</h3>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          </div>
          <StatusIndicator state={state} connected={apiOnline} variant="light" />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close AI assistant"
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Language */}
      <div className="border-b border-gray-50 px-4 py-2">
        <LanguageSelector value={language} onChange={setLanguage} compact variant="light" />
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-hidden px-3 py-2">
        <ConversationTranscript messages={transcript} interimText={interimText} variant="light" emptyHint={WELCOME_HINT[language]} />
      </div>

      {error && (
        <p className="px-4 pb-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Controls */}
      <div className="border-t border-gray-100 bg-brand-25 p-3.5">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={!sttSupported}
            aria-pressed={isListening}
            aria-label={isListening ? "Stop listening" : "Start talking to GroceryNxt AI"}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg shadow-soft transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              isListening ? "bg-red-500 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {isListening && <span className="absolute inset-0 rounded-full bg-red-400 animate-pulse-ring" />}
            <span className="relative">{isListening ? "⏹" : "🎙️"}</span>
          </button>

          <div className="flex flex-1 flex-col gap-1">
            <VoiceWaveform active={isWaveformActive} />
            <span className="text-xs font-medium text-gray-500">
              {!sttSupported
                ? "Voice not supported — type below"
                : isListening
                  ? "Listening — tap to stop"
                  : "Tap the mic to start talking"}
            </span>
          </div>
        </div>

        <form onSubmit={handleTextSubmit} className="mt-2.5 flex gap-2">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={sttSupported ? "…or type your request" : "Type your message"}
            aria-label="Type a message to GroceryNxt AI"
            className="flex-1 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button type="submit" className="btn-primary !px-4 !py-2 text-sm">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
