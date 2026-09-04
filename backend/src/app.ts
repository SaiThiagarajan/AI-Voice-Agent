import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        env.nodeEnv === "development"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: env.corsOrigin.split(",").map((o) => o.trim()),
  });

  await registerRoutes(app);

  return app;
}
