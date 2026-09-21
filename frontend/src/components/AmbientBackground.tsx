const CORNER_MOTIFS = [
  { icon: "🍃", className: "left-[3%] top-[8%]", rotate: "-12deg" },
  { icon: "🍊", className: "right-[4%] top-[14%]", rotate: "10deg" },
  { icon: "🥦", className: "left-[2%] top-[62%]", rotate: "8deg" },
  { icon: "🧺", className: "right-[3%] top-[70%]", rotate: "-8deg" },
  { icon: "🍃", className: "left-[6%] top-[92%]", rotate: "15deg" },
];

/**
 * Fixed, decorative-only backdrop: a couple of soft green gradient blobs plus
 * a handful of near-invisible grocery motifs confined to the page margins.
 * Purely visual — sits behind everything (pointer-events-none, -z-10) and is
 * hidden below `lg` where there's no real margin space for it to live in
 * without crowding content.
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/60 blur-3xl" />
      <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-brand-200/40 blur-3xl" />
      <div className="absolute -left-24 bottom-0 h-[24rem] w-[24rem] rounded-full bg-accent-100/30 blur-3xl" />

      <div className="hidden lg:block">
        {CORNER_MOTIFS.map((motif, i) => (
          <span
            key={i}
            className={`absolute select-none text-6xl opacity-[0.06] ${motif.className}`}
            style={{ transform: `rotate(${motif.rotate})` }}
          >
            {motif.icon}
          </span>
        ))}
      </div>
    </div>
  );
}
