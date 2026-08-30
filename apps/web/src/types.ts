export type AgentStatus = "ready" | "busy" | "stopped" | "error";
export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
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
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  agentId: string;
  runId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: RunStatus;
  prompt: string;
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
  | "data_exfiltration"
  | "destructive_action"
  | "workspace_escape"
  | "suspicious_network";

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
