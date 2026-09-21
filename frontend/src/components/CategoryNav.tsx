import { UI_CATEGORIES } from "../constants/categories";

/** Compact horizontal category pill nav — the only category navigation surface at every breakpoint. */
export function CategoryNav({
  active,
  onSelect,
}: {
  active: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Product categories">
      <CategoryPill label="All" emoji="🛒" active={active === null} onClick={() => onSelect(null)} />
      {UI_CATEGORIES.map((cat) => (
        <CategoryPill key={cat.id} label={cat.label} emoji={cat.emoji} active={active === cat.id} onClick={() => onSelect(cat.id)} />
      ))}
    </div>
  );
}

function CategoryPill({ label, emoji, active, onClick }: { label: string; emoji: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-95 ${
        active
          ? "border-brand-600 bg-brand-600 text-white shadow-soft"
          : "border-gray-200 bg-white text-gray-700 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:shadow-soft"
      }`}
    >
      <span className="text-base leading-none" aria-hidden="true">{emoji}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
