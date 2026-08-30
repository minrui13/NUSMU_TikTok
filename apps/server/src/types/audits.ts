import { Risk } from "./abilities.js";

export type AuditDecision = "allowed" | "denied" | "pending_approval";
export type AuditActor = "human" | "agent" | "system";

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
  prompt: string | null;
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
  prompt: string | null;
  createdAt: string;
}
