import { Product } from "../types/product.js";

/**
 * Mock GroceryNxt product catalog. This stands in for the real GroceryNxt
 * backend/database, which we do not have access to. All prices, stock and
 * discount figures are fictional but realistic for an Indian grocery
 * e-commerce store. The AI layer must always read from this data (via
 * services/tools) and must never invent values.
 */
export const products: Product[] = [
  // Rice
  { id: "RIC-001", name: "Basmati Rice", brand: "India Gate", category: "Rice", quantity: "1 kg", price: 180, discount: 10, stock: 120, unit: "kg", imageEmoji: "🍚", description: "Premium aged basmati rice with long grains and rich aroma." },
  { id: "RIC-002", name: "Basmati Rice", brand: "Daawat", category: "Rice", quantity: "5 kg", price: 850, discount: 12, stock: 45, unit: "kg", imageEmoji: "🍚", description: "Extra-long grain basmati rice, family pack." },
  { id: "RIC-003", name: "Sona Masoori Rice", brand: "Fortune", category: "Rice", quantity: "1 kg", price: 95, discount: 5, stock: 200, unit: "kg", imageEmoji: "🍚", description: "Lightweight, easy-to-digest everyday rice." },
  { id: "RIC-004", name: "Brown Rice", brand: "Kohinoor", category: "Rice", quantity: "1 kg", price: 140, discount: 0, stock: 60, unit: "kg", imageEmoji: "🍚", description: "Unpolished whole grain brown rice, high in fiber." },
  { id: "RIC-005", name: "Idli Rice", brand: "Aashirvaad", category: "Rice", quantity: "2 kg", price: 160, discount: 8, stock: 80, unit: "kg", imageEmoji: "🍚", description: "Parboiled rice ideal for soft idlis and dosas." },

  // Atta
  { id: "ATT-001", name: "Whole Wheat Atta", brand: "Aashirvaad", category: "Atta", quantity: "5 kg", price: 260, discount: 6, stock: 150, unit: "kg", imageEmoji: "🌾", description: "100% whole wheat atta, stone ground for soft rotis." },
  { id: "ATT-002", name: "Multigrain Atta", brand: "Fortune", category: "Atta", quantity: "5 kg", price: 320, discount: 10, stock: 70, unit: "kg", imageEmoji: "🌾", description: "Blend of wheat, soya, oats and 5 other grains." },
  { id: "ATT-003", name: "Whole Wheat Atta", brand: "Pillsbury", category: "Atta", quantity: "1 kg", price: 62, discount: 0, stock: 220, unit: "kg", imageEmoji: "🌾", description: "Finely milled chakki atta." },

  // Dal
  { id: "DAL-001", name: "Toor Dal", brand: "Tata Sampann", category: "Dal", quantity: "1 kg", price: 165, discount: 8, stock: 100, unit: "kg", imageEmoji: "🫘", description: "Unpolished, naturally processed toor dal." },
  { id: "DAL-002", name: "Moong Dal", brand: "Tata Sampann", category: "Dal", quantity: "1 kg", price: 150, discount: 5, stock: 90, unit: "kg", imageEmoji: "🫘", description: "Yellow moong dal, high protein." },
  { id: "DAL-003", name: "Chana Dal", brand: "Fortune", category: "Dal", quantity: "1 kg", price: 110, discount: 0, stock: 130, unit: "kg", imageEmoji: "🫘", description: "Split chickpea lentils." },
  { id: "DAL-004", name: "Urad Dal", brand: "Organic Tattva", category: "Dal", quantity: "500 g", price: 95, discount: 10, stock: 75, unit: "g", imageEmoji: "🫘", description: "Whole black gram, organic certified." },

  // Oil
  { id: "OIL-001", name: "Sunflower Oil", brand: "Fortune", category: "Oil", quantity: "1 l", price: 145, discount: 8, stock: 140, unit: "l", imageEmoji: "🛢️", description: "Refined sunflower oil, light and healthy." },
  { id: "OIL-002", name: "Groundnut Oil", brand: "Gemini", category: "Oil", quantity: "1 l", price: 210, discount: 5, stock: 60, unit: "l", imageEmoji: "🛢️", description: "Cold-pressed groundnut oil for traditional cooking." },
  { id: "OIL-003", name: "Mustard Oil", brand: "Dhara", category: "Oil", quantity: "1 l", price: 175, discount: 0, stock: 85, unit: "l", imageEmoji: "🛢️", description: "Pure kachi ghani mustard oil." },
  { id: "OIL-004", name: "Olive Oil", brand: "Figaro", category: "Oil", quantity: "500 ml", price: 399, discount: 15, stock: 40, unit: "ml", imageEmoji: "🛢️", description: "Extra light olive oil for everyday cooking." },

  // Milk
  { id: "MLK-001", name: "Toned Milk", brand: "Amul", category: "Milk", quantity: "500 ml", price: 28, discount: 0, stock: 300, unit: "ml", imageEmoji: "🥛", description: "Fresh toned milk, pasteurized." },
  { id: "MLK-002", name: "Full Cream Milk", brand: "Nandini", category: "Milk", quantity: "1 l", price: 62, discount: 0, stock: 180, unit: "l", imageEmoji: "🥛", description: "Rich and creamy full cream milk." },
  { id: "MLK-003", name: "UHT Milk", brand: "Amul", category: "Milk", quantity: "1 l", price: 68, discount: 5, stock: 150, unit: "l", imageEmoji: "🥛", description: "Long-life UHT toned milk, no refrigeration needed until opened." },
  { id: "MLK-004", name: "Curd", brand: "Mother Dairy", category: "Milk", quantity: "400 g", price: 45, discount: 0, stock: 200, unit: "g", imageEmoji: "🥛", description: "Fresh thick curd." },

  // Biscuits
  { id: "BIS-001", name: "Marie Gold", brand: "Parle", category: "Biscuits", quantity: "250 g", price: 35, discount: 0, stock: 260, unit: "g", imageEmoji: "🍪", description: "Light and crispy marie biscuits." },
  { id: "BIS-002", name: "Good Day Cashew", brand: "Britannia", category: "Biscuits", quantity: "200 g", price: 40, discount: 10, stock: 190, unit: "g", imageEmoji: "🍪", description: "Butter cookies loaded with cashew bits." },
  { id: "BIS-003", name: "Oreo Original", brand: "Cadbury", category: "Biscuits", quantity: "120 g", price: 30, discount: 0, stock: 240, unit: "g", imageEmoji: "🍪", description: "Chocolate sandwich cookies with cream filling." },
  { id: "BIS-004", name: "Digestive", brand: "McVitie's", category: "Biscuits", quantity: "400 g", price: 95, discount: 8, stock: 110, unit: "g", imageEmoji: "🍪", description: "Wheat digestive biscuits." },

  // Snacks
  { id: "SNK-001", name: "Aloo Bhujia", brand: "Haldiram's", category: "Snacks", quantity: "200 g", price: 55, discount: 0, stock: 170, unit: "g", imageEmoji: "🥨", description: "Crunchy spiced potato noodles." },
  { id: "SNK-002", name: "Classic Salted Chips", brand: "Lay's", category: "Snacks", quantity: "52 g", price: 20, discount: 0, stock: 400, unit: "g", imageEmoji: "🍟", description: "Crispy salted potato chips." },
  { id: "SNK-003", name: "Roasted Makhana", brand: "Happilo", category: "Snacks", quantity: "100 g", price: 120, discount: 12, stock: 95, unit: "g", imageEmoji: "🥜", description: "Lightly salted roasted fox nuts, healthy snack." },
  { id: "SNK-004", name: "Trail Mix", brand: "Nutraj", category: "Snacks", quantity: "200 g", price: 210, discount: 10, stock: 60, unit: "g", imageEmoji: "🥜", description: "Mixed dry fruits, nuts and seeds." },

  // Vegetables
  { id: "VEG-001", name: "Onion", brand: "Farm Fresh", category: "Vegetables", quantity: "1 kg", price: 35, discount: 0, stock: 500, unit: "kg", imageEmoji: "🧅", description: "Fresh red onions." },
  { id: "VEG-002", name: "Tomato", brand: "Farm Fresh", category: "Vegetables", quantity: "1 kg", price: 40, discount: 0, stock: 450, unit: "kg", imageEmoji: "🍅", description: "Farm fresh, ripe tomatoes." },
  { id: "VEG-003", name: "Potato", brand: "Farm Fresh", category: "Vegetables", quantity: "1 kg", price: 30, discount: 0, stock: 600, unit: "kg", imageEmoji: "🥔", description: "Fresh potatoes, ideal for daily cooking." },
  { id: "VEG-004", name: "Spinach", brand: "Farm Fresh", category: "Vegetables", quantity: "250 g", price: 22, discount: 0, stock: 150, unit: "g", imageEmoji: "🥬", description: "Fresh, washed spinach leaves." },
  { id: "VEG-005", name: "Carrot", brand: "Farm Fresh", category: "Vegetables", quantity: "500 g", price: 28, discount: 0, stock: 220, unit: "g", imageEmoji: "🥕", description: "Crunchy fresh carrots." },

  // Fruits
  { id: "FRU-001", name: "Banana", brand: "Farm Fresh", category: "Fruits", quantity: "1 dozen", price: 60, discount: 0, stock: 300, unit: "pcs", imageEmoji: "🍌", description: "Naturally ripened bananas." },
  { id: "FRU-002", name: "Apple (Shimla)", brand: "Farm Fresh", category: "Fruits", quantity: "1 kg", price: 180, discount: 5, stock: 140, unit: "kg", imageEmoji: "🍎", description: "Crisp and juicy Shimla apples." },
  { id: "FRU-003", name: "Alphonso Mango", brand: "Farm Fresh", category: "Fruits", quantity: "1 kg", price: 320, discount: 10, stock: 50, unit: "kg", imageEmoji: "🥭", description: "Premium Alphonso mangoes, seasonal." },
  { id: "FRU-004", name: "Pomegranate", brand: "Farm Fresh", category: "Fruits", quantity: "1 kg", price: 150, discount: 0, stock: 90, unit: "kg", imageEmoji: "🍎", description: "Sweet and juicy pomegranates." },

  // Beverages
  { id: "BEV-001", name: "Tea Powder", brand: "Tata Tea Gold", category: "Beverages", quantity: "500 g", price: 245, discount: 8, stock: 130, unit: "g", imageEmoji: "🍵", description: "Rich and aromatic blended tea." },
  { id: "BEV-002", name: "Instant Coffee", brand: "Nescafé", category: "Beverages", quantity: "100 g", price: 285, discount: 5, stock: 100, unit: "g", imageEmoji: "☕", description: "Classic instant coffee granules." },
  { id: "BEV-003", name: "Orange Juice", brand: "Real", category: "Beverages", quantity: "1 l", price: 110, discount: 0, stock: 160, unit: "l", imageEmoji: "🧃", description: "100% fruit juice, no added sugar." },
  { id: "BEV-004", name: "Cola", brand: "Coca-Cola", category: "Beverages", quantity: "750 ml", price: 40, discount: 0, stock: 250, unit: "ml", imageEmoji: "🥤", description: "Chilled carbonated soft drink." },

  // Household
  { id: "HHD-001", name: "Dishwash Liquid", brand: "Vim", category: "Household", quantity: "750 ml", price: 165, discount: 10, stock: 120, unit: "ml", imageEmoji: "🧴", description: "Lemon-fresh dishwashing liquid, cuts grease fast." },
  { id: "HHD-002", name: "Detergent Powder", brand: "Surf Excel", category: "Household", quantity: "1 kg", price: 135, discount: 5, stock: 140, unit: "kg", imageEmoji: "🧺", description: "Stain-removing detergent powder." },
  { id: "HHD-003", name: "Floor Cleaner", brand: "Lizol", category: "Household", quantity: "975 ml", price: 199, discount: 12, stock: 85, unit: "ml", imageEmoji: "🧽", description: "Disinfectant floor cleaner, citrus fragrance." },
  { id: "HHD-004", name: "Toilet Cleaner", brand: "Harpic", category: "Household", quantity: "500 ml", price: 99, discount: 0, stock: 100, unit: "ml", imageEmoji: "🧴", description: "Powerful germ-kill toilet cleaner." },
  { id: "HHD-005", name: "Garbage Bags", brand: "Bagit", category: "Household", quantity: "30 pcs", price: 129, discount: 8, stock: 160, unit: "pcs", imageEmoji: "🗑️", description: "Medium size biodegradable garbage bags." },
];

export function getAllProducts(): Product[] {
  return products;
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id.toLowerCase() === id.toLowerCase());
}
