const ITEMS = [
  { icon: "🎙️", label: "Voice Shopping" },
  { icon: "⚡", label: "Real-time Stock" },
  { icon: "🚚", label: "Fast Delivery" },
  { icon: "🔒", label: "Secure Orders" },
];

/** Small, elegant trust indicators — intentionally lightweight, not a grid of feature cards. */
export function TrustStrip() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-gray-100 bg-white px-5 py-3.5 shadow-soft sm:justify-between">
      {ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span className="text-base leading-none" aria-hidden="true">{item.icon}</span>
          {item.label}
        </div>
      ))}
    </div>
  );
}
