import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MostActiveAgentEntry } from "./types";

interface Props {
  data: MostActiveAgentEntry[];
}

export function MostActiveAgentsChart({ data }: Props) {
  return (
    <div className="dashboard-card">
      <h3>{"Most active agents"}</h3>
      <p className="dashboard-card-subtitle">{"Ranked by total run count"}</p>
      {data.length === 0 ? (
        <p className="dashboard-empty">{"No runs recorded yet."}</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#deddd6" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="agentName"
              width={120}
              tick={{ fontSize: 11 }}
            />
            <Tooltip />
            <Bar dataKey="runCount" name="Runs" fill="#513db9" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
