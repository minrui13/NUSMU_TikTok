import { Ability, Risk } from "./types/abilities";
import { AuditEvent } from "./types/audits";

export type AgentStatus = "ready" | "busy" | "stopped" | "error";
export type AgentRole =
  | "frontend_developer"
  | "backend_developer"
  | "fullstack_developer"
  | "marketing"
  | "admin";
export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "pending_approval"
  | "denied";
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
  role: AgentRole;
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

export type ImmuneThreatCategory =
  | "prompt_injection"
  | "credential_access"
  | "sensitive_resource"
  | "data_exfiltration"
  | "destructive_action"
  | "workspace_escape"
  | "suspicious_network"
  | "privilege_escalation";

export interface ImmuneThreatEvent {
  id: string;
  agentId: string;
  runId: string;
  promptExcerpt: string;

  score: number;
  baseScore?: number;
  memoryAdjustment: number;

  decision: "allow" | "review" | "deny";
  categories: ImmuneThreatCategory[];
  reasons: string[];

  scoreBreakdown?: {
    label: string;
    score: number;
  }[];

  matchedMemoryIds: string[];
  learnedMatch: boolean;

  reviewStatus: "pending" | "confirmed" | "dismissed";
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
export interface TrustSummaryItem {
  agentId: string;
  agentName: string;
  role: AgentRole;
  adjustment: number;
  reasons: string[];
  personalApprovals: number;
  personalDenials: number;
  roleApprovals: number;
  roleDenials: number;
  familyApprovals: number;
  familyDenials: number;
}
export type View = "playground" | "abilities" | "audit" | "approvals" | "dashboard" | "admin";

export type ToastItem =
  | { kind: "deny"; event: AuditEvent; agentName: string }
  | { kind: "pending"; event: AuditEvent; agentName: string }
  | { kind: "allowed"; run: AgentRun; agentName: string };
