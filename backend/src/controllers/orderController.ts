import { FastifyReply, FastifyRequest } from "fastify";
import * as orderService from "../services/orderService.js";

function customerIdOf(req: FastifyRequest): string {
  return (req.headers["x-customer-id"] as string) || "guest";
}

export async function createOrderHandler(
  req: FastifyRequest<{ Body: { deliveryAddress?: string } }>,
  reply: FastifyReply
) {
  const result = orderService.createOrder(customerIdOf(req), req.body?.deliveryAddress ?? "");
  if (!result.ok) return reply.status(400).send({ error: result.error });
  return reply.send(result.order);
}

export async function getOrderStatusHandler(req: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) {
  const result = orderService.getOrderStatus(req.params.orderId);
  if (!result.ok) return reply.status(404).send({ error: result.error });
  return reply.send(result.order);
}

export async function cancelOrderHandler(req: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) {
  const result = orderService.cancelOrder(req.params.orderId);
  if (!result.ok) return reply.status(400).send({ error: result.error, status: "status" in result ? result.status : undefined });
  return reply.send(result.order);
}

export async function listOrdersHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ orders: orderService.listOrders() });
}
