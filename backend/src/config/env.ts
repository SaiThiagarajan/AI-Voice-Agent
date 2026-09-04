import "dotenv/config";

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(optional("PORT", "4000")),
  host: optional("HOST", "0.0.0.0"),
  nodeEnv: optional("NODE_ENV", "development"),
  corsOrigin: optional("CORS_ORIGIN", "http://localhost:5173"),

  openai: {
    apiKey: optional("OPENAI_API_KEY"),
    model: optional("OPENAI_MODEL", "gpt-4o-mini"),
    ttsModel: optional("OPENAI_TTS_MODEL", "tts-1"),
    ttsVoice: optional("OPENAI_TTS_VOICE", "alloy"),
    sttModel: optional("OPENAI_STT_MODEL", "whisper-1"),
  },

  telephony: {
    provider: optional("TELEPHONY_PROVIDER", "mock"),
    twilio: {
      accountSid: optional("TWILIO_ACCOUNT_SID"),
      authToken: optional("TWILIO_AUTH_TOKEN"),
      phoneNumber: optional("TWILIO_PHONE_NUMBER"),
    },
  },
};

export const isAiConfigured = Boolean(env.openai.apiKey);
