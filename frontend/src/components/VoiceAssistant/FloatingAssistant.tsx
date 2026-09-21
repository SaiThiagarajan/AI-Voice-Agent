import { useVoiceAssistantContext } from "../../context/VoiceAssistantContext";
import { AssistantPanel } from "./AssistantPanel";

/**
 * A floating assistant, not a permanent docked panel: collapsed it's a
 * small card near the bottom-right; expanded it opens a compact panel
 * (desktop) or a bottom sheet (mobile) without blocking the rest of the
 * storefront, so shoppers can keep browsing while it's open. Both states
 * share the same VoiceAssistantContext session as the hero mic button.
 */
export function FloatingAssistant() {
  const { isPanelOpen, openPanel, closePanel, state } = useVoiceAssistantContext();
  const isActive = state === "listening" || state === "thinking" || state === "speaking";

  if (!isPanelOpen) {
    return (
      <button
        onClick={openPanel}
        aria-label="Open GroceryNxt AI assistant"
        className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg active:translate-y-0 active:scale-[0.99] sm:bottom-6 sm:left-auto sm:right-6 sm:w-[280px]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
            <span className={`h-2 w-2 rounded-full ${isActive ? "bg-accent-500 animate-pulse" : "bg-emerald-500"}`} />
            GroceryNxt AI
          </div>
          <div className="truncate text-xs text-muted">{isActive ? "Listening for your request…" : "Ask me anything..."}</div>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-base text-white">🎙️</span>
      </button>
    );
  }

  return (
    <>
      {/* Dim backdrop only on mobile, where the panel is a focused bottom sheet.
          Desktop has no backdrop so shoppers can keep browsing while it's open. */}
      <div className="fixed inset-0 z-40 bg-brand-950/30 backdrop-blur-[2px] sm:hidden" onClick={closePanel} />
      <div className="fixed inset-x-0 bottom-0 z-50 h-[85vh] animate-slide-up sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[520px] sm:w-[400px] sm:animate-scale-in">
        <AssistantPanel onClose={closePanel} className="!rounded-b-none sm:!rounded-2xl" />
      </div>
    </>
  );
}
