import type { Ability, Risk } from "./middleware/permissions.ts";

export type AgentStatus = "ready" | "busy" | "stopped" | "error";
export type RunStatus =
  | "queued"
  | "pending_approval"
  | "running"
  | "completed"
  | "failed"
  | "denied"
  | "cancelled";
export type MessageRole = "user" | "assistant";

export type AuditDecision = "allowed" | "denied" | "pending_approval";
export type AuditActor = "human" | "agent" | "system";

export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  status: AgentStatus;
  workspacePath: string;
  codexThreadId: string | null;
  lastError: string | null;
  abilities: Record<Ability, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  agentId: string;
  runId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface RunUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

export interface AgentRun {
  id: string;
  agentId: string;
  sessionId: string | null;
  status: RunStatus;
  prompt: string;
  output: string | null;
  error: string | null;
  usage: RunUsage | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Database {
  version: 1;
  agents: Agent[];
  messages: Message[];
  runs: AgentRun[];
  auditEvents: AuditEvent[];
}

export interface CreateAgentInput {
  name: string;
  description?: string | undefined;
  instructions?: string | undefined;
  abilities?: Partial<Record<Ability, boolean>> | undefined;
}

export interface UpdateAgentInput {
  name?: string | undefined;
  description?: string | undefined;
  instructions?: string | undefined;
}

export interface RunnerResult {
  output: string;
  threadId: string | null;
  usage: RunUsage | null;
}

export interface RunnerRequest {
  agentId: string;
  workspacePath: string;
  prompt: string;
  threadId: string | null;
}

export interface AgentRunner {
  run(request: RunnerRequest): Promise<RunnerResult>;
  cancel(agentId: string): Promise<boolean>;
  isAvailable(): Promise<boolean>;
}

export interface AuditEvent {
  id: string;
  userId: string;
  agentId: string;
  runId: string | null;
  actor: AuditActor;
  action: string;
  risk: Risk | null;
  decision: AuditDecision;
  reason: string | null;
  createdAt: string;
}

export interface CoordinationEvent {
  agentId: string;
  sessionId: string | null;
  action: string;
  decision: AuditDecision;
  reason: string | null;
  risk: Risk | null;
}

export interface AuditEntry {
  userId: string;
  agentId: string;
  runId: string | null;
  sessionId: string | null;
  actor: AuditActor;
  action: string;
  risk: Risk | null;
  decision: AuditDecision;
  reason: string | null;
}


