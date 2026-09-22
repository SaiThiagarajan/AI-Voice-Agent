import { useState } from "react";
import { useCart } from "../context/CartContext";
import { CheckoutModal } from "./CheckoutModal";

export function CartDrawer() {
  const { cart, isCartOpen, closeCart, removeFromCart, addToCart } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<{ productId: string; message: string } | null>(null);

  if (!isCartOpen) return null;

  const adjustQuantity = async (productId: string, delta: 1 | -1) => {
    setPendingProductId(productId);
    setItemError(null);
    try {
      if (delta === 1) await addToCart(productId, 1);
      else await removeFromCart(productId, 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't update quantity";
      setItemError({ productId, message });
      setTimeout(() => setItemError(null), 4000);
    } finally {
      setPendingProductId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-brand-950/30 backdrop-blur-[2px]" onClick={closeCart} />
      <div className="relative flex h-full w-full max-w-md flex-col animate-slide-in-right bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-brand-950">Your Cart</h2>
          <button onClick={closeCart} aria-label="Close cart" className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!cart || cart.items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
              <span className="text-4xl">🛒</span>
              <p className="mt-3 font-medium text-gray-700">Your cart is empty</p>
              <p className="text-sm">Add products or ask the AI assistant to add items for you.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 rounded-xl2 border border-gray-100 p-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl">🛍️</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800">
                      {item.brand} {item.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.quantityLabel} · ₹{item.unitPrice} each
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => adjustQuantity(item.productId, -1)}
                        disabled={pendingProductId === item.productId}
                        aria-label={`Decrease quantity of ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm font-semibold">{item.qty}</span>
                      <button
                        onClick={() => adjustQuantity(item.productId, 1)}
                        disabled={pendingProductId === item.productId}
                        aria-label={`Increase quantity of ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                    {itemError && itemError.productId === item.productId && (
                      <p className="mt-1 text-[11px] font-medium text-red-600" role="alert">
                        {itemError.message}
                      </p>
                    )}
                  </div>
                  <div className="text-sm font-bold text-gray-900">₹{item.lineTotal}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="border-t border-gray-100 bg-brand-25 px-5 py-4">
            <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-bold text-gray-900">₹{cart.subtotal}</span>
            </div>
            <button className="btn-primary w-full" onClick={() => setCheckoutOpen(true)}>
              Checkout
            </button>
          </div>
        )}
      </div>

      {checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} />}
    </div>
  );
}
