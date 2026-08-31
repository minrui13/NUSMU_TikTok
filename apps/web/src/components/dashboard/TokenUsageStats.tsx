import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TokenUsageTotals } from "./types";

interface Props {
  data: TokenUsageTotals;
}

export function TokenUsageStats({ data }: Props) {
  const topAgents = data.byAgent.slice(0, 10);
  const hasAnyUsage =
    data.systemWide.inputTokens > 0 ||
    data.systemWide.outputTokens > 0 ||
    data.systemWide.cachedInputTokens > 0;

  return (
    <div className="dashboard-card">
      <h3>{"Token usage"}</h3>
      <p className="dashboard-card-subtitle">
        {"System-wide totals and per-agent breakdown"}
      </p>
      <div className="dashboard-stat-row">
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{data.systemWide.inputTokens}</span>
          <span className="dashboard-stat-label">{"Input tokens"}</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{data.systemWide.cachedInputTokens}</span>
          <span className="dashboard-stat-label">{"Cached input tokens"}</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{data.systemWide.outputTokens}</span>
          <span className="dashboard-stat-label">{"Output tokens"}</span>
        </div>
      </div>
      {!hasAnyUsage ? (
        <p className="dashboard-empty">
          {"No completed runs with recorded token usage yet."}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={topAgents} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#deddd6" />
            <XAxis dataKey="agentName" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="inputTokens" name="Input" stackId="tokens" fill="#6954d9" />
            <Bar dataKey="outputTokens" name="Output" stackId="tokens" fill="#a698ea" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
