import { getAllProducts, getProductById } from "../data/products.js";
import { Product, ProductCategory, ProductSearchQuery, effectivePrice } from "../types/product.js";

export interface ProductSearchResult {
  product: Product;
  effectivePrice: number;
  inStock: boolean;
}

function toResult(product: Product): ProductSearchResult {
  return {
    product,
    effectivePrice: effectivePrice(product),
    inStock: product.stock > 0,
  };
}

/**
 * Word-level match: a query token matches a haystack word if they're equal,
 * or (for tokens of 3+ characters) the word starts with the token — this
 * allows partial typing ("basmat" -> "basmati") without falling back to raw
 * substring containment, which would wrongly match e.g. "oil" inside
 * "parboiled" or "one" inside "stone".
 */
function tokenMatchesWord(token: string, word: string): boolean {
  if (token.length < 3) return token === word;
  return word === token || word.startsWith(token);
}

function matchScore(haystackWords: string[], tokens: string[]): number {
  return tokens.reduce((score, t) => score + (haystackWords.some((w) => tokenMatchesWord(t, w)) ? 1 : 0), 0);
}

/**
 * Keyword search across name/brand/category/description, ranked by how many
 * query tokens matched. This is the single source of truth the AI agent
 * must call through — it never invents product data itself.
 */
export function searchProducts(query: ProductSearchQuery): ProductSearchResult[] {
  const all = getAllProducts();
  const keyword = query.query?.trim().toLowerCase();
  const tokens = keyword ? keyword.split(/\s+/).filter(Boolean) : [];

  const filtered = all.filter((p) => {
    if (query.category && p.category !== query.category) return false;
    if (query.minPrice !== undefined && p.price < query.minPrice) return false;
    if (query.maxPrice !== undefined && p.price > query.maxPrice) return false;
    if (query.inStockOnly && p.stock <= 0) return false;
    if (tokens.length === 0) return true;

    const haystackWords = `${p.name} ${p.brand} ${p.category} ${p.description}`.toLowerCase().split(/\W+/).filter(Boolean);
    return matchScore(haystackWords, tokens) > 0;
  });

  let results = filtered;
  if (tokens.length > 0) {
    results = [...filtered].sort((a, b) => {
      const wordsA = `${a.name} ${a.brand} ${a.category} ${a.description}`.toLowerCase().split(/\W+/).filter(Boolean);
      const wordsB = `${b.name} ${b.brand} ${b.category} ${b.description}`.toLowerCase().split(/\W+/).filter(Boolean);
      return matchScore(wordsB, tokens) - matchScore(wordsA, tokens);
    });
  }

  if (query.limit) {
    results = results.slice(0, query.limit);
  }

  return results.map(toResult);
}

export function getProduct(id: string): ProductSearchResult | undefined {
  const product = getProductById(id);
  return product ? toResult(product) : undefined;
}

export function checkInventory(id: string, requestedQty: number): {
  productId: string;
  available: boolean;
  stock: number;
  requestedQty: number;
} {
  const product = getProductById(id);
  if (!product) {
    return { productId: id, available: false, stock: 0, requestedQty };
  }
  return {
    productId: id,
    available: product.stock >= requestedQty,
    stock: product.stock,
    requestedQty,
  };
}

export function listCategories(): ProductCategory[] {
  const set = new Set(getAllProducts().map((p) => p.category));
  return Array.from(set);
}
