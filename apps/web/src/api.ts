import { Ability, AbilityBody } from "./types/abilities";
import { AuditEvent } from "./types/audits";

import type {
  Agent,
  AgentRole,
  AgentRun,
  GroupTaskState,
  ImmuneMemory,
  ImmuneThreatEvent,
  Message,
  SystemInfo,
  TrustSummaryItem,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

let authToken = "";

export function setAuthToken(token: string): void {
  authToken = token.trim();
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = {
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: "Bearer " + authToken } : {}),
    ...options?.headers,
  };
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "user-demo-001",
      Authorization: `Bearer ${authToken}`,
      ...options?.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      data.message ?? data.error ?? "Request failed",
      response.status,
    );
  }
  return data;
}

export const api = {
  auth: () => request<{ required: boolean }>("/api/auth"),
  system: () => request<SystemInfo>("/api/system"),
  listAgents: () => request<{ agents: Agent[] }>("/api/agents"),
  createAgent: (body: {
    name: string;
    description: string;
    instructions: string;
    role: AgentRole;
  }) =>
    request<{ agent: Agent }>("/api/agents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAgent: (
    id: string,
    body: { name: string; description: string; instructions: string; role: AgentRole },
  ) =>
    request<{ agent: Agent }>("/api/agents/" + id, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAgent: (id: string) =>
    request<{ archivedWorkspace: string }>("/api/agents/" + id, {
      method: "DELETE",
    }),
  startAgent: (id: string) =>
    request<{ agent: Agent }>("/api/agents/" + id + "/start", {
      method: "POST",
    }),
  stopAgent: (id: string) =>
    request<{ agent: Agent }>("/api/agents/" + id + "/stop", {
      method: "POST",
    }),
  messages: (id: string) =>
    request<{ messages: Message[] }>("/api/agents/" + id + "/messages"),
  allRuns: () => request<{ runs: AgentRun[] }>("/api/runs"),
  runs: (id: string) =>
    request<{ runs: AgentRun[] }>("/api/agents/" + id + "/runs"),
  sendMessage: (id: string, content: string) =>
    request<{ run: AgentRun; message: Message }>(
      "/api/agents/" + id + "/messages",
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
    ),
  run: (id: string) => request<{ run: AgentRun }>("/api/runs/" + id),
  immuneEvent: (runId: string) =>
    request<{ event: ImmuneThreatEvent | null }>(
      "/api/runs/" + runId + "/immune",
    ),
  immuneMemories: (agentId: string) =>
    request<{ memories: ImmuneMemory[] }>(
      "/api/agents/" + agentId + "/immune-memories",
    ),
  reviewImmuneEvent: (eventId: string, action: "confirm" | "dismiss") =>
    request<{ event: ImmuneThreatEvent; memory: ImmuneMemory | null }>(
      "/api/immune/events/" + eventId + "/review",
      { method: "POST", body: JSON.stringify({ action }) },
    ),
  approveRun: (id: string, body: { isApprove: boolean }, approver = "Tom (Administrator)") =>
    request<{ run: AgentRun }>("/api/runs/" + id + "/approve", {
      method: "POST",
      headers: { "x-user-id": approver },
      body: JSON.stringify(body),
    }),
  pendingApprovals: () =>
    request<{ runs: AgentRun[] }>("/api/runs/pendingApprovals"),
  trustSummary: () =>
    request<{ items: TrustSummaryItem[] }>("/api/admin/trust-summary"),
  auditEvents: () =>
    request<{ events: AuditEvent[] }>("/api/agents/auditEvents"),
  allAuditEvents: () => request<{ events: AuditEvent[] }>("/api/auditEvents"),
  abilities: () =>
    request<{ abilities: Record<Ability, boolean> }>("/api/abilities"),
  updateAbilities: (id: string, body: AbilityBody) =>
    request<{ agent: Agent }>("/api/agents/" + id + "/abilities", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  createGroupTask: (body: { description: string }) =>
    request<{ task: GroupTaskState }>("/api/group-tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  groupTask: (id: string) =>
    request<{ task: GroupTaskState }>("/api/group-tasks/" + id),
};
