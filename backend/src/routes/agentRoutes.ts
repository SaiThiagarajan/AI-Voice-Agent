import { FastifyInstance } from "fastify";
import { chatHandler, endSessionHandler, getSessionHandler, speakHandler } from "../controllers/agentController.js";

export async function agentRoutes(app: FastifyInstance) {
  app.post("/api/agent/chat", chatHandler);
  app.get("/api/agent/session/:id", getSessionHandler);
  app.post("/api/agent/session/:id/end", endSessionHandler);
  app.post("/api/agent/speak", speakHandler);
}
