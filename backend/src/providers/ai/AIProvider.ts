/**
 * Provider-agnostic AI abstraction. All AI vendor specifics (OpenAI, or any
 * future provider) are isolated behind this interface so the rest of the
 * app (aiService, tool loop, routes) never depends on a specific SDK.
 */

import { ConversationContext } from "../../types/conversation.js";

export type AIRole = "system" | "user" | "assistant" | "tool";

export interface AIToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AIMessage {
  role: AIRole;
  content: string;
  /** Set on assistant messages that requested tool calls. */
  toolCalls?: AIToolCallRequest[];
  /** Set on tool-result messages, must match the originating toolCall id. */
  toolCallId?: string;
  /** Set on tool-result messages: which tool produced this result. */
  name?: string;
}

export interface AIToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AIChatRequest {
  messages: AIMessage[];
  tools: AIToolSpec[];
}

/**
 * A provider's requested change to the session's cross-turn conversational
 * memory. Each field is tri-state: omitted = leave unchanged, `null` =
 * clear, a value = set. Only MockAIProvider ever populates this (it has no
 * other way to remember "what were we just discussing" between turns);
 * OpenAIProvider leaves it undefined because a real LLM already has the
 * full conversation history to reason from. See types/conversation.ts.
 */
export interface ConversationContextUpdate {
  pendingClarification?: ConversationContext["pendingClarification"] | null;
  pendingConfirmation?: ConversationContext["pendingConfirmation"] | null;
  lastDiscussedProductId?: string | null;
  lastDiscussedProductName?: string | null;
}

export interface AIChatResponse {
  message: AIMessage;
  finishReason: "stop" | "tool_calls";
  /** Optional cross-turn memory update; see ConversationContextUpdate. */
  contextUpdate?: ConversationContextUpdate;
}

export interface AIProvider {
  readonly name: string;
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  /** Speech-to-text. Optional: not all providers/modes support it. */
  transcribeAudio?(audio: Buffer, mimeType: string, languageHint?: string): Promise<string>;
  /** Text-to-speech. Returns audio bytes (mp3). Optional. */
  synthesizeSpeech?(text: string, languageCode: string): Promise<Buffer>;
}
