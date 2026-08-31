import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import type { Agent, AgentRole, AgentRun, TrustSummaryItem } from "../types";
import type { AuditEvent } from "../types/audits";

const ROLE_LABELS: Record<AgentRole, string> = {
  frontend_developer: "Frontend Developer",
  backend_developer: "Backend Developer",
  fullstack_developer: "Fullstack Developer",
  marketing: "Marketing",
  admin: "Administrator",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function trustState(adjustment: number): { label: string; className: string } {
  if (adjustment <= -20) return { label: "Trusted", className: "trust-good" };
  if (adjustment >= 45) return { label: "Auto-block", className: "trust-bad" };
  return { label: "Learning", className: "trust-learning" };
}

export function AdminApprovalCenter({ agents }: { agents: Agent[] }) {
  const [pendingRuns, setPendingRuns] = useState<AgentRun[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [trust, setTrust] = useState<TrustSummaryItem[]>([]);
  const [busyRunId, setBusyRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent] as const)),
    [agents],
  );

  const refresh = useCallback(async () => {
    try {
      const [pending, audits, trustResult] = await Promise.all([
        api.pendingApprovals(),
        api.auditEvents(),
        api.trustSummary(),
      ]);
      setPendingRuns(pending.runs);
      setAuditEvents(audits.events);
      setTrust(trustResult.items);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const decide = async (runId: string, approve: boolean) => {
    setBusyRunId(runId);
    setError(null);
    try {
      await api.approveRun(runId, { isApprove: approve }, "Tom (Administrator)");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyRunId(null);
    }
  };

  const recentAudit = auditEvents.slice(0, 12);

  return (
    <section className="admin-center">
      <div className="admin-hero">
        <div>
          <span className="eyebrow">Human control plane</span>
          <h1>Admin Approval Center</h1>
          <p>
            Tom reviews uncertain Agent actions. Decisions are written to the audit trail and become evidence for Role-Aware Adaptive Trust.
          </p>
        </div>
        <div className="admin-identity">
          <span>Operator</span>
          <strong>Tom</strong>
          <small>Administrator</small>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-kpis">
        <div><span>Pending</span><strong>{pendingRuns.length}</strong></div>
        <div><span>Audit events</span><strong>{auditEvents.length}</strong></div>
        <div><span>Trusted Agents</span><strong>{trust.filter((item) => item.adjustment <= -20).length}</strong></div>
        <div><span>Escalated Agents</span><strong>{trust.filter((item) => item.adjustment >= 45).length}</strong></div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="eyebrow">Needs Tom's decision</span>
            <h2>Pending approvals</h2>
          </div>
          <button className="button button-ghost" onClick={() => void refresh()}>Refresh</button>
        </div>

        {pendingRuns.length === 0 ? (
          <div className="admin-empty">No pending approvals. Trigger a medium-risk request from an Agent to see it here.</div>
        ) : (
          <div className="approval-list">
            {pendingRuns.map((run) => {
              const agent = agentById.get(run.agentId);
              return (
                <article className="approval-card" key={run.id}>
                  <div className="approval-card-head">
                    <div>
                      <strong>{agent?.name ?? "Unknown Agent"}</strong>
                      <span>{agent ? ROLE_LABELS[agent.role] : "Unknown role"}</span>
                    </div>
                    <span className="approval-risk">{run.risk ?? "high"} risk</span>
                  </div>
                  <div className="approval-prompt">{run.prompt}</div>
                  {run.error && <p className="approval-reason">{run.error}</p>}
                  <div className="approval-actions">
                    <button
                      className="button button-primary"
                      disabled={busyRunId === run.id}
                      onClick={() => void decide(run.id, true)}
                    >
                      {busyRunId === run.id ? "Working…" : "Approve & continue"}
                    </button>
                    <button
                      className="button button-danger"
                      disabled={busyRunId === run.id}
                      onClick={() => void decide(run.id, false)}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="eyebrow">Explainable learning</span>
            <h2>Adaptive Trust</h2>
          </div>
          <span className="admin-note">Secret-access policy view</span>
        </div>
        <div className="trust-grid">
          {trust.map((item) => {
            const state = trustState(item.adjustment);
            return (
              <article className="trust-card" key={item.agentId}>
                <div className="trust-card-head">
                  <div>
                    <strong>{item.agentName}</strong>
                    <span>{ROLE_LABELS[item.role]}</span>
                  </div>
                  <span className={`trust-state ${state.className}`}>{state.label}</span>
                </div>
                <div className="trust-score-row">
                  <span>Trust adjustment</span>
                  <strong>{item.adjustment > 0 ? "+" : ""}{item.adjustment}</strong>
                </div>
                <div className="trust-evidence">
                  <span>Personal: {item.personalApprovals} approved / {item.personalDenials} denied</span>
                  <span>Role: {item.roleApprovals} approved / {item.roleDenials} denied</span>
                  <span>Family: {item.familyApprovals} approved / {item.familyDenials} denied</span>
                </div>
                <ul>
                  {item.reasons.length > 0 ? item.reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>No prior trust evidence yet.</li>}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="eyebrow">Immutable evidence</span>
            <h2>Recent audit trail</h2>
          </div>
        </div>
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr><th>Time</th><th>Operator / actor</th><th>Agent</th><th>Action</th><th>Decision</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {recentAudit.map((event) => {
                const agent = agentById.get(event.agentId);
                return (
                  <tr key={event.id}>
                    <td>{formatDate(event.createdAt)}</td>
                    <td>{event.userId}</td>
                    <td>{agent?.name ?? event.agentId.slice(0, 8)}</td>
                    <td><code>{event.action}</code></td>
                    <td><span className={`audit-decision audit-${event.decision}`}>{event.decision.replaceAll("_", " ")}</span></td>
                    <td>{event.reason ?? "—"}</td>
                  </tr>
                );
              })}
              {recentAudit.length === 0 && <tr><td colSpan={6}>No audit events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
