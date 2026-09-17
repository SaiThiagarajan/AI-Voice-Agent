import { store } from "../data/store.js";
import { listOrders } from "./orderService.js";
import { aiProviderStatus } from "../providers/ai/index.js";

export interface DashboardSnapshot {
  agentStatus: "online" | "offline";
  aiProvider: ReturnType<typeof aiProviderStatus>;
  totalCalls: number;
  activeCalls: number;
  averageCallDurationSeconds: number;
  languageBreakdown: Record<string, number>;
  recentConversations: Array<{
    sessionId: string;
    channel: string;
    language: string;
    status: string;
    messageCount: number;
    updatedAt: string;
    ordersCreated: string[];
  }>;
  ordersGenerated: number;
  totalRevenue: number;
}

export function getDashboardSnapshot(): DashboardSnapshot {
  const sessions = Array.from(store.sessions.values());
  const orders = listOrders();

  const languageBreakdown: Record<string, number> = {};
  for (const s of sessions) {
    languageBreakdown[s.language] = (languageBreakdown[s.language] ?? 0) + 1;
  }

  const completedDurations = sessions
    .filter((s) => s.status === "ended" && s.callDurationSeconds)
    .map((s) => s.callDurationSeconds as number);
  const averageCallDurationSeconds =
    completedDurations.length > 0
      ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
      : 0;

  const recentConversations = sessions
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10)
    .map((s) => ({
      sessionId: s.sessionId,
      channel: s.channel,
      language: s.language,
      status: s.status,
      messageCount: s.messages.length,
      updatedAt: s.updatedAt,
      ordersCreated: s.ordersCreated,
    }));

  return {
    agentStatus: "online",
    aiProvider: aiProviderStatus(),
    totalCalls: sessions.length,
    activeCalls: sessions.filter((s) => s.status === "active").length,
    averageCallDurationSeconds,
    languageBreakdown,
    recentConversations,
    ordersGenerated: orders.length,
    totalRevenue: Math.round(orders.reduce((sum, o) => sum + o.total, 0) * 100) / 100,
  };
}
