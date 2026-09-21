import { useState } from "react";
import { ProductSearchResult } from "../types";
import { useCart } from "../context/CartContext";

export function ProductCard({ result }: { result: ProductSearchResult }) {
  const { product, effectivePrice, inStock } = result;
  const { addToCart, cart } = useCart();
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const inCartQty = cart?.items.find((i) => i.productId === product.id)?.qty ?? 0;
  const lowStock = inStock && product.stock <= 15;

  const handleAdd = async () => {
    setAdding(true);
    setAddError(null);
    try {
      await addToCart(product.id, 1);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't add to cart");
      setTimeout(() => setAddError(null), 4000);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl2 border border-gray-100 bg-white p-3 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:border-brand-300 hover:shadow-[0_10px_24px_-6px_rgba(22,163,74,0.22)]">
      <div className="mb-1 flex h-4 items-start justify-between gap-2">
        {product.discount > 0 && <span className="badge-offer">{product.discount}% OFF</span>}
        {!inStock && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-muted">Out of stock</span>}
      </div>

      <div className="mb-2.5 flex h-20 items-center justify-center rounded-xl bg-brand-25 text-4xl transition-transform duration-200 ease-out group-hover:scale-105">
        {product.imageEmoji}
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{product.brand}</div>
      <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-ink">{product.name}</h3>
      <div className="mt-0.5 text-xs text-muted">{product.quantity}</div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-base font-extrabold text-ink">₹{effectivePrice}</span>
        {product.discount > 0 && <span className="text-xs text-gray-400 line-through">₹{product.price}</span>}
      </div>

      {inStock && lowStock && <div className="mt-0.5 text-[11px] font-medium text-accent-600">Only {product.stock} left</div>}

      <button onClick={handleAdd} disabled={!inStock || adding} className="btn-primary mt-2.5 w-full !py-1.5 text-sm">
        {adding ? "Adding…" : inCartQty > 0 ? `In cart · ${inCartQty}` : "+ Add"}
      </button>
      {addError && <p className="mt-1 text-[11px] font-medium text-red-600">{addError}</p>}
    </div>
  );
}
