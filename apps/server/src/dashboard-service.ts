import { getKnownSecrets, redactSecrets } from "./utils/redaction.js";

import type { AuditEvent } from "./types/audits.js";
import type {
  Agent,
  AgentStatus,
  AgentRun,
  Database,
  ImmuneThreatEvent,
  RunStatus,
} from "./types.js";

// Minimal shape this service needs from JsonStore. Kept as an interface
// (rather than importing the concrete JsonStore class) so tests can pass a
// plain stub instead of a real on-disk store.
export interface DashboardStore {
  snapshot(): Database;
}

export type DashboardGranularity = "day" | "hour";

export interface AgentStatusOverviewEntry {
  status: AgentStatus;
  count: number;
}

export interface RunVolumeBucket {
  date: string;
  count: number;
}

const TRACKED_OUTCOME_STATUSES: RunStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export interface RunOutcomeBreakdownEntry {
  status: (typeof TRACKED_OUTCOME_STATUSES)[number];
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

// No literal "blacklist" feature exists in this codebase (confirmed by
// investigation). The closest equivalent signals are:
//   1. AuditEvent (types/audits.ts) records from the ability-based policy
//      checker (abilities/policy-checker.ts), decision === "denied".
//   2. ImmuneThreatEvent records from the Agent Immune engine
//      (agent-immune.ts), decision === "deny" (auto-blocked runs).
// Both are combined here into one normalized "denial event" feed/rate.
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

export interface DashboardOptions {
  runVolumeDays?: number;
  runVolumeGranularity?: DashboardGranularity;
  denialRateDays?: number;
  denialRateGranularity?: DashboardGranularity;
  errorBreakdownLimit?: number;
  mostActiveAgentsLimit?: number;
  denialFeedLimit?: number;
  now?: Date;
}

const agentName = (agents: Agent[], agentId: string): string =>
  agents.find((agent) => agent.id === agentId)?.name ?? "Unknown agent";

export class DashboardService {
  constructor(private readonly store: DashboardStore) {}

  // 1. Agent status overview
  getAgentStatusOverview(): AgentStatusOverviewEntry[] {
    const { agents } = this.store.snapshot();
    const statuses: AgentStatus[] = ["ready", "busy", "stopped", "error"];
    const counts = new Map<AgentStatus, number>(
      statuses.map((status) => [status, 0]),
    );
    for (const agent of agents) {
      counts.set(agent.status, (counts.get(agent.status) ?? 0) + 1);
    }
    return statuses.map((status) => ({ status, count: counts.get(status) ?? 0 }));
  }

  // 2. Run volume over time
  getRunVolume(
    days = 7,
    granularity: DashboardGranularity = "day",
    now: Date = new Date(),
  ): RunVolumeBucket[] {
    const { runs } = this.store.snapshot();
    return this.bucketByTime(
      runs.map((run) => run.createdAt),
      days,
      granularity,
      now,
    );
  }

  // 3. Success vs failure rate
  getRunOutcomeBreakdown(): RunOutcomeBreakdownEntry[] {
    const { runs } = this.store.snapshot();
    const counts = new Map<RunStatus, number>(
      TRACKED_OUTCOME_STATUSES.map((status) => [status, 0]),
    );
    for (const run of runs) {
      if (counts.has(run.status)) {
        counts.set(run.status, (counts.get(run.status) ?? 0) + 1);
      }
    }
    const total = TRACKED_OUTCOME_STATUSES.reduce(
      (sum, status) => sum + (counts.get(status) ?? 0),
      0,
    );
    return TRACKED_OUTCOME_STATUSES.map((status) => {
      const count = counts.get(status) ?? 0;
      return {
        status,
        count,
        // Percentage is of the three tracked terminal outcomes, not of all
        // runs (queued/running/pending_approval/denied aren't outcomes yet).
        percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
      };
    });
  }

  // 4. Token usage totals
  getTokenUsageTotals(): TokenUsageTotals {
    const { agents, runs } = this.store.snapshot();
    const systemWide = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
    const byAgentMap = new Map<
      string,
      { inputTokens: number; cachedInputTokens: number; outputTokens: number }
    >();

    for (const run of runs) {
      // usage is null until a run completes (see codex-runner.ts's
      // turn.completed handling and container-codex-runner.ts) - queued or
      // still-running runs simply contribute zero here, they aren't
      // fabricated.
      if (!run.usage) continue;

      const inputTokens = run.usage.inputTokens ?? 0;
      const cachedInputTokens = run.usage.cachedInputTokens ?? 0;
      const outputTokens = run.usage.outputTokens ?? 0;

      systemWide.inputTokens += inputTokens;
      systemWide.cachedInputTokens += cachedInputTokens;
      systemWide.outputTokens += outputTokens;

      const existing = byAgentMap.get(run.agentId) ?? {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
      };
      existing.inputTokens += inputTokens;
      existing.cachedInputTokens += cachedInputTokens;
      existing.outputTokens += outputTokens;
      byAgentMap.set(run.agentId, existing);
    }

    const byAgent = [...byAgentMap.entries()]
      .map(([agentId, totals]) => ({
        agentId,
        agentName: agentName(agents, agentId),
        ...totals,
      }))
      .sort(
        (a, b) =>
          b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
      );

    return { systemWide, byAgent };
  }

  // 5. Error breakdown
  getErrorBreakdown(limit = 10): ErrorBreakdownEntry[] {
    const { agents, runs } = this.store.snapshot();
    const secrets = getKnownSecrets();
    const counts = new Map<string, number>();

    const record = (raw: string | null) => {
      if (!raw) return;
      const redacted = redactSecrets(raw, secrets).trim();
      if (!redacted) return;
      counts.set(redacted, (counts.get(redacted) ?? 0) + 1);
    };

    for (const agent of agents) record(agent.lastError);
    for (const run of runs) record(run.error);

    return [...counts.entries()]
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // 6. Most active agents
  getMostActiveAgents(limit = 10): MostActiveAgentEntry[] {
    const { agents, runs } = this.store.snapshot();
    const counts = new Map<string, number>();
    for (const run of runs) {
      counts.set(run.agentId, (counts.get(run.agentId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([agentId, runCount]) => ({
        agentId,
        agentName: agentName(agents, agentId),
        runCount,
      }))
      .sort((a, b) => b.runCount - a.runCount)
      .slice(0, limit);
  }

  private getDenialEvents(): DenialEvent[] {
    const { auditEvents, immuneThreatEvents } = this.store.snapshot();
    const secrets = getKnownSecrets();

    const policyDenials: DenialEvent[] = (auditEvents as AuditEvent[])
      .filter((event) => event.decision === "denied")
      .map((event) => ({
        id: event.id,
        agentId: event.agentId,
        action: redactSecrets(event.action, secrets),
        timestamp: event.createdAt,
        reason: redactSecrets(event.reason ?? "No reason recorded", secrets),
        source: "policy" as const,
      }));

    const immuneDenials: DenialEvent[] = (
      immuneThreatEvents as ImmuneThreatEvent[]
    )
      .filter((event) => event.decision === "deny")
      .map((event) => ({
        id: event.id,
        agentId: event.agentId,
        action: redactSecrets(
          `Immune block: ${event.categories.join(", ") || "uncategorized"}`,
          secrets,
        ),
        timestamp: event.createdAt,
        reason: redactSecrets(
          event.reasons.join("; ") || "No reason recorded",
          secrets,
        ),
        source: "immune" as const,
      }));

    return [...policyDenials, ...immuneDenials].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    );
  }

  // 7. Denial rate over time
  getDenialRate(
    days = 7,
    granularity: DashboardGranularity = "day",
    now: Date = new Date(),
  ): DenialRateBucket[] {
    return this.bucketByTime(
      this.getDenialEvents().map((event) => event.timestamp),
      days,
      granularity,
      now,
    );
  }

  // 8. Blacklist denial feed
  getDenialFeed(limit = 20): DenialEvent[] {
    return this.getDenialEvents().slice(0, limit);
  }

  getDashboard(options: DashboardOptions = {}): DashboardSnapshot {
    const now = options.now ?? new Date();
    return {
      agentStatusOverview: this.getAgentStatusOverview(),
      runVolume: this.getRunVolume(
        options.runVolumeDays ?? 7,
        options.runVolumeGranularity ?? "day",
        now,
      ),
      runOutcomeBreakdown: this.getRunOutcomeBreakdown(),
      tokenUsage: this.getTokenUsageTotals(),
      errorBreakdown: this.getErrorBreakdown(options.errorBreakdownLimit ?? 10),
      mostActiveAgents: this.getMostActiveAgents(
        options.mostActiveAgentsLimit ?? 10,
      ),
      denialRate: this.getDenialRate(
        options.denialRateDays ?? 7,
        options.denialRateGranularity ?? "day",
        now,
      ),
      denialFeed: this.getDenialFeed(options.denialFeedLimit ?? 20),
    };
  }

  private bucketByTime(
    timestamps: string[],
    days: number,
    granularity: DashboardGranularity,
    now: Date,
  ): { date: string; count: number }[] {
    const stepMs = granularity === "hour" ? 3_600_000 : 86_400_000;
    const steps = granularity === "hour" ? days * 24 : days;
    const keyFor = (iso: string) =>
      granularity === "hour" ? iso.slice(0, 13) : iso.slice(0, 10);

    const orderedKeys: string[] = [];
    for (let i = steps - 1; i >= 0; i--) {
      orderedKeys.push(keyFor(new Date(now.getTime() - i * stepMs).toISOString()));
    }

    const counts = new Map<string, number>(orderedKeys.map((key) => [key, 0]));
    const earliestBoundary = now.getTime() - steps * stepMs;

    for (const timestamp of timestamps) {
      const time = new Date(timestamp).getTime();
      if (Number.isNaN(time) || time < earliestBoundary || time > now.getTime()) {
        continue;
      }
      const key = keyFor(new Date(timestamp).toISOString());
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return orderedKeys.map((date) => ({ date, count: counts.get(date) ?? 0 }));
  }
}
