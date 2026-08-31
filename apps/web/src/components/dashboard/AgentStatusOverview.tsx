import type { AgentStatusOverviewEntry } from "./types";

interface Props {
  data: AgentStatusOverviewEntry[];
}

export function AgentStatusOverview({ data }: Props) {
  return (
    <div className="dashboard-card">
      <h3>{"Agent status overview"}</h3>
      <p className="dashboard-card-subtitle">
        {"Agents grouped by current status"}
      </p>
      <div className="dashboard-status-grid">
        {data.map((entry) => (
          <div className="dashboard-status-tile" key={entry.status}>
            <span className="dashboard-status-count">{entry.count}</span>
            <span className="dashboard-status-label">
              <span className={"dashboard-status-dot " + entry.status} />
              {entry.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
