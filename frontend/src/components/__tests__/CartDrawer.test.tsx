import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart } from "../../context/CartContext";
import { CartDrawer } from "../CartDrawer";
import { api } from "../../services/api";
import { Cart } from "../../types";

/**
 * Regression coverage for: the cart drawer's +/- quantity buttons called
 * addToCart/removeFromCart directly with no error handling, unlike
 * ProductCard (which already catches and surfaces errors). Increasing a
 * quantity past available stock left an unhandled promise rejection and no
 * user-visible feedback. Fixed in CartDrawer.tsx by wrapping both actions
 * with the same catch-and-display pattern ProductCard already uses.
 */

vi.mock("../../services/api", () => ({
  api: {
    getCart: vi.fn(),
    addToCart: vi.fn(),
    removeFromCart: vi.fn(),
  },
}));

const mockCart: Cart = {
  cartId: "cart-1",
  customerId: "guest",
  items: [
    {
      productId: "RIC-001",
      name: "Basmati Rice",
      brand: "India Gate",
      quantityLabel: "1 kg",
      unitPrice: 162,
      qty: 2,
      lineTotal: 324,
    },
  ],
  subtotal: 324,
  updatedAt: new Date().toISOString(),
};

/** Opens the cart on mount so CartDrawer (which renders null while closed) is visible. */
function OpenCartHarness() {
  const { openCart } = useCart();
  useEffect(() => {
    openCart();
  }, [openCart]);
  return <CartDrawer />;
}

beforeEach(() => {
  vi.mocked(api.getCart).mockResolvedValue(mockCart);
  vi.mocked(api.addToCart).mockReset();
  vi.mocked(api.removeFromCart).mockReset();
});

describe("CartDrawer quantity buttons", () => {
  it("shows a friendly error instead of an unhandled rejection when increasing quantity fails", async () => {
    vi.mocked(api.addToCart).mockRejectedValue(new Error("Sorry, only 2 units of Basmati Rice are available right now."));

    render(
      <CartProvider>
        <OpenCartHarness />
      </CartProvider>
    );

    await waitFor(() => screen.getByText(/Basmati Rice/i));
    fireEvent.click(screen.getByLabelText(/Increase quantity of Basmati Rice/i));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/only 2 units/i);
    });
  });

  it("clears any previous error and updates the cart on a successful decrease", async () => {
    const updatedCart: Cart = {
      ...mockCart,
      items: [{ ...mockCart.items[0], qty: 1, lineTotal: 162 }],
      subtotal: 162,
    };
    vi.mocked(api.removeFromCart).mockResolvedValue(updatedCart);

    render(
      <CartProvider>
        <OpenCartHarness />
      </CartProvider>
    );

    await waitFor(() => screen.getByText(/Basmati Rice/i));
    fireEvent.click(screen.getByLabelText(/Decrease quantity of Basmati Rice/i));

    await waitFor(() => screen.getByText("1"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
