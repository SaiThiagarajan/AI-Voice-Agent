import { VoiceAssistantState } from "../../types";

const STATE_LABEL: Record<VoiceAssistantState, string> = {
  idle: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Error",
};

const STATE_COLOR: Record<VoiceAssistantState, string> = {
  idle: "bg-gray-300",
  listening: "bg-accent-400",
  thinking: "bg-yellow-400",
  speaking: "bg-brand-500",
  error: "bg-red-500",
};

export function StatusIndicator({
  state,
  connected,
  variant = "dark",
}: {
  state: VoiceAssistantState;
  connected: boolean;
  variant?: "dark" | "light";
}) {
  const isDark = variant === "dark";
  const pulse = state === "listening" || state === "thinking" || state === "speaking";
  const textColor = isDark ? "text-white/80" : "text-gray-500";

  return (
    <div className={`flex items-center gap-3 text-xs ${textColor}`}>
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
        {connected ? "Connected" : "Offline"}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${STATE_COLOR[state]} ${pulse ? "animate-pulse" : ""}`} />
        {STATE_LABEL[state]}
      </span>
    </div>
  );
}
