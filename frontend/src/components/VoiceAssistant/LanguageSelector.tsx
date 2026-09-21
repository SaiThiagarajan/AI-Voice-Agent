import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from "../../types";

export function LanguageSelector({
  value,
  onChange,
  compact = false,
  variant = "dark",
}: {
  value: SupportedLanguageCode;
  onChange: (lang: SupportedLanguageCode) => void;
  compact?: boolean;
  variant?: "dark" | "light" | "inline";
}) {
  if (variant === "inline") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm" role="group" aria-label="Choose assistant language">
        {SUPPORTED_LANGUAGES.map((lang, i) => (
          <span key={lang.code} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300" aria-hidden="true">•</span>}
            <button
              onClick={() => onChange(lang.code)}
              aria-pressed={value === lang.code}
              className={`rounded-md px-1 py-0.5 font-medium transition ${
                value === lang.code ? "font-bold text-brand-700" : "text-muted hover:text-brand-600"
              }`}
            >
              {lang.nativeLabel}
            </button>
          </span>
        ))}
      </div>
    );
  }

  const isDark = variant === "dark";
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "justify-center" : ""}`} role="group" aria-label="Choose assistant language">
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = value === lang.code;
        return (
          <button
            key={lang.code}
            onClick={() => onChange(lang.code)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? isDark
                  ? "bg-white text-brand-700 shadow"
                  : "bg-brand-600 text-white shadow-soft"
                : isDark
                  ? "bg-white/15 text-white hover:bg-white/25"
                  : "bg-brand-50 text-brand-700 hover:bg-brand-100"
            }`}
          >
            {lang.nativeLabel}
          </button>
        );
      })}
    </div>
  );
}
