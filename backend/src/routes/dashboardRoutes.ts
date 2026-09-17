import { FastifyInstance } from "fastify";
import { getDashboardHandler } from "../controllers/dashboardController.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", getDashboardHandler);
}
