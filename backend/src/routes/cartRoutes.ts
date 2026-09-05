import { FastifyInstance } from "fastify";
import { addToCartHandler, getCartHandler, removeFromCartHandler } from "../controllers/cartController.js";

export async function cartRoutes(app: FastifyInstance) {
  app.get("/api/cart", getCartHandler);
  app.post("/api/cart/items", addToCartHandler);
  app.delete("/api/cart/items", removeFromCartHandler);
}
