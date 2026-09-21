import { useLanguage } from "../../context/LanguageContext";
import { useVoiceAssistantContext } from "../../context/VoiceAssistantContext";
import { useApiHealth } from "../../hooks/useApiHealth";
import { LanguageSelector } from "./LanguageSelector";
import { VoiceWaveform } from "./VoiceWaveform";

const TRUST_POINTS = ["Search products", "Check stock", "Add to cart"];

/**
 * The primary "AI voice shopping" hero. Deliberately compact (~340px on
 * desktop, not a full-viewport block) so the page still reads as a grocery
 * storefront first. The mic button drives the same shared voice-assistant
 * session used by the floating assistant panel.
 */
export function VoiceHero() {
  const { language, setLanguage } = useLanguage();
  const apiOnline = useApiHealth();
  const { state, error, beginConversation, stopListening, sttSupported } = useVoiceAssistantContext();
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isError = state === "error";
  const isIdle = !isListening && !isThinking && !isSpeaking && !isError;

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      beginConversation();
    }
  };

  return (
    <section
      aria-labelledby="voice-hero-heading"
      className="rounded-2xl border border-brand-100 bg-brand-50/60 px-6 py-8 sm:px-10 sm:py-10"
    >
      <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* Left: copy */}
        <div>
          <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">
            AI Powered Voice Shopping
          </span>
          <h1 id="voice-hero-heading" className="mt-3 font-heading text-3xl font-extrabold leading-[1.15] text-brand-900 sm:text-[2.6rem]">
            Your Grocery Shopping,
            <br />
            Now Hands-Free.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
            Just speak naturally. Our AI can find products, check availability, add items to your cart and
            help you complete your order.
          </p>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-1.5 text-sm font-medium text-brand-800">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white" aria-hidden="true">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: voice interaction card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <span className="font-heading text-sm font-bold text-brand-900">GroceryNxt AI</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <span className={`h-1.5 w-1.5 rounded-full ${apiOnline ? "bg-emerald-500" : "bg-red-500"}`} />
              {apiOnline ? "Online" : "Offline"}
            </span>
          </div>

          <div className="mt-5 flex flex-col items-center">
            <button
              onClick={handleMicClick}
              aria-pressed={isListening}
              aria-label={isListening ? "Stop listening" : "Tap to talk to GroceryNxt AI"}
              className={`group relative flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white shadow-panel transition active:scale-95 ${
                isError ? "bg-red-500 hover:bg-red-600" : "bg-brand-600 hover:bg-brand-700"
              } ${isIdle && sttSupported ? "animate-breathe" : ""} ${isSpeaking ? "shadow-[0_0_0_10px_rgba(34,197,94,0.16)]" : ""}`}
            >
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-brand-400 animate-pulse-ring" />
                  <span className="absolute inset-0 rounded-full bg-brand-400 animate-pulse-ring [animation-delay:0.6s]" />
                </>
              )}
              {isThinking && (
                <span className="absolute -inset-1 rounded-full border-2 border-brand-300 border-t-transparent animate-spin" aria-hidden="true" />
              )}
              <span className="relative">{isListening ? "⏹" : isError ? "⚠️" : isSpeaking ? "🔊" : "🎙️"}</span>
            </button>

            <div className="mt-3 h-5">
              <VoiceWaveform active={isListening || isSpeaking} />
            </div>

            <span className={`mt-1 text-center text-sm font-semibold ${isError ? "text-red-600" : "text-brand-800"}`}>
              {!sttSupported
                ? "Voice not supported in this browser"
                : isListening
                  ? "Listening…"
                  : isThinking
                    ? "Thinking…"
                    : isSpeaking
                      ? "Speaking…"
                      : isError
                        ? error ?? "Something went wrong. Please try again."
                        : "Tap to talk"}
            </span>

            <div className="mt-4 w-full border-t border-gray-100 pt-3">
              <LanguageSelector value={language} onChange={setLanguage} variant="inline" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
