import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";

export function Header({ onSearch, searchValue }: { onSearch?: (value: string) => void; searchValue?: string }) {
  const { cart, openCart } = useCart();
  const location = useLocation();
  const itemCount = cart?.items.reduce((sum, i) => sum + i.qty, 0) ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl2 bg-brand-600 text-lg text-white shadow-soft">🛒</span>
            <span className="font-heading text-xl font-extrabold tracking-tight text-brand-900">
              Grocery<span className="text-accent-500">Nxt</span>
            </span>
          </Link>

          {onSearch && (
            <div className="hidden max-w-2xl flex-1 md:block">
              <div className="relative">
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search for rice, atta, milk, snacks..."
                  aria-label="Search products"
                  className="w-full rounded-full border border-gray-200 bg-brand-25 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                  🔍
                </span>
              </div>
            </div>
          )}

          <nav className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/dashboard"
              aria-label="Agent Dashboard"
              className={`hidden rounded-full px-4 py-2 text-sm font-semibold transition sm:inline-flex ${
                location.pathname === "/dashboard" ? "bg-brand-100 text-brand-800" : "text-gray-600 hover:bg-brand-50 hover:text-brand-800"
              }`}
            >
              Agent Dashboard
            </Link>
            <Link
              to="/dashboard"
              aria-label="Agent Dashboard"
              className={`inline-flex rounded-full p-2.5 transition sm:hidden ${
                location.pathname === "/dashboard" ? "bg-brand-100 text-brand-800" : "text-gray-600 hover:bg-brand-50 hover:text-brand-800"
              }`}
            >
              <span className="text-lg" aria-hidden="true">📊</span>
            </Link>
            <button
              onClick={openCart}
              className="relative rounded-full p-2.5 text-gray-600 transition hover:bg-brand-50 hover:text-brand-800"
              aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
            >
              <span className="text-lg" aria-hidden="true">🛍️</span>
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </button>
            <button
              className="hidden rounded-full p-2.5 text-gray-600 transition hover:bg-brand-50 hover:text-brand-800 sm:inline-flex"
              aria-label="Guest account"
              title="Guest"
            >
              <span className="text-lg" aria-hidden="true">👤</span>
            </button>
          </nav>
        </div>
        {onSearch && (
          <div className="pb-3 md:hidden">
            <div className="relative">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
                className="w-full rounded-full border border-gray-200 bg-brand-25 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-400 focus:bg-white"
              />
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                🔍
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
