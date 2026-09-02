import { createContext, ReactNode, useContext, useState } from "react";
import { useLanguage } from "./LanguageContext";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";

type VoiceAssistantValue = ReturnType<typeof useVoiceAssistant> & {
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  /** Opens the panel (mobile bottom sheet) and immediately starts listening. */
  beginConversation: () => void;
};

const VoiceAssistantContext = createContext<VoiceAssistantValue | undefined>(undefined);

/**
 * A single shared voice-assistant session (transcript, mic state, TTS) used
 * by both the hero "Talk to GroceryNxt AI" button and the docked/overlay
 * assistant panel, so they always reflect the same live conversation
 * instead of each holding an independent SpeechRecognition instance.
 */
export function VoiceAssistantProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const assistant = useVoiceAssistant(language);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const beginConversation = () => {
    setIsPanelOpen(true);
    if (assistant.sttSupported) {
      assistant.startListening();
    }
  };

  return (
    <VoiceAssistantContext.Provider
      value={{
        ...assistant,
        isPanelOpen,
        openPanel: () => setIsPanelOpen(true),
        closePanel: () => setIsPanelOpen(false),
        beginConversation,
      }}
    >
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistantContext(): VoiceAssistantValue {
  const ctx = useContext(VoiceAssistantContext);
  if (!ctx) throw new Error("useVoiceAssistantContext must be used within VoiceAssistantProvider");
  return ctx;
}
