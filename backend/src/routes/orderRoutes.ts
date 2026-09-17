import { FastifyInstance } from "fastify";
import {
  cancelOrderHandler,
  createOrderHandler,
  getOrderStatusHandler,
  listOrdersHandler,
} from "../controllers/orderController.js";

export async function orderRoutes(app: FastifyInstance) {
  app.get("/api/orders", listOrdersHandler);
  app.post("/api/orders", createOrderHandler);
  app.get("/api/orders/:orderId", getOrderStatusHandler);
  app.post("/api/orders/:orderId/cancel", cancelOrderHandler);
}
