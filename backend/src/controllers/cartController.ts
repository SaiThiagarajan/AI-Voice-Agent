import { FastifyReply, FastifyRequest } from "fastify";
import * as cartService from "../services/cartService.js";

function customerIdOf(req: FastifyRequest): string {
  return (req.headers["x-customer-id"] as string) || "guest";
}

export async function getCartHandler(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(cartService.getCart(customerIdOf(req)));
}

export async function addToCartHandler(
  req: FastifyRequest<{ Body: { productId: string; qty: number } }>,
  reply: FastifyReply
) {
  const result = cartService.addToCart(customerIdOf(req), req.body.productId, req.body.qty);
  if (!result.ok) return reply.status(400).send({ error: result.error, stock: "stock" in result ? result.stock : undefined });
  return reply.send(result.cart);
}

export async function removeFromCartHandler(
  req: FastifyRequest<{ Body: { productId: string; qty?: number } }>,
  reply: FastifyReply
) {
  const result = cartService.removeFromCart(customerIdOf(req), req.body.productId, req.body.qty);
  if (!result.ok) return reply.status(400).send({ error: result.error });
  return reply.send(result.cart);
}
