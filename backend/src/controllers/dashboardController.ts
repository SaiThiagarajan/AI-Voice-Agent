import { FastifyReply, FastifyRequest } from "fastify";
import { getDashboardSnapshot } from "../services/dashboardService.js";

export async function getDashboardHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(getDashboardSnapshot());
}
