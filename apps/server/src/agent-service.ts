import { isArkConfigured } from "./config.js";
import { HttpError, RunCancelledError } from "./errors.js";
import {
  classifyAction,
  defaultAgentAbilities,
} from "./middleware/permissions.js";
import {
  checkAbility,
  evaluateAction,
  overallDecision,
} from "./middleware/policy-checker.js";
import { JsonStore } from "./store.js";

import { Ability } from "./types/abilities.js";
import { AuditEntry } from "./types/audits.js";
import { WorkspaceManager } from "./workspace.js";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import type {
  Agent,
  AgentRun,
  AgentRunner,
  CoordinationEvent,
  CreateAgentInput,
  Message,
  UpdateAgentInput,
} from "./types.js";
import { getKnownSecrets, redactSecrets } from "./utils/redaction.js";

const now = () => new Date().toISOString();

// get all the granted abilities
function grantedList(abilities: Record<Ability, boolean>): Ability[] {
  return Object.entries(abilities)
    .filter(([, granted]) => granted)
    .map(([ability]) => ability as Ability);
}

export class AgentService {
  private readonly activeExecutions = new Map<string, Promise<void>>();
  private readonly cancellationRequests = new Set<string>();

  constructor(
    private readonly config: AppConfig,
    private readonly store: JsonStore,
    private readonly workspaces: WorkspaceManager,
    private readonly runner: AgentRunner,
  ) {}

  async initialize(): Promise<void> {
    await this.store.initialize();
    await this.workspaces.initialize();
    await this.store.mutate((database) => {
      for (const run of database.runs) {
        if (run.status === "queued" || run.status === "running") {
          run.status = "cancelled";
          run.error = "Server restarted while this run was active";
          run.completedAt = now();
        }
      }
      for (const agent of database.agents) {
        if (agent.status === "busy") {
          agent.status = "ready";
          agent.updatedAt = now();
        }
      }
    });
  }

  listAgents(): Agent[] {
    return this.store
      .snapshot()
      .agents.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
  }

  getAgent(id: string): Agent {
    const agent = this.store.snapshot().agents.find((item) => item.id === id);
    if (!agent) {
      throw new HttpError(404, "Agent not found");
    }
    return agent;
  }

  async createAgent(input: CreateAgentInput): Promise<Agent> {
    const timestamp = now();
    const id = randomUUID();
    const agent: Agent = {
      id,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      instructions: input.instructions?.trim() ?? "",
      status: "ready",
      workspacePath: this.workspaces.workspacePath(id),
      codexThreadId: null,
      lastError: null,
      abilities: { ...defaultAgentAbilities, ...input.abilities },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.workspaces.create(agent);
    await this.store.mutate((database) => database.agents.push(agent));
    return agent;
  }

  async updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
    const current = this.getAgent(id);
    if (current.status === "busy") {
      throw new HttpError(409, "Stop the active run before editing this Agent");
    }
    const updated = await this.store.mutate((database) => {
      const agent = database.agents.find((item) => item.id === id);
      if (!agent) {
        throw new HttpError(404, "Agent not found");
      }
      if (agent.status === "busy") {
        throw new HttpError(
          409,
          "Stop the active run before editing this Agent",
        );
      }
      if (input.name !== undefined) agent.name = input.name.trim();
      if (input.description !== undefined) {
        agent.description = input.description.trim();
      }
      if (input.instructions !== undefined) {
        agent.instructions = input.instructions.trim();
      }
      agent.lastError = null;
      agent.updatedAt = now();
      return structuredClone(agent);
    });
    await this.workspaces.writeInstructions(updated);
    return updated;
  }

  async deleteAgent(id: string): Promise<{ archivedWorkspace: string }> {
    const agent = this.getAgent(id);
    await this.cancelExecution(id);
    const archivedWorkspace = await this.workspaces.archive(agent);
    await this.store.mutate((database) => {
      database.agents = database.agents.filter((item) => item.id !== id);
      database.messages = database.messages.filter(
        (item) => item.agentId !== id,
      );
      database.runs = database.runs.filter((item) => item.agentId !== id);
    });
    return { archivedWorkspace };
  }

