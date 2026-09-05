export type ProductCategory =
  | "Rice"
  | "Atta"
  | "Dal"
  | "Oil"
  | "Milk"
  | "Biscuits"
  | "Snacks"
  | "Vegetables"
  | "Fruits"
  | "Beverages"
  | "Household";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  quantity: string; // e.g. "1 kg", "500 ml"
  price: number; // MRP in INR
  discount: number; // percentage 0-100
  stock: number; // units available
  unit: "kg" | "g" | "l" | "ml" | "pcs";
  imageEmoji: string;
  description: string;
}

export interface ProductSearchQuery {
  query?: string;
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  limit?: number;
}

export function effectivePrice(product: Product): number {
  const discounted = product.price * (1 - product.discount / 100);
  return Math.round(discounted * 100) / 100;
}
