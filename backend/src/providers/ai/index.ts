import { env, isAiConfigured } from "../../config/env.js";
import { AIProvider } from "./AIProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";
import { MockAIProvider } from "./MockAIProvider.js";

let provider: AIProvider;

export function getAIProvider(): AIProvider {
  if (!provider) {
    provider = isAiConfigured ? new OpenAIProvider(env.openai.apiKey) : new MockAIProvider();
  }
  return provider;
}

export function aiProviderStatus() {
  return {
    provider: isAiConfigured ? "openai" : "mock",
    configured: isAiConfigured,
    model: isAiConfigured ? env.openai.model : "rule-based-fallback",
  };
}
