import { useEffect, useState } from "react";

import { api } from "../api";
import { AgentStatusOverview } from "../components/dashboard/AgentStatusOverview";
import { DenialFeed } from "../components/dashboard/DenialFeed";
import { DenialRateChart } from "../components/dashboard/DenialRateChart";
import { ErrorBreakdownTable } from "../components/dashboard/ErrorBreakdownTable";
import { MostActiveAgentsChart } from "../components/dashboard/MostActiveAgentsChart";
import { RunVolumeChart } from "../components/dashboard/RunVolumeChart";
import { SuccessFailureChart } from "../components/dashboard/SuccessFailureChart";
import { TokenUsageStats } from "../components/dashboard/TokenUsageStats";
import "../components/dashboard/dashboard.css";

import type { DashboardSnapshot } from "../components/dashboard/types";

export default function Dashboard() {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void api
      .dashboard()
      .then((snapshot) => {
        if (!cancelled) setData(snapshot);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="dashboard-view">
      <h2>{"Dashboard"}</h2>
      <p className="dashboard-subtitle">
        {"An operator-level view of agent activity, run outcomes, and safety"}
        {" signals - computed from existing platform data."}
      </p>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {!data && !error && (
        <p className="dashboard-state">{"Loading dashboard…"}</p>
      )}

      {data && (
        <div className="dashboard-grid">
          <AgentStatusOverview data={data.agentStatusOverview} />
          <SuccessFailureChart data={data.runOutcomeBreakdown} />
          <RunVolumeChart data={data.runVolume} />
          <MostActiveAgentsChart data={data.mostActiveAgents} />
          <TokenUsageStats data={data.tokenUsage} />
          <DenialRateChart data={data.denialRate} />
          <div className="dashboard-grid-full">
            <ErrorBreakdownTable data={data.errorBreakdown} />
          </div>
          <div className="dashboard-grid-full">
            <DenialFeed data={data.denialFeed} />
          </div>
        </div>
      )}
    </div>
  );
}
