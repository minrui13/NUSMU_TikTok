import { Ability, Risk } from "./types/abilities";
import { AuditEvent } from "./types/audits";

export type AgentStatus = "ready" | "busy" | "stopped" | "error";
export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "pending_approval";
export type GroupTaskStatus = "running" | "completed" | "failed";

export interface GroupTaskTurn {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  createdAt: string;
}

export interface GroupTaskState {
  id: string;
  description: string;
  participants: { id: string; name: string }[];
  turns: GroupTaskTurn[];
  status: GroupTaskStatus;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

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
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: RunStatus;
  prompt: string;
  risk: Risk | null;
  output: string | null;
  error: string | null;
  usage: {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
  } | null;
  createdAt: string;
}

export interface SystemInfo {
  arkConfigured: boolean;
  arkBaseUrl: string;
  arkModel: string | null;
  codexAvailable: boolean;
  codexSandboxMode: string;
  runtimeProvider: "local-process" | "container";
  containerEngine: string | null;
  runtime: string;
}

export type View = "playground" | "abilities" | "audit" | "approvals";

export type ToastItem =
  | { kind: "deny"; event: AuditEvent; agentName: string }
  | { kind: "pending"; event: AuditEvent; agentName: string }
  | { kind: "allowed"; run: AgentRun; agentName: string };
