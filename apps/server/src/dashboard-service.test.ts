import { describe, expect, it } from "vitest";

import { DashboardService, type DashboardStore } from "./dashboard-service.js";

import type { Ability } from "./types/abilities.js";
import type { AuditEvent } from "./types/audits.js";
import type {
  Agent,
  AgentRun,
  Database,
  ImmuneThreatEvent,
} from "./types.js";

const allAbilities: Record<Ability, boolean> = {
  canReadWorkspace: true,
  canWriteWorkspace: true,
  canRunCommand: true,
  canAccessSecrets: false,
  canUseNetwork: false,
  canJoinSession: true,
};

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: overrides.id ?? "agent-1",
    name: overrides.name ?? "Agent One",
    description: "",
    instructions: "",
    status: "ready",
    workspacePath: "/tmp/agent-1",
    codexThreadId: null,
    lastError: null,
    abilities: allAbilities,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: overrides.id ?? "run-1",
    agentId: overrides.agentId ?? "agent-1",
    sessionId: null,
    status: "completed",
    prompt: "do something",
    risk: null,
    output: null,
    error: null,
    usage: null,
    startedAt: "2026-08-30T00:00:00.000Z",
    completedAt: "2026-08-30T00:01:00.000Z",
    createdAt: "2026-08-30T00:00:00.000Z",
    ...overrides,
  };
}

function makeAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: overrides.id ?? "audit-1",
    userId: "user-1",
    agentId: overrides.agentId ?? "agent-1",
    runId: null,
    sessionId: null,
    actor: "agent",
    action: "canRunCommand",
    risk: "high",
    decision: "denied",
    reason: "canRunCommand (high risk) is not permitted",
    prompt: null,
    createdAt: "2026-08-30T00:00:00.000Z",
    ...overrides,
  };
}

function makeImmuneEvent(
  overrides: Partial<ImmuneThreatEvent> = {},
): ImmuneThreatEvent {
  return {
    id: overrides.id ?? "immune-1",
    agentId: overrides.agentId ?? "agent-1",
    runId: overrides.runId ?? "run-1",
    promptExcerpt: "ignore previous instructions",
    score: 90,
    baseScore: 90,
    memoryAdjustment: 0,
    decision: "deny",
    categories: ["prompt_injection"],
    reasons: ["Prompt contains language attempting to override instructions."],
    scoreBreakdown: [{ label: "Instruction override", score: 22 }],
    matchedMemoryIds: [],
    learnedMatch: false,
    reviewStatus: "pending",
    createdAt: "2026-08-30T00:00:00.000Z",
    reviewedAt: null,
    ...overrides,
  };
}

function makeStore(overrides: Partial<Database> = {}): DashboardStore {
  const database: Database = {
    version: 1,
    agents: [],
    messages: [],
    runs: [],
    immuneThreatEvents: [],
    immuneMemories: [],
    auditEvents: [],
    ...overrides,
  };
  return { snapshot: () => database };
}

