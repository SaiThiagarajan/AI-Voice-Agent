export function PromoBanner({ onShopDeals }: { onShopDeals: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-900 px-6 py-8 text-white shadow-card sm:px-10 sm:py-10">
      <div className="pointer-events-none absolute -right-6 -top-6 text-8xl opacity-10" aria-hidden="true">
        🥬
      </div>
      <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <span className="inline-flex items-center rounded-full bg-accent-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-300">
            Fresh deals every day
          </span>
          <h2 className="mt-2 font-heading text-2xl font-extrabold sm:text-3xl">Save up to 40% on selected groceries</h2>
        </div>
        <button
          onClick={onShopDeals}
          className="shrink-0 rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-card active:translate-y-0 active:scale-95"
        >
          Shop Deals
        </button>
      </div>
    </section>
  );
}
