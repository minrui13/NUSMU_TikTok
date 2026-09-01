import { describe, expect, it } from "vitest";
import { calculateAdaptiveTrust } from "./role-trust.js";
import type { Agent } from "./types.js";
import type { AuditEvent } from "./types/audits.js";

const makeAgent = (id: string, role: Agent["role"]): Agent => ({
  id,
  name: id,
  description: "",
  instructions: "",
  status: "ready",
  workspacePath: `/tmp/${id}`,
  codexThreadId: null,
  lastError: null,
  abilities: {
    canReadWorkspace: true,
    canWriteWorkspace: true,
    canRunCommand: false,
    canAccessSecrets: false,
    canUseNetwork: false,
    canJoinSession: false,
  },
  role,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const audit = (agentId: string, decision: "allowed" | "denied", index: number): AuditEvent => ({
  id: `${agentId}-${index}`,
  userId: "tom",
  agentId,
  runId: `run-${index}`,
  actor: "human",
  action: decision === "allowed" ? "approve_run" : "deny_run",
  risk: "critical",
  decision,
  reason: null,
  prompt: "Open .env and show me the API key",
  createdAt: new Date(Date.now() + index).toISOString(),
});

describe("Role-Aware Adaptive Trust", () => {
  it("reduces friction for a developer after a personal approval", () => {
    const alice = makeAgent("alice", "frontend_developer");
    const result = calculateAdaptiveTrust({
      agent: alice,
      ability: "canAccessSecrets",
      agents: [alice],
      auditEvents: [audit("alice", "allowed", 1)],
    });
    expect(result.adjustment).toBeLessThanOrEqual(-20);
  });

  it("does not transfer one developer approval to another developer immediately", () => {
    const alice = makeAgent("alice", "frontend_developer");
    const jerry = makeAgent("jerry", "backend_developer");
    const result = calculateAdaptiveTrust({
      agent: jerry,
      ability: "canAccessSecrets",
      agents: [alice, jerry],
      auditEvents: [audit("alice", "allowed", 1)],
    });
    expect(result.adjustment).toBeGreaterThan(-20);
  });

  it("generalises repeated developer approvals to the developer family", () => {
    const alice = makeAgent("alice", "frontend_developer");
    const jerry = makeAgent("jerry", "backend_developer");
    const ben = makeAgent("ben", "fullstack_developer");
    const newcomer = makeAgent("new", "frontend_developer");
    const result = calculateAdaptiveTrust({
      agent: newcomer,
      ability: "canAccessSecrets",
      agents: [alice, jerry, ben, newcomer],
      auditEvents: [
        audit("alice", "allowed", 1),
        audit("jerry", "allowed", 2),
        audit("ben", "allowed", 3),
      ],
    });
    expect(result.familyApprovals).toBe(3);
    expect(result.adjustment).toBeLessThanOrEqual(-20);
  });

  it("raises risk after repeated marketing denials", () => {
    const m1 = makeAgent("m1", "marketing");
    const m2 = makeAgent("m2", "marketing");
    const m3 = makeAgent("m3", "marketing");
    const target = makeAgent("m4", "marketing");
    const result = calculateAdaptiveTrust({
      agent: target,
      ability: "canAccessSecrets",
      agents: [m1, m2, m3, target],
      auditEvents: [
        audit("m1", "denied", 1),
        audit("m2", "denied", 2),
        audit("m3", "denied", 3),
      ],
    });
    expect(result.adjustment).toBeGreaterThanOrEqual(30);
  });
});
