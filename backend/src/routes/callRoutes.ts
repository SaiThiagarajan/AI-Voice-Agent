import { FastifyInstance } from "fastify";
import { callMessageHandler, endCallHandler, getCallHandler, simulateCallHandler } from "../controllers/callController.js";

export async function callRoutes(app: FastifyInstance) {
  app.post("/api/calls/simulate", simulateCallHandler);
  app.post("/api/calls/:callId/message", callMessageHandler);
  app.get("/api/calls/:callId", getCallHandler);
  app.post("/api/calls/:callId/end", endCallHandler);
}
