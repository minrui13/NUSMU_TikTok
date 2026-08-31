import { AuditDecision, AuditEvent } from "./types/audits.js";

import type { Ability, Risk } from "./types/abilities.ts";

export type RunStatus =
  | "queued"
  | "pending_approval"
  | "running"
  | "completed"
  | "failed"
  | "denied"
  | "cancelled";

export type AgentStatus = "ready" | "busy" | "stopped" | "error";

export type MessageRole = "user" | "assistant" | "system";

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
  risk: Risk | null;
  output: string | null;
  error: string | null;
  usage: RunUsage | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type ImmuneThreatCategory =
  | "prompt_injection"
  | "credential_access"
  | "sensitive_resource"
  | "data_exfiltration"
  | "destructive_action"
  | "workspace_escape"
  | "suspicious_network"
  | "privilege_escalation";
export type ImmuneDecision = "allow" | "review" | "deny";
export type ImmuneReviewStatus = "pending" | "confirmed" | "dismissed";

export interface ImmuneScoreSignal {
  label: string;
  score: number;
}

export interface ImmuneThreatEvent {
  id: string;
  agentId: string;
  runId: string;
  promptExcerpt: string;
  score: number;
  baseScore: number;
  memoryAdjustment: number;
  decision: ImmuneDecision;
  categories: ImmuneThreatCategory[];
  reasons: string[];
  scoreBreakdown: ImmuneScoreSignal[];
  matchedMemoryIds: string[];
  learnedMatch: boolean;
  reviewStatus: ImmuneReviewStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ImmuneMemory {
  id: string;
  category: ImmuneThreatCategory;
  label: string;
  fingerprint: string;
  confirmations: number;
  dismissals: number;
  detections: number;
  confidence: number;
  autoBlock: boolean;
  status: "active" | "disabled";
  learnedFromEventId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  version: 1;
  agents: Agent[];
  messages: Message[];
  runs: AgentRun[];
  immuneThreatEvents: ImmuneThreatEvent[];
  immuneMemories: ImmuneMemory[];
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

export interface CoordinationEvent {
  agentId: string;
  sessionId: string | null;
  action: string;
  decision: AuditDecision;
  reason: string | null;
  risk: Risk | null;
  prompt: string;
}
