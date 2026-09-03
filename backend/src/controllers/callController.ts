import { FastifyReply, FastifyRequest } from "fastify";
import * as callService from "../services/callService.js";
import { sanitizeError } from "../services/aiService.js";
import { isSupportedLanguage } from "../types/language.js";

/**
 * Phone-call simulation endpoints backing the Dashboard's "Phone Call
 * Simulator" (no real phone network involved — see
 * providers/telephony/MockTelephonyProvider.ts). Every call here is
 * ultimately answered by the exact same aiService/tool-calling pipeline the
 * browser voice agent uses (see services/callService.ts).
 */

interface SimulateCallBody {
  language?: string;
  customerId: string;
  fromNumber?: string;
}

export async function simulateCallHandler(req: FastifyRequest<{ Body: SimulateCallBody }>, reply: FastifyReply) {
  const { customerId, fromNumber } = req.body ?? ({} as SimulateCallBody);
  if (!customerId || !customerId.trim()) {
    return reply.status(400).send({ success: false, error: "customerId is required" });
  }
  const language = req.body?.language && isSupportedLanguage(req.body.language) ? req.body.language : "en";

  try {
    const result = await callService.createCall(customerId, language, fromNumber);
    return reply.send({ success: true, call: result.ok ? result.call : undefined });
  } catch (err) {
    req.log.error({ err: sanitizeError(err) }, "call simulation failed");
    return reply.status(502).send({ success: false, error: "The telephony provider is temporarily unavailable. Please try again." });
  }
}

interface CallMessageBody {
  message: string;
}

export async function callMessageHandler(
  req: FastifyRequest<{ Params: { callId: string }; Body: CallMessageBody }>,
  reply: FastifyReply
) {
  const { message } = req.body ?? ({} as CallMessageBody);
  if (!message || !message.trim()) {
    return reply.status(400).send({ success: false, error: "message is required" });
  }

  try {
    const result = await callService.sendCallMessage(req.params.callId, message);
    if (!result.ok) {
      const statusCode = result.error === "CALL_NOT_FOUND" ? 404 : 409;
      return reply.status(statusCode).send({ success: false, error: result.error });
    }
    return reply.send({
      success: true,
      response: result.response,
      toolCalls: result.toolCalls,
      ordersCreated: result.ordersCreated,
      status: result.call.status,
    });
  } catch (err) {
    req.log.error({ err: sanitizeError(err) }, "call message failed");
    return reply.status(502).send({ success: false, error: "The AI assistant is temporarily unavailable. Please try again." });
  }
}

export async function getCallHandler(req: FastifyRequest<{ Params: { callId: string } }>, reply: FastifyReply) {
  const result = callService.getCall(req.params.callId);
  if (!result.ok) return reply.status(404).send({ success: false, error: result.error });
  return reply.send({ success: true, ...result.session });
}

export async function endCallHandler(req: FastifyRequest<{ Params: { callId: string } }>, reply: FastifyReply) {
  try {
    const result = await callService.endCall(req.params.callId);
    if (!result.ok) return reply.status(404).send({ success: false, error: result.error });
    return reply.send({ success: true, call: result.call });
  } catch (err) {
    req.log.error({ err: sanitizeError(err) }, "end call failed");
    return reply.status(502).send({ success: false, error: "The telephony provider is temporarily unavailable. Please try again." });
  }
}
