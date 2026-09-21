import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "../components/Header";
import { PromoStrip } from "../components/PromoStrip";
import { CategoryNav } from "../components/CategoryNav";
import { ProductGrid } from "../components/ProductGrid";
import { TrustStrip } from "../components/TrustStrip";
import { PromoBanner } from "../components/PromoBanner";
import { VoiceHero } from "../components/VoiceAssistant/VoiceHero";
import { FloatingAssistant } from "../components/VoiceAssistant/FloatingAssistant";
import { CartDrawer } from "../components/CartDrawer";
import { api } from "../services/api";
import { matchesUiCategory } from "../constants/categories";
import { ProductSearchResult } from "../types";

const BEST_SELLERS_COUNT = 10;

export function HomePage() {
  const [query, setQuery] = useState("");
  const [uiCategory, setUiCategory] = useState<string | null>(null);
  const [dealsOnly, setDealsOnly] = useState(false);
  const [allResults, setAllResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const productsRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    return api
      .searchProducts(query)
      .then((data) => {
        setAllResults(data.results);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    const timeout = setTimeout(fetchProducts, 200);
    return () => clearTimeout(timeout);
  }, [fetchProducts]);

  const results = allResults.filter((r) => {
    if (!matchesUiCategory(r.product.category, uiCategory)) return false;
    if (dealsOnly && r.product.discount <= 0) return false;
    return true;
  });

  // Default landing view splits into "Best Sellers" + "More Products"; any
  // active filter (category, search, deals) collapses to one focused grid.
  const isFiltering = Boolean(uiCategory) || Boolean(query.trim()) || dealsOnly;
  const bestSellers = isFiltering ? results : results.slice(0, BEST_SELLERS_COUNT);
  const moreProducts = isFiltering ? [] : results.slice(BEST_SELLERS_COUNT);

  const selectCategory = (id: string | null) => {
    setUiCategory(id);
    setDealsOnly(false);
  };

  const handleShopDeals = () => {
    setUiCategory(null);
    setDealsOnly(true);
    productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const primaryHeading = dealsOnly ? "Super Saver Deals" : isFiltering ? "Products" : "Best Sellers";
  const primarySubtitle = dealsOnly
    ? "Great prices, picked for you"
    : isFiltering
      ? `${results.length} item${results.length === 1 ? "" : "s"} found`
      : "Popular products customers love";

  return (
    <div className="min-h-screen bg-transparent">
      <PromoStrip />
      <Header onSearch={setQuery} searchValue={query} />

      <main className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:px-8">
        <VoiceHero />

        <CategoryNav active={uiCategory} onSelect={selectCategory} />

        <TrustStrip />

        <section ref={productsRef} aria-labelledby="best-sellers-heading" className="scroll-mt-24">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="best-sellers-heading" className="section-title">
                {primaryHeading}
              </h2>
              <p className="section-subtitle">{primarySubtitle}</p>
            </div>
            {!isFiltering && allResults.length > BEST_SELLERS_COUNT && (
              <button
                onClick={() => selectCategory(null)}
                className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                View all →
              </button>
            )}
          </div>
          {loadError ? (
            <div className="flex flex-col items-center justify-center rounded-xl2 border border-red-100 bg-red-50 py-14 text-center">
              <span className="text-4xl" aria-hidden="true">
                ⚠️
              </span>
              <p className="mt-3 font-semibold text-red-700">Can't connect to GroceryNxt</p>
              <p className="mt-1 max-w-sm text-sm text-red-600">
                We couldn't reach the store server. Make sure the backend is running, then try again.
              </p>
              <button onClick={fetchProducts} className="btn-primary mt-4">
                Retry
              </button>
            </div>
          ) : (
            <ProductGrid results={bestSellers} loading={loading} />
          )}
        </section>

        <PromoBanner onShopDeals={handleShopDeals} />

        {!loadError && moreProducts.length > 0 && (
          <section aria-labelledby="more-products-heading">
            <h2 id="more-products-heading" className="section-title mb-4">
              More Products
            </h2>
            <ProductGrid results={moreProducts} loading={false} />
          </section>
        )}
      </main>

      <CartDrawer />
      <FloatingAssistant />

      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-muted">
        GroceryNxt is a demo storefront built on the AI Voice Platform. Product data, prices, stock, and
        statistics shown are mocked for demonstration purposes only.
      </footer>
    </div>
  );
}
