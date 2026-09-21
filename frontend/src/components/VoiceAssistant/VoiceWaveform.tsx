const BAR_DELAYS_MS = [0, 120, 240, 360, 480, 360, 240, 120];

/**
 * Lightweight CSS-only waveform: a row of bars whose height pulses via the
 * shared `wave` keyframe (tailwind.config.js), staggered per bar. Active
 * only while `listening` so it reads as a live mic indicator rather than
 * decoration.
 */
export function VoiceWaveform({ active, tone = "brand" }: { active: boolean; tone?: "brand" | "white" }) {
  const barColor = tone === "white" ? "bg-white" : "bg-brand-500";
  return (
    <div className="flex h-6 items-center gap-1" role="presentation" aria-hidden="true">
      {BAR_DELAYS_MS.map((delay, i) => (
        <span
          key={i}
          className={`voice-bar w-1 rounded-full ${barColor}`}
          style={{
            height: "100%",
            animationDelay: `${delay}ms`,
            animationPlayState: active ? "running" : "paused",
            opacity: active ? 1 : 0.35,
            transform: active ? undefined : "scaleY(0.35)",
          }}
        />
      ))}
    </div>
  );
}
