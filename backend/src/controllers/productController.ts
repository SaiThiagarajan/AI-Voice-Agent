import { FastifyReply, FastifyRequest } from "fastify";
import * as productService from "../services/productService.js";
import { ProductCategory } from "../types/product.js";

export async function searchProductsHandler(
  req: FastifyRequest<{ Querystring: { q?: string; category?: string; inStockOnly?: string; limit?: string } }>,
  reply: FastifyReply
) {
  const { q, category, inStockOnly, limit } = req.query;
  const results = productService.searchProducts({
    query: q,
    category: category as ProductCategory | undefined,
    inStockOnly: inStockOnly === "true",
    limit: limit ? Number(limit) : undefined,
  });
  return reply.send({ count: results.length, results });
}

export async function getProductHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const result = productService.getProduct(req.params.id);
  if (!result) return reply.status(404).send({ error: "Product not found" });
  return reply.send(result);
}

export async function checkInventoryHandler(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { qty?: string } }>,
  reply: FastifyReply
) {
  const qty = Number(req.query.qty ?? "1");
  return reply.send(productService.checkInventory(req.params.id, qty));
}

export async function listCategoriesHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ categories: productService.listCategories() });
}
