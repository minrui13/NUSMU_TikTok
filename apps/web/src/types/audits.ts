export interface AuditEvent {
  id: string;
  userId: string;
  agentId: string;
  runId: string | null;
  sessionId: string | null;
  actor: "human" | "agent" | "system";
  action: string;
  risk: "low" | "medium" | "high" | "critical" | null;
  decision: "allowed" | "denied" | "pending_approval";
  reason: string | null;
  prompt: string | null;
  createdAt: string;
}
