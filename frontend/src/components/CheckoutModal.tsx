import { useState } from "react";
import { useCart } from "../context/CartContext";
import { api } from "../services/api";
import { Order } from "../types";

export function CheckoutModal({ onClose }: { onClose: () => void }) {
  const { cart, refresh } = useCart();
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setError(null);
    try {
      const created = await api.createOrder(address);
      setOrder(created);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Checkout">
      <div className="absolute inset-0 bg-brand-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md animate-fade-up rounded-2xl bg-white p-6 shadow-2xl">
        {order ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-3xl">✅</div>
            <h3 className="font-heading text-lg font-bold text-brand-950">Order placed!</h3>
            <p className="mt-1 text-sm text-gray-500">Order ID: {order.orderId}</p>
            <p className="mt-3 text-sm text-gray-600">
              Total <span className="font-bold text-gray-900">₹{order.total}</span> · Estimated delivery in{" "}
              {order.estimatedDeliveryMinutes} minutes
            </p>
            <p className="mt-3 rounded-full bg-brand-25 px-3 py-1.5 text-xs font-medium text-gray-500">
              Demo checkout — no real payment was processed.
            </p>
            <button className="btn-primary mt-5 w-full" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-bold text-accent-700">
              DEMO CHECKOUT — no real payment
            </div>
            <h3 className="font-heading text-lg font-bold text-brand-950">Confirm your order</h3>
            <p className="mt-1 text-sm text-gray-500">
              This is a mock checkout for demonstration only. Never share card, CVV, OTP, or UPI PIN details.
            </p>

            <div className="mt-4 space-y-1 rounded-xl2 bg-brand-25 p-4">
              {cart?.items.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm text-gray-700">
                  <span>
                    {item.qty} x {item.name}
                  </span>
                  <span className="font-semibold">₹{item.lineTotal}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 text-sm font-bold text-gray-900">
                <span>Subtotal</span>
                <span>₹{cart?.subtotal ?? 0}</span>
              </div>
            </div>

            <label htmlFor="delivery-address" className="mt-4 block text-sm font-medium text-gray-700">
              Delivery address
            </label>
            <textarea
              id="delivery-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 12 MG Road, Bengaluru (optional — uses saved default)"
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              rows={2}
            />

            {error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handlePlaceOrder} disabled={placing} className="btn-primary flex-1">
                {placing ? "Placing..." : "Place order"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
