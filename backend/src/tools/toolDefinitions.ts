import { AIToolSpec } from "../providers/ai/AIProvider.js";

/**
 * Provider-agnostic tool schemas. Each tool maps 1:1 to a grocery service
 * function (see tools/toolExecutor.ts). The AI model can only affect the
 * world / read business data through these — it must never fabricate
 * product, price, stock or order information itself. AIProvider
 * implementations (e.g. OpenAIProvider) translate these into their own
 * vendor-specific tool/function format.
 */
export const toolDefinitions: AIToolSpec[] = [
  {
    name: "search_products",
    description:
      "Search the GroceryNxt product catalog by keyword and/or category. Use this whenever the customer mentions wanting to buy, find, or ask about a product (e.g. 'basmati rice', 'milk', 'dish soap').",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search keywords, e.g. 'basmati rice'" },
        category: {
          type: "string",
          enum: ["Rice", "Atta", "Dal", "Oil", "Milk", "Biscuits", "Snacks", "Vegetables", "Fruits", "Beverages", "Household"],
          description: "Optional product category filter",
        },
        inStockOnly: { type: "boolean", description: "If true, only return items currently in stock" },
        limit: { type: "number", description: "Max results to return, default 5" },
      },
    },
  },
  {
    name: "get_product",
    description: "Get full details for a single product by its exact product ID.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Product ID, e.g. RIC-001" },
      },
      required: ["productId"],
    },
  },
  {
    name: "check_inventory",
    description: "Check whether a specific quantity of a product is currently in stock before confirming an add-to-cart.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Product ID, e.g. RIC-001" },
        requestedQty: { type: "number", description: "Quantity the customer wants" },
      },
      required: ["productId", "requestedQty"],
    },
  },
  {
    name: "add_to_cart",
    description: "Add a specific quantity of a product to the customer's cart. Only call this after confirming the product and quantity with the customer.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        qty: { type: "number", description: "Number of units/packs to add" },
      },
      required: ["productId", "qty"],
    },
  },
  {
    name: "update_cart_quantity",
    description:
      "Set a product already relevant to the conversation to an ABSOLUTE final cart quantity — use this ONLY when the customer is CORRECTING or CHANGING a quantity they already stated, not when they are making a new purchase. Trigger phrases: 'actually make that 3', 'change it to 4', 'I only want 1', 'actually give me 5 instead', 'increase/decrease that to X'. update_cart_quantity(productId, 3) means the cart should end up with EXACTLY 3 of that product — it does NOT add 3 more on top of what's already there. For a brand-new purchase or an explicit additional purchase (e.g. 'I also need 3 kilos'), use add_to_cart instead.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Product ID, e.g. RIC-001" },
        quantity: { type: "number", description: "The FINAL absolute quantity the cart should hold for this product (not an amount to add)" },
      },
      required: ["productId", "quantity"],
    },
  },
  {
    name: "remove_from_cart",
    description: "Remove a product (or a specific quantity of it) from the customer's cart.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        qty: { type: "number", description: "Quantity to remove; omit to remove all of this item" },
      },
      required: ["productId"],
    },
  },
  {
    name: "get_cart",
    description: "Get the customer's current cart contents and subtotal.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "create_order",
    description: "Place an order for everything currently in the customer's cart. Only call this after the customer explicitly confirms they want to check out / place the order.",
    parameters: {
      type: "object",
      properties: {
        deliveryAddress: { type: "string", description: "Delivery address; if the customer hasn't given one, omit it to use their saved default." },
      },
    },
  },
  {
    name: "get_order_status",
    description: "Look up the status of an existing order by order ID.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "cancel_order",
    description: "Cancel an existing order by order ID, if it hasn't shipped yet.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
      },
      required: ["orderId"],
    },
  },
];
