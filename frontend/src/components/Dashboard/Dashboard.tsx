import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { DashboardSnapshot, SUPPORTED_LANGUAGES } from "../../types";
import { StatCard } from "./StatCard";
import { PhoneCallSimulator } from "./PhoneCallSimulator";

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function languageLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      api.getDashboard().then((snapshot) => {
        if (mounted) {
          setData(snapshot);
          setLoading(false);
        }
      }).catch(() => mounted && setLoading(false));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading || !data) {
    return <div className="py-20 text-center text-gray-500">Loading dashboard…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">AI Agent Dashboard</h1>
          <p className="text-sm text-gray-500">Live view of the GroceryNxt voice assistant.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-soft">
          <span className={`h-2.5 w-2.5 rounded-full ${data.agentStatus === "online" ? "bg-emerald-500" : "bg-red-500"}`} />
          Agent {data.agentStatus}
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{data.aiProvider.provider === "openai" ? `OpenAI (${data.aiProvider.model})` : "Mock fallback"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Calls" value={data.totalCalls} icon="📞" />
        <StatCard label="Active Calls" value={data.activeCalls} icon="🟢" />
        <StatCard label="Avg Duration" value={formatDuration(data.averageCallDurationSeconds)} icon="⏱️" />
        <StatCard label="Orders Generated" value={data.ordersGenerated} icon="📦" accent />
        <StatCard label="Revenue" value={`₹${data.totalRevenue}`} icon="💰" accent />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-4 font-bold text-gray-900">Languages Used</h2>
          <div className="space-y-3">
            {Object.entries(data.languageBreakdown).length === 0 && <p className="text-sm text-gray-400">No conversations yet.</p>}
            {Object.entries(data.languageBreakdown).map(([code, count]) => {
              const pct = Math.round((count / data.totalCalls) * 100);
              return (
                <div key={code}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{languageLabel(code)}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-brand-50">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold text-gray-900">Recent Conversations</h2>
          {data.recentConversations.length === 0 ? (
            <p className="text-sm text-gray-400">No conversations yet. Try the voice assistant on the storefront.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-4">Session</th>
                    <th className="pb-2 pr-4">Channel</th>
                    <th className="pb-2 pr-4">Language</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Messages</th>
                    <th className="pb-2">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentConversations.map((c) => (
                    <tr key={c.sessionId} className="border-t border-brand-50">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-500">{c.sessionId.slice(0, 8)}</td>
                      <td className="py-2 pr-4 capitalize">{c.channel}</td>
                      <td className="py-2 pr-4">{languageLabel(c.language)}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{c.messageCount}</td>
                      <td className="py-2">{c.ordersCreated.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <PhoneCallSimulator />
      </div>
    </div>
  );
}