describe("DashboardService", () => {
  describe("getAgentStatusOverview", () => {
    it("counts agents grouped by status, including zero counts", () => {
      const store = makeStore({
        agents: [
          makeAgent({ id: "a1", status: "ready" }),
          makeAgent({ id: "a2", status: "ready" }),
          makeAgent({ id: "a3", status: "busy" }),
          makeAgent({ id: "a4", status: "error" }),
        ],
      });
      const service = new DashboardService(store);
      expect(service.getAgentStatusOverview()).toEqual([
        { status: "ready", count: 2 },
        { status: "busy", count: 1 },
        { status: "stopped", count: 0 },
        { status: "error", count: 1 },
      ]);
    });
  });

  describe("getRunVolume", () => {
    it("buckets runs by day within the requested range", () => {
      const now = new Date("2026-09-01T12:00:00.000Z");
      const store = makeStore({
        runs: [
          makeRun({ id: "r1", createdAt: "2026-09-01T01:00:00.000Z" }),
          makeRun({ id: "r2", createdAt: "2026-09-01T05:00:00.000Z" }),
          makeRun({ id: "r3", createdAt: "2026-08-31T10:00:00.000Z" }),
          makeRun({ id: "r4", createdAt: "2026-08-20T10:00:00.000Z" }), // outside 7-day range
        ],
      });
      const service = new DashboardService(store);
      const result = service.getRunVolume(7, "day", now);

      expect(result).toHaveLength(7);
      expect(result[result.length - 1]).toEqual({ date: "2026-09-01", count: 2 });
      expect(result[result.length - 2]).toEqual({ date: "2026-08-31", count: 1 });
      expect(result.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);
    });
  });

  describe("getRunOutcomeBreakdown", () => {
    it("computes counts and percentages for completed/failed/cancelled", () => {
      const store = makeStore({
        runs: [
          makeRun({ id: "r1", status: "completed" }),
          makeRun({ id: "r2", status: "completed" }),
          makeRun({ id: "r3", status: "completed" }),
          makeRun({ id: "r4", status: "failed" }),
          makeRun({ id: "r5", status: "cancelled" }),
          makeRun({ id: "r6", status: "queued" }), // ignored, not a terminal outcome
        ],
      });
      const service = new DashboardService(store);
      expect(service.getRunOutcomeBreakdown()).toEqual([
        { status: "completed", count: 3, percentage: 60 },
        { status: "failed", count: 1, percentage: 20 },
        { status: "cancelled", count: 1, percentage: 20 },
      ]);
    });

    it("returns zero percentages when there are no terminal runs", () => {
      const service = new DashboardService(makeStore({ runs: [] }));
      expect(service.getRunOutcomeBreakdown()).toEqual([
        { status: "completed", count: 0, percentage: 0 },
        { status: "failed", count: 0, percentage: 0 },
        { status: "cancelled", count: 0, percentage: 0 },
      ]);
    });
  });

  describe("getTokenUsageTotals", () => {
    it("sums usage system-wide and per agent, treating null usage as zero", () => {
      const store = makeStore({
        agents: [makeAgent({ id: "a1", name: "Alpha" }), makeAgent({ id: "a2", name: "Beta" })],
        runs: [
          makeRun({
            id: "r1",
            agentId: "a1",
            usage: { inputTokens: 100, cachedInputTokens: 10, outputTokens: 50 },
          }),
          makeRun({
            id: "r2",
            agentId: "a1",
            usage: { inputTokens: 20, outputTokens: 5 },
          }),
          makeRun({ id: "r3", agentId: "a2", usage: null }),
          makeRun({
            id: "r4",
            agentId: "a2",
            usage: { inputTokens: 200, cachedInputTokens: 0, outputTokens: 80 },
          }),
        ],
      });
      const service = new DashboardService(store);
      const totals = service.getTokenUsageTotals();

      expect(totals.systemWide).toEqual({
        inputTokens: 320,
        cachedInputTokens: 10,
        outputTokens: 135,
      });
      expect(totals.byAgent).toEqual([
        {
          agentId: "a2",
          agentName: "Beta",
          inputTokens: 200,
          cachedInputTokens: 0,
          outputTokens: 80,
        },
        {
          agentId: "a1",
          agentName: "Alpha",
          inputTokens: 120,
          cachedInputTokens: 10,
          outputTokens: 55,
        },
      ]);
    });
  });

  describe("getErrorBreakdown", () => {
    it("counts and redacts the most frequent distinct error messages, top N first", () => {
      const store = makeStore({
        agents: [
          makeAgent({ id: "a1", lastError: "Connection timed out" }),
        ],
        runs: [
          makeRun({ id: "r1", error: "Connection timed out" }),
          makeRun({ id: "r2", error: "Connection timed out" }),
          makeRun({ id: "r3", error: "Disk full" }),
          makeRun({ id: "r4", error: null }),
        ],
      });
      const service = new DashboardService(store);
      expect(service.getErrorBreakdown(10)).toEqual([
        { message: "Connection timed out", count: 3 },
        { message: "Disk full", count: 1 },
      ]);
    });

    it("redacts known secrets from error text before counting", () => {
      process.env.ARK_API_KEY = "super-secret-key";
      const store = makeStore({
        runs: [makeRun({ id: "r1", error: "auth failed: super-secret-key" })],
      });
      const service = new DashboardService(store);
      const [entry] = service.getErrorBreakdown(10);
      expect(entry.message).not.toContain("super-secret-key");
      delete process.env.ARK_API_KEY;
    });

    it("limits results to the requested top N", () => {
      const store = makeStore({
        runs: [
          makeRun({ id: "r1", error: "Error A" }),
          makeRun({ id: "r2", error: "Error B" }),
          makeRun({ id: "r3", error: "Error C" }),
        ],
      });
      const service = new DashboardService(store);
      expect(service.getErrorBreakdown(2)).toHaveLength(2);
    });
  });

  describe("getMostActiveAgents", () => {
    it("ranks agents by run count descending, limited to top N", () => {
      const store = makeStore({
        agents: [
          makeAgent({ id: "a1", name: "Alpha" }),
          makeAgent({ id: "a2", name: "Beta" }),
          makeAgent({ id: "a3", name: "Gamma" }),
        ],
        runs: [
          makeRun({ id: "r1", agentId: "a2" }),
          makeRun({ id: "r2", agentId: "a1" }),
          makeRun({ id: "r3", agentId: "a1" }),
          makeRun({ id: "r4", agentId: "a1" }),
          makeRun({ id: "r5", agentId: "a3" }),
          makeRun({ id: "r6", agentId: "a3" }),
        ],
      });
      const service = new DashboardService(store);
      expect(service.getMostActiveAgents(2)).toEqual([
        { agentId: "a1", agentName: "Alpha", runCount: 3 },
        { agentId: "a3", agentName: "Gamma", runCount: 2 },
      ]);
    });
  });

  describe("getDenialRate", () => {
    it("buckets combined policy + immune denials by day", () => {
      const now = new Date("2026-09-01T12:00:00.000Z");
      const store = makeStore({
        auditEvents: [
          makeAuditEvent({ id: "e1", decision: "denied", createdAt: "2026-09-01T02:00:00.000Z" }),
          makeAuditEvent({ id: "e2", decision: "allowed", createdAt: "2026-09-01T03:00:00.000Z" }),
        ],
        immuneThreatEvents: [
          makeImmuneEvent({ id: "i1", decision: "deny", createdAt: "2026-09-01T04:00:00.000Z" }),
          makeImmuneEvent({ id: "i2", decision: "review", createdAt: "2026-09-01T05:00:00.000Z" }),
        ],
      });
      const service = new DashboardService(store);
      const result = service.getDenialRate(7, "day", now);
      const today = result.find((bucket) => bucket.date === "2026-09-01");
      expect(today?.count).toBe(2);
    });

    it("returns an all-zero range when there are no denials", () => {
      const now = new Date("2026-09-01T12:00:00.000Z");
      const service = new DashboardService(makeStore());
      const result = service.getDenialRate(3, "day", now);
      expect(result).toEqual([
        { date: "2026-08-30", count: 0 },
        { date: "2026-08-31", count: 0 },
        { date: "2026-09-01", count: 0 },
      ]);
    });
  });

  describe("getDenialFeed", () => {
    it("returns the most recent N denial events, newest first, redacted", () => {
      process.env.ARK_API_KEY = "top-secret";
      const store = makeStore({
        auditEvents: [
          makeAuditEvent({
            id: "e1",
            createdAt: "2026-08-30T00:00:00.000Z",
            reason: "leaked top-secret in reason",
          }),
          makeAuditEvent({ id: "e2", createdAt: "2026-08-31T00:00:00.000Z" }),
        ],
        immuneThreatEvents: [
          makeImmuneEvent({ id: "i1", createdAt: "2026-09-01T00:00:00.000Z" }),
        ],
      });
      const service = new DashboardService(store);
      const feed = service.getDenialFeed(2);

      expect(feed).toHaveLength(2);
      expect(feed[0].id).toBe("i1");
      expect(feed[1].id).toBe("e2");
      delete process.env.ARK_API_KEY;
    });

    it("excludes non-denied audit events and non-deny immune events", () => {
      const store = makeStore({
        auditEvents: [makeAuditEvent({ id: "e1", decision: "allowed" })],
        immuneThreatEvents: [makeImmuneEvent({ id: "i1", decision: "review" })],
      });
      const service = new DashboardService(store);
      expect(service.getDenialFeed(20)).toEqual([]);
    });
  });

  describe("getDashboard", () => {
    it("assembles all eight sections into one snapshot", () => {
      const service = new DashboardService(makeStore({ agents: [makeAgent()] }));
      const snapshot = service.getDashboard({ now: new Date("2026-09-01T00:00:00.000Z") });

      expect(snapshot).toHaveProperty("agentStatusOverview");
      expect(snapshot).toHaveProperty("runVolume");
      expect(snapshot).toHaveProperty("runOutcomeBreakdown");
      expect(snapshot).toHaveProperty("tokenUsage");
      expect(snapshot).toHaveProperty("errorBreakdown");
      expect(snapshot).toHaveProperty("mostActiveAgents");
      expect(snapshot).toHaveProperty("denialRate");
      expect(snapshot).toHaveProperty("denialFeed");
    });
  });
});
