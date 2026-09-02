import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API's SpeechRecognition type isn't in default TS DOM libs consistently.
interface SpeechRecognitionResultEvent extends Event {
  results: {
    [index: number]: { [index: number]: { transcript: string }; isFinal: boolean };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | undefined {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export const isSpeechRecognitionSupported = Boolean(getSpeechRecognitionCtor());

/** Maps raw SpeechRecognition error codes to customer-friendly messages — never surface the raw code. */
export function friendlyRecognitionError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Please allow microphone permissions and try again.";
    case "no-speech":
      return "I didn't hear anything. Please try again.";
    case "audio-capture":
      return "No microphone was found. Please check your device and try again.";
    case "network":
      // Chrome's SpeechRecognition streams audio to Google's own cloud speech
      // service (not this app's backend) — a "network" error means the browser
      // couldn't reach *that* service, independent of whether GroceryNxt's own
      // API is reachable. Worded to avoid implying our servers are the problem.
      return "Your browser couldn't reach the voice recognition service (this uses your browser's built-in speech service, separate from GroceryNxt's servers). Check your connection or try again.";
    default:
      return "Something went wrong with voice recognition. Please try again.";
  }
}

interface UseSpeechRecognitionOptions {
  lang: string;
  onFinalResult: (text: string) => void;
  /** Called with a friendly message whenever recognition fails (permission denied, no speech, etc). */
  onError?: (message: string) => void;
}

export function useSpeechRecognition({ lang, onFinalResult, onError }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalResultRef = useRef(onFinalResult);
  onFinalResultRef.current = onFinalResult;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) finalTranscript += transcript;
        else interim += transcript;
      }
      setInterimText(interim);
      if (finalTranscript.trim()) {
        onFinalResultRef.current(finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      // "aborted" fires on our own stop()/abort() calls — not a real error.
      if (event.error && event.error !== "aborted") {
        // Raw code only, never shown to the user — kept out of the friendly
        // message but logged so a "network" report can be told apart from a
        // permissions/hardware one in DevTools while triaging.
        console.error(`[useSpeechRecognition] recognition error: ${event.error} (lang=${recognition.lang})`);
        onErrorRef.current?.(friendlyRecognitionError(event.error));
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // start() throws if already started; ignore.
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, interimText, start, stop, supported: isSpeechRecognitionSupported };
}
