import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DenialRateBucket } from "./types";

interface Props {
  data: DenialRateBucket[];
}

export function DenialRateChart({ data }: Props) {
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="dashboard-card">
      <h3>{"Denial rate"}</h3>
      <p className="dashboard-card-subtitle">
        {"Blocked actions per day - combines ability-policy denials and Agent"}
        {" Immune auto-blocks"}
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#deddd6" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            name="Denials"
            stroke="#c55353"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {total === 0 && (
        <p className="dashboard-empty">{"No denials in this time range."}</p>
      )}
    </div>
  );
}
