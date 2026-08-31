import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { RunOutcomeBreakdownEntry } from "./types";

interface Props {
  data: RunOutcomeBreakdownEntry[];
}

const COLORS: Record<RunOutcomeBreakdownEntry["status"], string> = {
  completed: "#33906d",
  failed: "#c55353",
  cancelled: "#777870",
};

export function SuccessFailureChart({ data }: Props) {
  const total = data.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div className="dashboard-card">
      <h3>{"Success vs failure rate"}</h3>
      <p className="dashboard-card-subtitle">
        {total} {"completed run(s) tracked"}
      </p>
      {total === 0 ? (
        <p className="dashboard-empty">{"No completed, failed, or cancelled runs yet."}</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={COLORS[entry.status]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
      {total > 0 && (
        <div className="dashboard-stat-row">
          {data.map((entry) => (
            <div className="dashboard-stat" key={entry.status}>
              <span className="dashboard-stat-value">{entry.percentage}%</span>
              <span className="dashboard-stat-label">
                {entry.status} {"("}
                {entry.count}
                {")"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
