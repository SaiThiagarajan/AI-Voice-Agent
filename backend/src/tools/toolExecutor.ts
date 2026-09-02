import * as productService from "../services/productService.js";
import * as cartService from "../services/cartService.js";
import * as orderService from "../services/orderService.js";

/**
 * Executes a named tool call against the mock GroceryNxt data layer and
 * returns a JSON-serializable result to feed back to the AI model. This is
 * the ONLY path through which the AI can read/write business data — keeping
 * it centralized here makes it easy to audit and to swap the mock services
 * for real GroceryNxt API calls later without touching the AI layer.
 */
export async function executeTool(
  name: string,
  args: Record<string, any>,
  customerId: string
): Promise<unknown> {
  switch (name) {
    case "search_products": {
      const results = productService.searchProducts({
        query: args.query,
        category: args.category,
        inStockOnly: args.inStockOnly,
        limit: args.limit ?? 5,
      });
      return {
        count: results.length,
        products: results.map((r) => ({
          productId: r.product.id,
          name: r.product.name,
          brand: r.product.brand,
          category: r.product.category,
          quantity: r.product.quantity,
          mrp: r.product.price,
          discountPercent: r.product.discount,
          price: r.effectivePrice,
          inStock: r.inStock,
          stock: r.product.stock,
        })),
      };
    }

    case "get_product": {
      const result = productService.getProduct(args.productId);
      if (!result) return { found: false, error: "Product not found" };
      return {
        found: true,
        productId: result.product.id,
        name: result.product.name,
        brand: result.product.brand,
        category: result.product.category,
        quantity: result.product.quantity,
        mrp: result.product.price,
        discountPercent: result.product.discount,
        price: result.effectivePrice,
        inStock: result.inStock,
        stock: result.product.stock,
        description: result.product.description,
      };
    }

    case "check_inventory": {
      return productService.checkInventory(args.productId, args.requestedQty);
    }

    case "add_to_cart": {
      const result = cartService.addToCart(customerId, args.productId, args.qty);
      if (!result.ok) {
        return { ok: false, error: result.error, stock: "stock" in result ? result.stock : undefined };
      }
      return { ok: true, cart: result.cart };
    }

    case "update_cart_quantity": {
      const result = cartService.updateCartQuantity(customerId, args.productId, args.quantity);
      if (!result.ok) {
        return { ok: false, error: result.error, stock: "stock" in result ? result.stock : undefined };
      }
      return { ok: true, cart: result.cart, removed: result.removed ?? false };
    }

    case "remove_from_cart": {
      const result = cartService.removeFromCart(customerId, args.productId, args.qty);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, cart: result.cart };
    }

    case "get_cart": {
      return cartService.getCart(customerId);
    }

    case "create_order": {
      const result = orderService.createOrder(customerId, args.deliveryAddress);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, order: result.order };
    }

    case "get_order_status": {
      const result = orderService.getOrderStatus(args.orderId);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, order: result.order };
    }

    case "cancel_order": {
      const result = orderService.cancelOrder(args.orderId);
      if (!result.ok) return { ok: false, error: result.error, status: "status" in result ? result.status : undefined };
      return { ok: true, order: result.order };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
