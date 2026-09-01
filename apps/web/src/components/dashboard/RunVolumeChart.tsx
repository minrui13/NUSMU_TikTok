import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RunVolumeBucket } from "./types";

interface Props {
  data: RunVolumeBucket[];
}

export function RunVolumeChart({ data }: Props) {
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="dashboard-card">
      <h3>{"Run volume"}</h3>
      <p className="dashboard-card-subtitle">
        {total} {"run(s) over the last "}
        {data.length} {"bucket(s)"}
      </p>
      {total === 0 ? (
        <p className="dashboard-empty">{"No runs in this time range yet."}</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#deddd6" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" name="Runs" fill="#6954d9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
