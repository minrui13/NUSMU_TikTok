export type DashboardAgentStatus = "ready" | "busy" | "stopped" | "error";

export interface AgentStatusOverviewEntry {
  status: DashboardAgentStatus;
  count: number;
}

export interface RunVolumeBucket {
  date: string;
  count: number;
}

export interface RunOutcomeBreakdownEntry {
  status: "completed" | "failed" | "cancelled";
  count: number;
  percentage: number;
}

export interface TokenUsageByAgent {
  agentId: string;
  agentName: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface TokenUsageTotals {
  systemWide: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  };
  byAgent: TokenUsageByAgent[];
}

export interface ErrorBreakdownEntry {
  message: string;
  count: number;
}

export interface MostActiveAgentEntry {
  agentId: string;
  agentName: string;
  runCount: number;
}

export type DenialSource = "policy" | "immune";

export interface DenialEvent {
  id: string;
  agentId: string;
  action: string;
  timestamp: string;
  reason: string;
  source: DenialSource;
}

export interface DenialRateBucket {
  date: string;
  count: number;
}

export interface DashboardSnapshot {
  agentStatusOverview: AgentStatusOverviewEntry[];
  runVolume: RunVolumeBucket[];
  runOutcomeBreakdown: RunOutcomeBreakdownEntry[];
  tokenUsage: TokenUsageTotals;
  errorBreakdown: ErrorBreakdownEntry[];
  mostActiveAgents: MostActiveAgentEntry[];
  denialRate: DenialRateBucket[];
  denialFeed: DenialEvent[];
}
