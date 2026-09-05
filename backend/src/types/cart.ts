export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  quantityLabel: string;
  unitPrice: number; // effective price per unit at time of add
  qty: number;
  lineTotal: number;
}

export interface Cart {
  cartId: string;
  customerId: string;
  items: CartItem[];
  subtotal: number;
  updatedAt: string;
}
