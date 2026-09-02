import OpenAI from "openai";
import { env } from "../../config/env.js";
import { AIChatRequest, AIChatResponse, AIMessage, AIProvider, AIToolCallRequest } from "./AIProvider.js";

function toOpenAIMessages(messages: AIMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId ?? "",
      } satisfies OpenAI.Chat.Completions.ChatCompletionToolMessageParam;
    }
    if (m.role === "assistant") {
      const base: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
        role: "assistant",
        content: m.content || null,
      };
      if (m.toolCalls && m.toolCalls.length > 0) {
        base.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }));
      }
      return base;
    }
    return { role: m.role, content: m.content } as OpenAI.Chat.Completions.ChatCompletionMessageParam;
  });
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat({ messages, tools }: AIChatRequest): Promise<AIChatResponse> {
    const completion = await this.client.chat.completions.create({
      model: env.openai.model,
      messages: toOpenAIMessages(messages),
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      temperature: 0.4,
      // Force one tool call per turn. Without this, the model may request
      // e.g. check_inventory and add_to_cart in the SAME response — decided
      // before it has actually seen check_inventory's result — which would
      // let it "skip" real inventory validation in spirit even though
      // cartService still enforces the stock invariant server-side. Forcing
      // sequential calls keeps the model's own reasoning honest, and matches
      // MockAIProvider's behavior (which also only ever returns one tool
      // call per turn), so both providers drive aiService's loop identically.
      parallel_tool_calls: tools.length > 0 ? false : undefined,
    });

    const choice = completion.choices[0];
    if (!choice) {
      throw new Error("OpenAI returned no completion choices");
    }
    const msg = choice.message;

    const toolCalls: AIToolCallRequest[] | undefined = msg.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParseJson(tc.function.arguments),
    }));

    return {
      message: {
        role: "assistant",
        content: msg.content ?? "",
        toolCalls,
      },
      finishReason: toolCalls && toolCalls.length > 0 ? "tool_calls" : "stop",
    };
  }

  async transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("wav") ? "wav" : "mp3";
    const file = await OpenAI.toFile(audio, `speech.${ext}`);
    const result = await this.client.audio.transcriptions.create({
      file,
      model: env.openai.sttModel,
    });
    return result.text;
  }

  async synthesizeSpeech(text: string, _languageCode: string): Promise<Buffer> {
    const response = await this.client.audio.speech.create({
      model: env.openai.ttsModel,
      voice: env.openai.ttsVoice as any,
      input: text,
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

function safeParseJson(raw: string): Record<string, any> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
