import { FastifyInstance } from "fastify";
import { productRoutes } from "./productRoutes.js";
import { cartRoutes } from "./cartRoutes.js";
import { orderRoutes } from "./orderRoutes.js";
import { agentRoutes } from "./agentRoutes.js";
import { dashboardRoutes } from "./dashboardRoutes.js";
import { callRoutes } from "./callRoutes.js";
import { telephonyRoutes } from "./telephonyRoutes.js";
import { aiProviderStatus } from "../providers/ai/index.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({ status: "ok", ai: aiProviderStatus() }));

  await app.register(productRoutes);
  await app.register(cartRoutes);
  await app.register(orderRoutes);
  await app.register(agentRoutes);
  await app.register(dashboardRoutes);
  await app.register(callRoutes);
  await app.register(telephonyRoutes);
}
