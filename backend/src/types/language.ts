export type SupportedLanguageCode = "en" | "ta" | "te" | "hi";

export interface SupportedLanguage {
  code: SupportedLanguageCode;
  label: string;
  nativeLabel: string;
  speechLocale: string; // BCP-47 for browser SpeechRecognition/SpeechSynthesis
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English", speechLocale: "en-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", speechLocale: "ta-IN" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", speechLocale: "te-IN" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", speechLocale: "hi-IN" },
];

export function isSupportedLanguage(code: string): code is SupportedLanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}
