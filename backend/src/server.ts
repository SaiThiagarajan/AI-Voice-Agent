import { buildApp } from "./app.js";
import { env, isAiConfigured } from "./config/env.js";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info(`AI Voice Platform backend listening on http://${env.host}:${env.port}`);
    app.log.info(
      isAiConfigured
        ? `AI provider: OpenAI (${env.openai.model})`
        : "AI provider: mock/rule-based fallback (set OPENAI_API_KEY for real AI responses)"
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
