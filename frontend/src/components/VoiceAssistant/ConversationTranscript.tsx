import { useEffect, useRef } from "react";
import { ConversationMessage } from "../../types";

export function ConversationTranscript({
  messages,
  interimText,
  variant = "dark",
  emptyHint,
}: {
  messages: ConversationMessage[];
  interimText?: string;
  variant?: "dark" | "light";
  emptyHint?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const isDark = variant === "dark";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, interimText]);

  if (messages.length === 0 && !interimText) {
    return (
      <div className={`flex h-full items-center justify-center px-4 text-center text-sm ${isDark ? "text-white/60" : "text-gray-400"}`}>
        {emptyHint ?? (
          <>
            Tap the mic and say something like <br />“I need two kilos of basmati rice.”
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-1 py-2" role="log" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
              m.role === "user"
                ? isDark
                  ? "rounded-br-sm bg-white text-gray-800"
                  : "rounded-br-sm bg-brand-600 text-white"
                : isDark
                  ? "rounded-bl-sm bg-brand-700/90 text-white"
                  : "rounded-bl-sm border border-gray-100 bg-brand-50 text-gray-800"
            }`}
          >
            {m.content}
          </div>
        </div>
      ))}
      {interimText && (
        <div className="flex justify-end">
          <div
            className={`max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2 text-sm italic ${
              isDark ? "bg-white/60 text-gray-600" : "bg-gray-100 text-gray-500"
            }`}
          >
            {interimText}
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
