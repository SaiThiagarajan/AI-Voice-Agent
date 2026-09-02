import { useCallback, useState } from "react";
import { api } from "../services/api";
import { ConversationMessage, SUPPORTED_LANGUAGES, SupportedLanguageCode, VoiceAssistantState } from "../types";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useSpeechSynthesis } from "./useSpeechSynthesis";
import { useCart } from "../context/CartContext";

function speechLocaleFor(language: SupportedLanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === language)?.speechLocale ?? "en-IN";
}

/** A network-level fetch failure (backend unreachable) throws a generic TypeError, not our API's Error. */
function friendlyRequestError(err: unknown): string {
  if (err instanceof TypeError) {
    return "Can't reach the GroceryNxt server. Please check your connection and try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

export function useVoiceAssistant(language: SupportedLanguageCode) {
  const [state, setState] = useState<VoiceAssistantState>("idle");
  const [transcript, setTranscript] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { refresh: refreshCart } = useCart();

  const appendMessage = useCallback((role: ConversationMessage["role"], content: string) => {
    setTranscript((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, role, content, createdAt: new Date().toISOString() },
    ]);
  }, []);

  const { speak, cancel: cancelSpeech, isSpeaking, supported: ttsSupported } = useSpeechSynthesis();

  const handleUserUtterance = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      appendMessage("user", text);
      setState("thinking");
      setError(null);
      try {
        // customerId is the same persisted guest id the storefront's cart
        // uses, so tool calls the AI makes (add_to_cart, create_order, ...)
        // land on the exact cart the UI displays.
        const result = await api.sendAgentChat(text, language);
        appendMessage("assistant", result.response);
        await refreshCart();
        if (ttsSupported) {
          speak(result.response, speechLocaleFor(language));
        }
        setState("idle");
      } catch (err) {
        setError(friendlyRequestError(err));
        setState("error");
      }
    },
    [appendMessage, language, refreshCart, speak, ttsSupported]
  );

  const handleRecognitionError = useCallback((message: string) => {
    setError(message);
    setState("error");
  }, []);

  const { isListening, interimText, start, stop, supported: sttSupported } = useSpeechRecognition({
    lang: speechLocaleFor(language),
    onFinalResult: handleUserUtterance,
    onError: handleRecognitionError,
  });

  const startListening = useCallback(() => {
    // Interrupt any in-progress speech synthesis so the assistant never
    // talks over the customer, and only one utterance ever plays at once.
    cancelSpeech();
    setError(null);
    setState("listening");
    start();
  }, [cancelSpeech, start]);

  const stopListening = useCallback(() => {
    stop();
    setState("idle");
  }, [stop]);

  const sendTextMessage = useCallback(
    (text: string) => {
      cancelSpeech();
      handleUserUtterance(text);
    },
    [cancelSpeech, handleUserUtterance]
  );

  const reset = useCallback(() => {
    cancelSpeech();
    setTranscript([]);
    setState("idle");
    setError(null);
  }, [cancelSpeech]);

  const effectiveState: VoiceAssistantState = isSpeaking ? "speaking" : isListening ? "listening" : state;

  return {
    state: effectiveState,
    transcript,
    interimText,
    error,
    startListening,
    stopListening,
    sendTextMessage,
    reset,
    sttSupported,
    ttsSupported,
  };
}
