import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Cart } from "../types";
import { api } from "../services/api";

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  refresh: () => Promise<void>;
  addToCart: (productId: string, qty?: number) => Promise<void>;
  removeFromCart: (productId: string, qty?: number) => Promise<void>;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCart();
      setCart(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addToCart = useCallback(async (productId: string, qty = 1) => {
    const updated = await api.addToCart(productId, qty);
    setCart(updated);
  }, []);

  const removeFromCart = useCallback(async (productId: string, qty?: number) => {
    const updated = await api.removeFromCart(productId, qty);
    setCart(updated);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        refresh,
        addToCart,
        removeFromCart,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
