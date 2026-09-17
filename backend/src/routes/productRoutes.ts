import { FastifyInstance } from "fastify";
import {
  checkInventoryHandler,
  getProductHandler,
  listCategoriesHandler,
  searchProductsHandler,
} from "../controllers/productController.js";

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/products", searchProductsHandler);
  app.get("/api/products/categories", listCategoriesHandler);
  app.get("/api/products/:id", getProductHandler);
  app.get("/api/products/:id/inventory", checkInventoryHandler);
}
