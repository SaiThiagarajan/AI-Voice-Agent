import { createContext, ReactNode, useContext, useState } from "react";
import { SupportedLanguageCode } from "../types";

interface LanguageContextValue {
  language: SupportedLanguageCode;
  setLanguage: (lang: SupportedLanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<SupportedLanguageCode>(() => {
    return (localStorage.getItem("gnx_language") as SupportedLanguageCode) || "en";
  });

  const update = (lang: SupportedLanguageCode) => {
    setLanguage(lang);
    localStorage.setItem("gnx_language", lang);
  };

  return <LanguageContext.Provider value={{ language, setLanguage: update }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
