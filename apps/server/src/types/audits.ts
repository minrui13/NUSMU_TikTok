import { Risk } from "./abilities.js";

export type AuditDecision = "allowed" | "denied" | "pending_approval";
export type AuditActor = "human" | "agent" | "system";

// For recording an event
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

// For audit database
export interface AuditEvent {
  id: string;
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
  createdAt: string;
}

// Group coordinator event
export interface CoordinationEvent {
  agentId: string;
  sessionId: string;
  action: string;
  decision: AuditDecision;
  reason: string | null;
  risk: Risk | null;
  prompt: string | null;
}
