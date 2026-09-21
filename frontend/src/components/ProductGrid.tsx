import { ProductSearchResult } from "../types";
import { ProductCard } from "./ProductCard";

// Viewport-based columns: 2 on mobile, 3 on tablet, 4-5 on desktop. Safe now
// that the page is a single wide column (no sidebar/panel squeezing this
// grid into a narrower container).
const GRID_COLS = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function ProductGrid({ results, loading }: { results: ProductSearchResult[]; loading: boolean }) {
  if (loading) {
    return (
      <div className={`grid ${GRID_COLS} gap-3 sm:gap-4`}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl2 bg-brand-100/60" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-brand-200 bg-white py-14 text-center">
        <span className="text-4xl">🔍</span>
        <p className="mt-3 font-semibold text-gray-700">No products found</p>
        <p className="text-sm text-muted">Try a different search term or category.</p>
      </div>
    );
  }

  return (
    <div className={`grid ${GRID_COLS} gap-3 sm:gap-4`}>
      {results.map((r) => (
        <ProductCard key={r.product.id} result={r} />
      ))}
    </div>
  );
}
