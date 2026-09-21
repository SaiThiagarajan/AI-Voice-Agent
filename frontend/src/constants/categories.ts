import { ProductCategory } from "../types";

/**
 * Storefront category taxonomy for the horizontal category nav. Each UI
 * category maps to one or more real backend categories, so filtering still
 * runs against the existing mock API/data — no backend changes required.
 * "Personal Care" has no backing products yet; it renders with a graceful
 * empty state rather than being hidden, since real storefronts commonly
 * carry placeholder categories.
 */
export interface UiCategory {
  id: string;
  label: string;
  emoji: string;
  categories: ProductCategory[];
}

export const UI_CATEGORIES: UiCategory[] = [
  { id: "rice", label: "Rice", emoji: "🍚", categories: ["Rice"] },
  { id: "atta", label: "Atta", emoji: "🌾", categories: ["Atta"] },
  { id: "dal", label: "Dal", emoji: "🫘", categories: ["Dal"] },
  { id: "oil", label: "Oil", emoji: "🛢️", categories: ["Oil"] },
  { id: "milk", label: "Milk", emoji: "🥛", categories: ["Milk"] },
  { id: "biscuits", label: "Biscuits", emoji: "🍪", categories: ["Biscuits"] },
  { id: "snacks", label: "Snacks", emoji: "🥨", categories: ["Snacks"] },
  { id: "fruits", label: "Fruits", emoji: "🍎", categories: ["Fruits"] },
  { id: "vegetables", label: "Vegetables", emoji: "🥕", categories: ["Vegetables"] },
  { id: "beverages", label: "Beverages", emoji: "☕", categories: ["Beverages"] },
  { id: "household", label: "Household", emoji: "🧽", categories: ["Household"] },
  { id: "personal-care", label: "Personal Care", emoji: "🧴", categories: [] },
];

export function matchesUiCategory(productCategory: ProductCategory, uiCategoryId: string | null): boolean {
  if (!uiCategoryId) return true;
  const uiCategory = UI_CATEGORIES.find((c) => c.id === uiCategoryId);
  if (!uiCategory) return true;
  return uiCategory.categories.includes(productCategory);
}
