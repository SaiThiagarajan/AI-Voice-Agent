import { useCallback, useEffect, useRef, useState } from "react";

export const isSpeechSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!isSpeechSynthesisSupported) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const speak = useCallback((text: string, lang: string) => {
    if (!isSpeechSynthesisSupported || !text) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = voicesRef.current.find((v) => v.lang === lang) ?? voicesRef.current.find((v) => v.lang.startsWith(lang.split("-")[0]));
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if (!isSpeechSynthesisSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, cancel, isSpeaking, supported: isSpeechSynthesisSupported };
}
