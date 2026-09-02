import { FastifyReply, FastifyRequest } from "fastify";
import * as aiService from "../services/aiService.js";
import { sanitizeError } from "../services/aiService.js";
import { getAIProvider } from "../providers/ai/index.js";
import { isSupportedLanguage } from "../types/language.js";

interface ChatBody {
  message: string;
  language?: string;
  customerId: string;
}

/**
 * The primary browser voice/text agent endpoint. `customerId` is the same
 * persistent guest id the frontend already uses for cart/order REST calls
 * (see frontend/src/services/api.ts) — using it as the conversation's
 * session key too means the AI's tool calls (add_to_cart, create_order,
 * etc.) operate on the exact same cart the storefront UI displays.
 */
export async function chatHandler(req: FastifyRequest<{ Body: ChatBody }>, reply: FastifyReply) {
  const { message, language, customerId } = req.body ?? {};

  if (!message || !message.trim()) {
    return reply.status(400).send({ success: false, error: "message is required" });
  }
  if (!customerId || !customerId.trim()) {
    return reply.status(400).send({ success: false, error: "customerId is required" });
  }

  const lang = language && isSupportedLanguage(language) ? language : "en";

  try {
    const result = await aiService.sendMessage(customerId, message, lang);
    return reply.send({
      success: true,
      response: result.reply,
      language: result.session.language,
      toolCalls: result.toolCalls,
      ordersCreated: result.session.ordersCreated,
      sessionId: result.session.sessionId,
    });
  } catch (err) {
    req.log.error({ err: sanitizeError(err) }, "agent chat failed");
    return reply.status(502).send({
      success: false,
      error: "The AI assistant is temporarily unavailable. Please try again.",
    });
  }
}

export async function getSessionHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const session = aiService.getOrCreateSession(req.params.id, req.params.id, "web", "en");
  return reply.send(session);
}

export async function endSessionHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  aiService.endSession(req.params.id);
  return reply.send({ ok: true });
}

interface SpeakBody {
  text: string;
  language?: string;
}

/**
 * Optional server-side TTS using the configured AI provider. The primary
 * browser demo uses the Web Speech API client-side and does not need this,
 * but it's here for providers/clients that want higher quality audio or
 * for future telephony integration where the caller has no browser.
 */
export async function speakHandler(req: FastifyRequest<{ Body: SpeakBody }>, reply: FastifyReply) {
  const provider = getAIProvider();
  if (!provider.synthesizeSpeech) {
    return reply.status(501).send({ error: "Text-to-speech not available for the active AI provider (set OPENAI_API_KEY)." });
  }
  const audio = await provider.synthesizeSpeech(req.body.text, req.body.language ?? "en");
  reply.header("Content-Type", "audio/mpeg");
  return reply.send(audio);
}