  async startAgent(id: string): Promise<Agent> {
    return this.setStatus(id, "ready");
  }

  async stopAgent(id: string): Promise<Agent> {
    this.getAgent(id);
    await this.cancelExecution(id);
    return this.setStatus(id, "stopped");
  }

  getMessages(agentId: string): Message[] {
    this.getAgent(agentId);
    return this.store
      .snapshot()
      .messages.filter((message) => message.agentId === agentId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  getRun(runId: string): AgentRun {
    const run = this.store.snapshot().runs.find((item) => item.id === runId);
    if (!run) {
      throw new HttpError(404, "Run not found");
    }
    return run;
  }

  getRuns(agentId: string): AgentRun[] {
    this.getAgent(agentId);
    return this.store
      .snapshot()
      .runs.filter((run) => run.agentId === agentId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async sendMessage(
    agentId: string,
    prompt: string,
    userId: string,
    sessionId: string | null = null,
  ): Promise<{ run: AgentRun; message: Message }> {
    if (!isArkConfigured(this.config)) {
      throw new HttpError(
        503,
        "Ark is not configured. Set ARK_API_KEY and ARK_MODEL, then restart.",
      );
    }
    const timestamp = now();
    const runId = randomUUID();
    const run: AgentRun = {
      id: runId,
      agentId,
      sessionId,
      status: "queued",
      risk: null,
      prompt,
      output: null,
      error: null,
      usage: null,
      startedAt: null,
      completedAt: null,
      createdAt: timestamp,
    };
    const message: Message = {
      id: randomUUID(),
      agentId,
      runId,
      role: "user",
      content: prompt,
      createdAt: timestamp,
    };

    const agentAtStart = await this.store.mutate((database) => {
      const storedAgent = database.agents.find((item) => item.id === agentId);
      if (!storedAgent) {
        throw new HttpError(404, "Agent not found");
      }
      if (storedAgent.status === "stopped") {
        throw new HttpError(409, "Start the Agent before sending a message");
      }
      if (storedAgent.status === "busy") {
        throw new HttpError(409, "This Agent is already running");
      }
      database.runs.push(run);
      database.messages.push(message);
      const snapshot = structuredClone(storedAgent);
      storedAgent.status = "busy";
      storedAgent.lastError = null;
      storedAgent.updatedAt = timestamp;
      return snapshot;
    });

    const requiredAbilities = classifyAction(prompt);

    const results = evaluateAction(
      requiredAbilities,
      grantedList(agentAtStart.abilities),
    );

    for (const result of results) {
      await this.recordAudit({
        userId,
        agentId,
        runId: run.id,
        sessionId: run.id,
        actor: "human",
        action: result.ability,
        risk: result.risk,
        decision: result.decision,
        reason: result.reason,
        prompt: run.prompt,
      });
    }
    const decision = overallDecision(results);
    const denied = results.find((result) => result.decision === "denied");
    const pending = results.find(
      (result) => result.decision === "pending_approval",
    );

    if (decision === "denied" && denied) {
      await this.denyRun(agentId, run.id, "failed", denied.reason);
      throw new HttpError(403, denied.reason);
    }

    if (decision === "pending_approval" && pending) {
      await this.store.mutate((database) => {
        const storedAgent = database.agents.find(
          (agent) => agent.id === agentId,
        );
        const storedRun = database.runs.find(
          (storedRun) => storedRun.id === run.id,
        );

        if (storedAgent) {
          storedAgent.status = "ready";
          storedAgent.updatedAt = now();
        }

        if (storedRun) {
          storedRun.status = "pending_approval";
          storedRun.risk = pending.risk;
          storedRun.error = pending.reason;
        }
      });

      return {
        run: this.getRun(run.id),
        message,
      };
    }

    const execution = this.executeRun(agentAtStart, run);
    this.activeExecutions.set(agentId, execution);
    void execution
      .finally(() => {
        if (this.activeExecutions.get(agentId) === execution) {
          this.activeExecutions.delete(agentId);
        }
      })
      .catch(() => undefined);
    return { run, message };
  }

  // Update the abilities of an agent
  async updateAbilities(
    id: string,
    patch: Partial<Record<Ability, boolean>>,
    userId: string,
  ): Promise<Agent> {
    const updated = await this.store.mutate((database) => {
      const agent = database.agents.find((item) => item.id === id);
      if (!agent) throw new HttpError(404, "Agent not found");
      agent.abilities = { ...agent.abilities, ...patch };
      return structuredClone(agent);
    });
    await this.recordAudit({
      userId,
      agentId: id,
      sessionId: null,
      runId: null,
      actor: "human",
      action: "updateAbilities:" + JSON.stringify(patch),
      risk: null,
      decision: "allowed",
      reason: null,
      prompt: null,
    });
    return updated;
  }

  // Get all Audit Events of the specified agent
  getAuditEvents() {
    return this.store
      .snapshot()
      .auditEvents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async systemInfo(): Promise<Record<string, unknown>> {
    return {
      arkConfigured: isArkConfigured(this.config),
      arkBaseUrl: this.config.arkBaseUrl,
      arkModel: this.config.arkModel || null,
      codexAvailable: await this.runner.isAvailable(),
      codexSandboxMode: this.config.codexSandboxMode,
      runtimeProvider: this.config.runtimeProvider,
      containerEngine:
        this.config.runtimeProvider === "container"
          ? this.config.containerEngine
          : null,
      runtime:
        this.config.runtimeProvider === "container"
          ? "Codex CLI in " + this.config.containerEngine + " Runtime"
          : "Codex CLI in application container",
    };
  }

  private async executeRun(agentAtStart: Agent, run: AgentRun): Promise<void> {
    await this.store.mutate((database) => {
      const storedRun = database.runs.find((item) => item.id === run.id);
      if (storedRun) {
        storedRun.status = "running";
        storedRun.startedAt = now();
      }
    });
    try {
      if (this.cancellationRequests.has(agentAtStart.id)) {
        throw new RunCancelledError();
      }
      const result = await this.runner.run({
        agentId: agentAtStart.id,
        workspacePath: agentAtStart.workspacePath,
        prompt: run.prompt,
        threadId: agentAtStart.codexThreadId,
      });
      const completedAt = now();
      await this.store.mutate((database) => {
        const storedRun = database.runs.find((item) => item.id === run.id);
        const agent = database.agents.find(
          (item) => item.id === agentAtStart.id,
        );
        if (!storedRun || !agent) return;
        const safeOutput = redactSecrets(result.output, getKnownSecrets());
        storedRun.status = "completed";
        storedRun.output = safeOutput;
        storedRun.usage = result.usage;
        storedRun.completedAt = completedAt;
        database.messages.push({
          id: randomUUID(),
          agentId: agent.id,
          runId: run.id,
          role: "assistant",
          content: safeOutput,
          createdAt: completedAt,
        });
        agent.status = "ready";
        agent.codexThreadId = result.threadId;
        agent.lastError = null;
        agent.updatedAt = completedAt;
      });
    } catch (error) {
      const completedAt = now();
      const cancelled = error instanceof RunCancelledError;
      const message = error instanceof Error ? error.message : String(error);
      const safeMessage = redactSecrets(message, getKnownSecrets());
      await this.store.mutate((database) => {
        const storedRun = database.runs.find((item) => item.id === run.id);
        const agent = database.agents.find(
          (item) => item.id === agentAtStart.id,
        );
        if (storedRun) {
          storedRun.status = cancelled ? "cancelled" : "failed";
          storedRun.error = safeMessage;
          storedRun.completedAt = completedAt;
        }
        if (agent) {
          if (agent.status !== "stopped") {
            agent.status = cancelled ? "ready" : "error";
          }
          agent.lastError = cancelled ? null : safeMessage;
          agent.updatedAt = completedAt;
        }
      });
    }
  }

  private async setStatus(id: string, status: Agent["status"]): Promise<Agent> {
    return this.store.mutate((database) => {
      const agent = database.agents.find((item) => item.id === id);
      if (!agent) {
        throw new HttpError(404, "Agent not found");
      }
      if (status === "ready" && agent.status === "busy") {
        throw new HttpError(
          409,
          "Stop the active run before starting this Agent",
        );
      }
      agent.status = status;
      if (status === "ready") agent.lastError = null;
      agent.updatedAt = now();
      return structuredClone(agent);
    });
  }

  private async cancelExecution(agentId: string): Promise<void> {
    this.cancellationRequests.add(agentId);
    try {
      await this.runner.cancel(agentId);
      const execution = this.activeExecutions.get(agentId);
      if (execution) {
        await execution;
      }
    } finally {
      this.cancellationRequests.delete(agentId);
    }
  }

  // Logs whenever something important happens involving Agent permissions or policy decisions
  // It records if the permission is granted or revoke,
  // if the policy allows, denies or pauses the action,
  // if a human approves or rejects a pending action
  private async recordAudit(entry: AuditEntry): Promise<void> {
    await this.store.mutate((database) => {
      database.auditEvents.push({
        id: randomUUID(),
        createdAt: now(),
        ...entry,
      });
    });
  }

  async recordCoordinationEvent(entry: CoordinationEvent): Promise<void> {
    await this.recordAudit({
      userId: "system:coordinator",
      agentId: entry.agentId,
      runId: null,
      sessionId: entry.sessionId,
      actor: "system",
      action: entry.action,
      risk: entry.risk,
      decision: entry.decision,
      reason: entry.reason,
      prompt: entry.prompt,
    });
  }

  /* Human approval for high-risk agent actions */
  // When disapprove, it finds the run and then don't let the agent
  private async denyRun(
    agentId: string,
    runId: string,
    status: "denied" | "failed",
    reason: string,
  ) {
    await this.store.mutate((database) => {
      const storedAgent = database.agents.find((a) => a.id === agentId);
      const storedRun = database.runs.find((r) => r.id === runId);
      if (storedAgent) {
        storedAgent.status = "ready";
        storedAgent.lastError = reason;
      }
      if (storedRun) {
        storedRun.status = status;
        storedRun.error = reason;
        storedRun.completedAt = now();
      }
    });
  }

  // When approve, it finds the run and then let the agent run
  async approveRun(
    runId: string,
    approverUserId: string,
    grant: boolean,
  ): Promise<AgentRun> {
    const run = this.getRun(runId);
    if (run.status !== "pending_approval") {
      throw new HttpError(409, "This run is not awaiting approval");
    }
    const agent = this.getAgent(run.agentId);

    await this.recordAudit({
      userId: approverUserId,
      agentId: agent.id,
      runId: run.id,
      sessionId: run.sessionId,
      actor: "human",
      action: grant ? "approve_run" : "deny_run",
      risk: "high",
      decision: grant ? "allowed" : "denied",
      reason: grant
        ? "Approved by " + approverUserId
        : "Denied by " + approverUserId,
      prompt: run.prompt,
    });

    if (!grant) {
      await this.denyRun(
        agent.id,
        run.id,
        "denied",
        "Approval denied by " + approverUserId,
      );
      return this.getRun(runId);
    }

    const freshAgent = await this.store.mutate((database) => {
      const storedAgent = database.agents.find((a) => a.id === agent.id);
      const storedRun = database.runs.find((r) => r.id === run.id);
      if (!storedAgent) throw new HttpError(404, "Agent not found");
      if (storedAgent.status === "busy") {
        throw new HttpError(409, "Agent is already running something else");
      }
      storedAgent.status = "busy";
      storedAgent.updatedAt = now();
      if (storedRun) storedRun.status = "running";
      return structuredClone(storedAgent);
    });

    const execution = this.executeRun(freshAgent, run);
    this.activeExecutions.set(agent.id, execution);
    void execution
      .finally(() => {
        if (this.activeExecutions.get(agent.id) === execution) {
          this.activeExecutions.delete(agent.id);
        }
      })
      .catch(() => undefined);

    return this.getRun(runId);
  }

  checkCanJoinSession(agentId: string): { allowed: boolean; reason: string } {
    const agent = this.getAgent(agentId);
    const decision = checkAbility(
      "canJoinSession",
      grantedList(agent.abilities),
    );
    return {
      allowed: decision.decision === "allowed",
      reason: decision.reason,
    };
  }

  // Listing approvals that is needed by the human
  getPendingApprovals(): AgentRun[] {
    return this.store
      .snapshot()
      .runs.filter((run) => run.status === "pending_approval")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
