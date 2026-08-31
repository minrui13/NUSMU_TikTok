import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer, toast } from "react-toastify";

import { api, ApiError, setAuthToken } from "./api";
// import { AbilitiesTable } from "./components/AbilitiesTable";
import { AdminApprovalCenter } from "./components/AdminApprovalCenter";
import { FailedMessage } from "./components/messages/FailedMessage";
import { PendingApprovalMessage } from "./components/messages/PendingApprovalMessage";
import { AllowedToast } from "./components/toasts/AllowedToast";
import { DenyToast } from "./components/toasts/DenyToast";
import { PendingApprovalToast } from "./components/toasts/PendingApprovalToast";
import { GroupTaskPanel } from "./components/GroupTaskPanel";
import { defaultAbilities } from "./types/abilities";

import type {
  Agent,
  AgentRun,
  Message,
  SystemInfo,
  ToastItem,
  ImmuneThreatEvent,
  AgentRole,
  View,
} from "./types";

import { AbilitiesView } from "./components/AbilitiesView";
import { AuditView } from "./components/audit/AuditView";
import Dashboard from "./pages/Dashboard";

const starterPrompts = [
  "Create a small TypeScript CLI that prints a weather summary from sample JSON.",
  "Inspect this workspace and explain what you would improve first.",
  "Build a responsive single-page todo app with tests.",
];

const ROLE_OPTIONS: Array<{ value: AgentRole; label: string }> = [
  { value: "frontend_developer", label: "Frontend Developer" },
  { value: "backend_developer", label: "Backend Developer" },
  { value: "fullstack_developer", label: "Fullstack Developer" },
  { value: "marketing", label: "Marketing" },
  { value: "admin", label: "Administrator" },
];

const emptyForm = {
  name: "",
  description: "",
  role: "frontend_developer" as AgentRole,
  instructions:
    "Help me build and test software in this workspace. Keep changes small and explain the result.",
};

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusPill({ status }: { status: Agent["status"] }) {
  return (
    <span className={"status status-" + status}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroupTask, setShowGroupTask] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [prompt, setPrompt] = useState("");
  const [activeRun, setActiveRun] = useState<AgentRun | null>(null);
  const [immuneEvent, setImmuneEvent] = useState<ImmuneThreatEvent | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [authInput, setAuthInput] = useState("");
  const [view, setView] = useState<View>("playground");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showAdminCenter, setShowAdminCenter] = useState(false);

  const seenCompletedRunIds = useRef(new Set<string>());
  const isFirstRunPoll = useRef(true);

  const [savingAbilities, setSavingAbilities] = useState<
    Record<string, boolean>
  >({});
  const messageEnd = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const pollingRunIds = useRef(new Set<string>());
  selectedIdRef.current = selectedId;

  const selected = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? null,
    [agents, selectedId],
  );

  const isRunActive =
    activeRun?.status === "queued" || activeRun?.status === "running";

  const isPendingApproval = activeRun?.status === "pending_approval";

  const isRunFailed = activeRun?.status === "failed";

  const immuneDenied = isRunFailed && immuneEvent?.decision === "deny";

  const immuneNeedsReview = isRunFailed && immuneEvent?.decision === "review";

  const showFailedMessage = isRunFailed && !immuneDenied && !immuneNeedsReview;

  const refreshAgents = useCallback(async () => {
    const { agents: next } = await api.listAgents();
    setAgents(next);
    setSelectedId((current) =>
      current && next.some((agent) => agent.id === current) ? current : null,
    );
  }, []);

  const refreshMessages = useCallback(async (agentId: string) => {
    const result = await api.messages(agentId);
    if (mountedRef.current && selectedIdRef.current === agentId) {
      setMessages(result.messages);
    }
  }, []);

  const updateAbilities = useCallback(
    async (agentId: string, ability: string, next: boolean) => {
      const cellKey = agentId + ":" + ability;
      setSavingAbilities((s) => ({ ...s, [cellKey]: true }));
      try {
        await api.updateAbilities(agentId, { [ability]: next });
        await refreshAgents();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setSavingAbilities((s) => ({ ...s, [cellKey]: false }));
      }
    },
    [refreshAgents],
  );

  const bootstrap = useCallback(async () => {
    await Promise.all([refreshAgents(), api.system().then(setSystem)]);
  }, [refreshAgents]);

  useEffect(() => {
    setToasts((current) =>
      current.filter((toast) => {
        const agentId =
          toast.kind === "allowed" ? toast.run.agentId : toast.event.agentId;

        return agentId !== selectedId;
      }),
    );
  }, [selectedId]);

  useEffect(() => {
    let polling = false;

    const poll = async () => {
      if (polling) {
        return;
      }

      polling = true;

      try {
        const { runs } = await api.allRuns();

        const completed = runs.filter((run) => run.status === "completed");

        if (isFirstRunPoll.current) {
          completed.forEach((run) => seenCompletedRunIds.current.add(run.id));

          isFirstRunPoll.current = false;
          return;
        }

        const fresh = completed.filter(
          (run) => !seenCompletedRunIds.current.has(run.id),
        );

        fresh.forEach((run) => seenCompletedRunIds.current.add(run.id));

        for (const run of fresh) {
          if (run.agentId === selectedIdRef.current) {
            continue;
          }

          const agentName =
            agents.find((agent) => agent.id === run.agentId)?.name ??
            "Unknown Agent";

          setToasts((current) => [
            ...current,
            {
              kind: "allowed" as const,
              run,
              agentName,
            },
          ]);

          window.setTimeout(() => {
            setToasts((current) =>
              current.filter(
                (toast) =>
                  !(toast.kind === "allowed" && toast.run.id === run.id),
              ),
            );
          }, 7000);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        polling = false;
      }
    };

    void poll();

    const intervalId = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [agents]);

  useEffect(() => {
    mountedRef.current = true;
    void api
      .auth()
      .then(async ({ required }) => {
        if (!mountedRef.current) return;
        setAuthRequired(required);
        if (!required) await bootstrap();
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      );
    return () => {
      mountedRef.current = false;
    };
  }, [bootstrap]);

  useEffect(() => {
    setActiveRun(null);
    setImmuneEvent(null);
    setShowSettings(false);

    if (!selectedId) {
      setMessages([]);
      return;
    }

    void Promise.all([refreshMessages(selectedId), api.runs(selectedId)])
      .then(([, result]) => {
        if (selectedIdRef.current !== selectedId) return;

        const latest = result.runs[0] ?? null;
        setActiveRun(latest);
        if (latest) {
          void api.immuneEvent(latest.id).then((value) => {
            if (selectedIdRef.current === selectedId) {
              setImmuneEvent(value.event);
            }
          });
        }
        if (latest && ["queued", "running"].includes(latest.status)) {
          void pollRun(latest.id, selectedId).catch((reason) =>
            setError(reason instanceof Error ? reason.message : String(reason)),
          );
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      );
  }, [refreshMessages, selectedId]);

  useEffect(() => {
    if (selected) {
      setForm({
        name: selected.name,
        description: selected.description,
        role: selected.role ?? "frontend_developer",
        instructions: selected.instructions,
      });
    }
  }, [selected]);

  useEffect(() => {
    setImmuneEvent(null);
  }, [selectedId, activeRun?.id]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeRun]);

  const createAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { agent } = await api.createAgent(form);
      await refreshAgents();
      setSelectedId(agent.id);
      setShowCreate(false);
      setForm(emptyForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const saveAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateAgent(selected.id, form);
      await refreshAgents();
      setShowSettings(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const toggleAgent = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      if (selected.status === "stopped") {
        await api.startAgent(selected.id);
      } else {
        await api.stopAgent(selected.id);
      }
      await refreshAgents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const deleteAgent = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        "Delete " + selected.name + "? Its workspace will be archived.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.deleteAgent(selected.id);
      await refreshAgents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const pollRun = async (runId: string, agentId: string) => {
    if (pollingRunIds.current.has(runId)) return;
    pollingRunIds.current.add(runId);
    try {
      while (mountedRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        if (!mountedRef.current) return;
        const result = await api.run(runId);
        if (selectedIdRef.current === agentId) {
          setActiveRun(result.run);
          if (!["queued", "running"].includes(result.run.status)) {
            const immune = await api.immuneEvent(runId);
            setImmuneEvent(immune.event);
          }
        }
        if (!["queued", "running"].includes(result.run.status)) {
          await Promise.all([refreshMessages(agentId), refreshAgents()]);
          return;
        }
      }
    } finally {
      pollingRunIds.current.delete(runId);
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selected || !prompt.trim()) {
      return;
    }

    const content = prompt.trim();
    const selectedAgentId = selected.id;
    const selectedAgentName = selected.name;

    setPrompt("");
    setError(null);
    setImmuneEvent(null);
    try {
      const result = await api.sendMessage(selectedAgentId, content);

      if (selectedIdRef.current === selectedAgentId) {
        setMessages((current) => [...current, result.message]);

        setActiveRun(result.run);
      }

      setAgents((current) =>
        current.map((agent) =>
          agent.id === selectedAgentId ? { ...agent, status: "busy" } : agent,
        ),
      );
      await pollRun(result.run.id, selectedAgentId);
      const memoryResult = await api.immuneMemories(selected.id);
      // if (selectedIdRef.current === selected.id) setImmuneMemories(memoryResult.memories);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);

      setError(message);

      try {
        const { events } = await api.allAuditEvents();

        const latestDeniedEvent = events
          .filter(
            (event) =>
              event.agentId === selectedAgentId && event.decision === "denied",
          )
          .sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
          )[0];

        if (latestDeniedEvent) {
          setToasts((current) => [
            ...current,
            {
              kind: "deny",
              event: latestDeniedEvent,
              agentName: selectedAgentName,
            },
          ]);

          window.setTimeout(() => {
            setToasts((current) =>
              current.filter(
                (toast) =>
                  !(
                    toast.kind === "deny" &&
                    toast.event.id === latestDeniedEvent.id
                  ),
              ),
            );
          }, 5000);
        }
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setError(message);
        const { events } = await api.allAuditEvents();
        const latestDeniedEvent = events
          .filter((event) => event.decision === "denied")
          .sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
          )[0];
        if (latestDeniedEvent) {
          setToasts((current) => [
            ...current,
            {
              kind: "deny",
              event: latestDeniedEvent,
              agentName: selectedAgentName,
            },
          ]);
        }
      }
    }
  };

  const navigateToView = (agentId: string | null, view: View) => {
    setSelectedId(agentId);
    setView(view);
  };

  const reviewImmuneEvent = async (action: "confirm" | "dismiss") => {
    if (!immuneEvent) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.reviewImmuneEvent(immuneEvent.id, action);
      setImmuneEvent(result.event);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setAuthToken(authInput);
    try {
      await bootstrap();
      setAuthRequired(false);
      setAuthInput("");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setError("The access token is not valid.");
      } else {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      setBusy(false);
    }
  };

  if (authRequired === null) {
    return (
      <main className="auth-screen">
        <section className="auth-card" aria-live="polite">
          <div className="brand-mark">{"A"}</div>
          <span className="eyebrow">{"Agent Launchpad"}</span>
          <h1>{"Connecting to the control plane"}</h1>
          {error ? (
            <div className="error-banner" role="alert">
              {error}
            </div>
          ) : (
            <Spinner />
          )}
        </section>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="auth-screen">
        <form className="auth-card" onSubmit={unlock}>
          <div className="brand-mark">{"A"}</div>
          <span className="eyebrow">{"Agent Launchpad"}</span>
          <h1>{"Enter the access token"}</h1>
          <p>
            {"This shared demo token is configured by the platform operator."}
          </p>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <label>
            {"Access token\r"}
            <input
              autoFocus
              type="password"
              value={authInput}
              onChange={(event) => setAuthInput(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button
            className="button button-primary"
            disabled={busy || !authInput.trim()}
          >
            {busy ? <Spinner /> : "Open Launchpad"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="toast-stack">
        {toasts.map((toast, i) => {
          const toastAgentId =
            toast.kind === "allowed" ? toast.run.agentId : toast.event.agentId;

          const key = toast.kind === "allowed" ? toast.run.id : toast.event.id;
          if (toastAgentId === selectedId) {
            return null;
          }

          if (toast.kind === "deny") {
            return (
              <DenyToast
                key={key}
                run={toast.event}
                agentName={toast.agentName}
                onDismiss={() =>
                  setToasts((c) => c.filter((_, idx) => idx !== i))
                }
                navigateToView={navigateToView}
              />
            );
          }
          if (toast.kind === "pending") {
            return (
              <PendingApprovalToast
                key={key}
                run={toast.event}
                agentName={toast.agentName}
                onDismiss={() =>
                  setToasts((c) => c.filter((_, idx) => idx !== i))
                }
                onReview={() =>
                  navigateToView(toast.event.agentId, "playground")
                }
              />
            );
          }
          return (
            <AllowedToast
              key={key}
              run={toast.run}
              agentName={toast.agentName}
              onDismiss={() =>
                setToasts((c) => c.filter((_, idx) => idx !== i))
              }
              navigateToView={() =>
                navigateToView(toast.run.agentId, "playground")
              }
            />
          );
        })}
      </div>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">{"A"}</div>
            <div>
              <strong>{"Agent Launchpad"}</strong>
              <span>
                {system?.runtimeProvider === "container"
                  ? "Local container · Codex CLI"
                  : "ECS / Docker · Codex CLI"}
              </span>
            </div>
          </div>

          <button
            className="button button-primary create-button"
            onClick={() => {
              setForm(emptyForm);
              setShowCreate(true);
            }}
          >
            <span>{"＋"}</span> {"Create Agent\r"}
          </button>

          <button
            className="button button-secondary group-task-button"
            onClick={() => setShowGroupTask(true)}
          >
            <span className="button-icon">{"👥"}</span> {"Group Task\r"}
          </button>

          <div className="sidebar-label">
            <span>{"Utilities"}</span>
          </div>
          <nav className="utilities-list">
            <span
              className={`${view === "abilities" ? "view-clicked" : ""}`}
              onClick={() => {
                navigateToView(null, "abilities");
              }}
            >
              {"Abilities\r"}
            </span>
            <span
              className={`${view === "audit" ? "view-clicked" : ""}`}
              onClick={() => {
                navigateToView(null, "audit");
              }}
            >
              {"Audit Log\r"}
            </span>
            <span
              className={`${view === "admin" ? "view-clicked" : ""}`}
              onClick={() => {
                navigateToView(null, "admin");
              }}
            >
              {"Admin Center"}
            </span>
            <span
              className={`${view === "dashboard" ? "view-clicked" : ""}`}
              onClick={() => {
                navigateToView(null, "dashboard");
              }}
            >
              {"Dashboard\r"}
            </span>
          </nav>
          <div className="sidebar-label">
            <span>{"Your Agents"}</span>
            <span>{agents.length}</span>
          </div>
          <nav className="agent-list">
            {agents.map((agent) => (
              <button
                className={
                  "agent-card " + (agent.id === selectedId ? "selected" : "")
                }
                key={agent.id}
                onClick={() => {
                  navigateToView(agent.id, "playground");
                }}
              >
                <div className="agent-avatar">
                  {agent.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="agent-card-copy">
                  <strong>{agent.name}</strong>
                  <span>{agent.description || "Coding Agent"}</span>
                </div>
                <span className={"mini-dot mini-" + agent.status} />
              </button>
            ))}
            {agents.length === 0 && (
              <div className="empty-sidebar">
                <span>{"◇"}</span>
                {"Create your first coding Agent.\r"}
              </div>
            )}
          </nav>

          <div className="runtime-card">
            <span className="eyebrow">{"Runtime"}</span>
            <strong>{system?.runtime ?? "Checking…"}</strong>
            <span>
              {system?.arkModel ?? "Ark model not configured"}
              {system?.containerEngine ? " · " + system.containerEngine : ""}
            </span>
          </div>
        </aside>

        <main className="main">
          {!system?.arkConfigured || !system?.codexAvailable ? (
            <div className="config-banner">
              <span>{"!"}</span>
              <div>
                <strong>{"Runtime configuration needed"}</strong>
                <p>
                  {!system?.arkConfigured
                    ? "Set ARK_API_KEY and ARK_MODEL in .env before using the Playground."
                    : system.runtimeProvider === "container"
                      ? "The local container engine or Agent Runtime image is unavailable. Rerun npm run poc."
                      : "Codex CLI was not found. Use the Docker image or install @openai/codex."}
                </p>
              </div>
            </div>
          ) : null}

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError(null)}>{"×"}</button>
            </div>
          )}

          {selected ? (
            <>
              <header className="agent-header">
                <div>
                  <div className="header-title-row">
                    <h1>{selected.name}</h1>
                    <StatusPill status={selected.status} />
                  </div>
                  <p>
                    {selected.description ||
                      "A Codex coding Agent in an isolated workspace."}
                    {" · "}
                    {ROLE_OPTIONS.find((role) => role.value === selected.role)?.label ?? selected.role}
                  </p>
                </div>
                <div className="header-actions">
                  <button
                    className="button button-ghost"
                    onClick={() => setShowSettings((value) => !value)}
                    disabled={busy || selected.status === "busy"}
                  >
                    {"Settings\r"}
                  </button>
                  <button
                    className="button button-ghost"
                    onClick={toggleAgent}
                    disabled={busy}
                  >
                    {selected.status === "stopped" ? "Start" : "Stop"}
                  </button>
                  <button
                    className="button button-danger"
                    onClick={deleteAgent}
                    disabled={busy || selected.status === "busy"}
                  >
                    {"Delete\r"}
                  </button>
                </div>
              </header>

              {showSettings && (
                <form className="settings-panel" onSubmit={saveAgent}>
                  <div className="settings-title">
                    <div>
                      <span className="eyebrow">{"Agent configuration"}</span>
                      <h2>{"Instructions and identity"}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                    >
                      {"×\r"}
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      {"Name\r"}
                      <input
                        value={form.name}
                        onChange={(event) =>
                          setForm({ ...form, name: event.target.value })
                        }
                        required
                        maxLength={80}
                      />
                    </label>
                    <label>
                      {"Description\r"}
                      <input
                        value={form.description}
                        onChange={(event) =>
                          setForm({ ...form, description: event.target.value })
                        }
                        maxLength={500}
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={form.role}
                        onChange={(event) =>
                          setForm({ ...form, role: event.target.value as AgentRole })
                        }
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    {"System instructions\r"}
                    <textarea
                      value={form.instructions}
                      onChange={(event) =>
                        setForm({ ...form, instructions: event.target.value })
                      }
                      rows={5}
                      maxLength={10_000}
                    />
                  </label>
                  <div className="panel-footer">
                    <code>{selected.workspacePath}</code>
                    <button className="button button-primary" disabled={busy}>
                      {busy ? <Spinner /> : "Save changes"}
                    </button>
                  </div>
                </form>
              )}

              <section className="playground">
                <div className="playground-topbar">
                  <div>
                    <span className="eyebrow">{"Playground"}</span>
                    <h2>{"Build something with your Agent"}</h2>
                  </div>
                  <div className="session-info">
                    <span className="pulse" />
                    {selected.codexThreadId
                      ? "Session connected"
                      : "New session"}
                  </div>
                </div>

                <div className="messages">
                  {messages.length === 0 && !activeRun ? (
                    <div className="welcome">
                      <div className="welcome-orbit">
                        <div>{"⌁"}</div>
                      </div>
                      <h3>
                        {"What should "}
                        {selected.name}
                        {" build?"}
                      </h3>
                      <p>
                        {
                          "The Agent can inspect files, write code, run commands, and\r"
                        }
                        {"continue the same Codex session across messages.\r"}
                      </p>
                      <div className="prompt-grid">
                        {starterPrompts.map((item) => (
                          <button key={item} onClick={() => setPrompt(item)}>
                            <span>{"↗"}</span>
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isDuplicateCurrentFailure =
                        message.role === "system" &&
                        activeRun?.status === "failed" &&
                        activeRun.id === message.runId;

                      if (isDuplicateCurrentFailure) {
                        return null;
                      }

                      return (
                        <article
                          className={
                            "message " +
                            (message.role === "system"
                              ? "message-system"
                              : "message-" + message.role)
                          }
                          key={message.id}
                        >
                          <div className="message-meta">
                            <strong>
                              {message.role === "user" ? "You" : selected.name}
                            </strong>

                            <span>{formatTime(message.createdAt)}</span>
                          </div>

                          <div className="message-body">{message.content}</div>
                        </article>
                      );
                    })
                  )}
                  {isRunActive && (
                    <article className="message message-assistant thinking">
                      <div className="message-meta">
                        <strong>{selected.name}</strong>
                        <span>{"working in the Agent workspace"}</span>
                      </div>
                      <div className="thinking-row">
                        <Spinner />
                        {"Codex is reading, editing, or running commands…\r"}
                      </div>
                    </article>
                  )}
                  {isPendingApproval && (
                    <PendingApprovalMessage
                      run={activeRun}
                      onApprove={async () => {
                        const { run } = await api.approveRun(activeRun.id, {
                          isApprove: true,
                        });
                        setActiveRun(run);
                        await pollRun(run.id, selected.id);
                      }}
                      onDeny={async () => {
                        const { run } = await api.approveRun(activeRun.id, {
                          isApprove: false,
                        });

                        setActiveRun(run);
                        await refreshMessages(selected.id);
                      }}
                    />
                  )}
                  {immuneDenied && (
                    <article className="run-blocked">
                      <strong>{"🛡 Run blocked by Agent Immune"}</strong>
                      <span>
                        {
                          "Execution was stopped automatically because this Run\r"
                        }
                        {"exceeded the blocking threshold.\r"}
                      </span>
                    </article>
                  )}

                  {immuneNeedsReview && (
                    <article className="run-blocked">
                      <strong>{"⚠ Run held for human review"}</strong>
                      <span>
                        {"This Run is suspicious but not severe enough to\r"}
                        {"auto-block. An operator decision is required.\r"}
                      </span>
                    </article>
                  )}
                  {showFailedMessage && (
                    <FailedMessage
                      run={activeRun}
                      onViewAbilities={() => navigateToView(null, "abilities")}
                    />
                  )}
                  {immuneEvent && (
                    <article className="immune-card">
                      <div className="immune-card-head">
                        <div>
                          <span className="eyebrow">{"Agent Immune"}</span>
                          <strong>
                            {immuneEvent.learnedMatch
                              ? "Immune Memory matched"
                              : "Threat intercepted"}
                          </strong>
                        </div>
                        <span className="immune-score">
                          {immuneEvent.score}
                          {"/100\r"}
                        </span>
                        <div className="immune-score-explanation">
                          {/* <div className="immune-score-title">
                          <strong>Why this score?</strong>
                        </div>

                        {immuneEvent.learnedMatch && (
                          <div className="immune-learning-summary">
                            <span>
                              Static risk
                              <strong>{immuneEvent.baseScore ?? immuneEvent.score}/100</strong>
                            </span>

                            <span>
                              Immune Memory
                              <strong>
                                +<strong>+{immuneEvent.memoryAdjustment ?? 0}</strong>
                              </strong>
                            </span>

                            <span>
                              Final risk
                              <strong>{immuneEvent.score}/100</strong>
                            </span>
                          </div>
                        )} */}

                          {(immuneEvent.scoreBreakdown ?? []).map((signal) => (
                            <div
                              className="immune-score-row"
                              key={signal.label}
                            >
                              <span>{signal.label}</span>
                              <strong>{signal.score > 0 ? `+${signal.score}` : signal.score}</strong>
                            </div>
                          ))}

                          <div className="immune-score-row immune-score-total">
                            <span>{"Final risk"}</span>
                            <strong>
                              {immuneEvent.score}
                              {"/100"}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <div className="immune-tags">
                        {immuneEvent.categories.map((category) => (
                          <span key={category}>
                            {category.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                      <ul>
                        {immuneEvent.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                      {immuneEvent.learnedMatch && (
                        <div className="immune-match-box">
                          <strong>{"🛡 Immune Memory Match"}</strong>
                          <span>
                            {"This Run matched a previously confirmed threat\r"}
                            {"pattern.\r"}
                          </span>
                        </div>
                      )}
                      {/* REVIEW: human decision is required */}
                      {immuneEvent.reviewStatus === "pending" &&
                        immuneEvent.decision === "review" && (
                          <div className="immune-review-waiting">
                            <strong>⚠ Administrator review required</strong>

                            <span>
                              This Run has been paused. Alice cannot approve her own
                              sensitive action.
                            </span>

                            <span>
                              Waiting for Tom (Administrator) to approve or reject
                              this request in the Admin Center.
                            </span>

                            <button
                              className="button button-primary"
                              onClick={() => setShowAdminCenter(true)}
                            >
                              Open Admin Center
                            </button>
                          </div>
                      )}

                      {/* DENY: already blocked automatically */}
                      {immuneEvent.decision === "deny" && (
                        <div className="immune-reviewed">
                          {
                            "🛡 Automatically blocked — no human approval required\r"
                          }
                        </div>
                      )}

                      {/* Completed human review */}
                      {immuneEvent.decision === "review" &&
                        immuneEvent.reviewStatus !== "pending" && (
                          <div className="immune-reviewed">
                            {immuneEvent.reviewStatus === "confirmed"
                              ? "✓ Threat confirmed and added to Immune Memory"
                              : "✓ Approved by operator"}
                          </div>
                        )}
                    </article>
                  )}

                  <div ref={messageEnd} />
                </div>

                <form className="composer" onSubmit={sendMessage}>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (activeRun?.status === "pending_approval") {
                          toast.warn("Your previous message is still pending");
                          return;
                        }
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={
                      selected.status === "stopped"
                        ? "Start this Agent to continue…"
                        : "Describe what you want the Agent to do…"
                    }
                    disabled={
                      selected.status === "stopped" ||
                      selected.status === "busy" ||
                      (activeRun != null &&
                        ["queued", "running"].includes(activeRun.status))
                    }
                    rows={3}
                  />
                  <div className="composer-footer">
                    <span>
                      {"Enter to send · Shift + Enter for newline ·"}{" "}
                      {system?.codexSandboxMode ?? "checking sandbox"}
                    </span>
                    <button
                      className="send-button"
                      disabled={
                        !prompt.trim() ||
                        selected.status === "stopped" ||
                        selected.status === "busy" ||
                        (activeRun != null &&
                          ["queued", "running", "pending_approval"].includes(
                            activeRun.status,
                          ))
                      }
                      aria-label="Send message"
                    >
                      {"↑\r"}
                    </button>
                  </div>
                </form>
              </section>
            </>
          ) : view === "abilities" ? (
            <AbilitiesView
              onSelectAgent={(agentId) => {
                navigateToView(agentId, "playground");
              }}
              agents={agents}
              abilities={defaultAbilities}
              onUpdate={updateAbilities}
              saving={savingAbilities}
            />
          ) : view === "admin" ? (
            <AdminApprovalCenter agents={agents} />
        
          ) : view === "audit" ? (
            <AuditView agents={agents} />
          ) : view === "dashboard" ? (
            <Dashboard />
          ) : (
            <div className="no-agent">
              <div className="no-agent-art">{"A"}</div>
              <span className="eyebrow">{"Agent Launchpad"}</span>
              <h1>{"Your runtime is ready for an Agent."}</h1>
              <p>
                {"Create a workspace, give Codex a job, and continue the\r"}
                {"conversation here.\r"}
              </p>
              <button
                className="button button-primary"
                onClick={() => {
                  setForm(emptyForm);
                  setShowCreate(true);
                }}
              >
                {"Create your first Agent\r"}
              </button>
            </div>
          )}
        </main>

        {showCreate && (
          <div
            className="modal-backdrop"
            onMouseDown={() => setShowCreate(false)}
          >
            <form
              className="modal"
              onSubmit={createAgent}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">{"New workspace"}</span>
                  <h2>{"Create an Agent"}</h2>
                  <p>
                    {
                      "Each Agent gets a persistent folder and a resumable Codex\r"
                    }
                    {"session.\r"}
                  </p>
                </div>
                <button type="button" onClick={() => setShowCreate(false)}>
                  {"×\r"}
                </button>
              </div>
              <label>
                {"Name\r"}
                <input
                  autoFocus
                  placeholder="Frontend Builder"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                  maxLength={80}
                />
              </label>
              <label>
                {"Description\r"}
                <input
                  placeholder="Builds polished React prototypes"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  maxLength={500}
                />
              </label>
              <label>
                Role
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value as AgentRole })
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {"Instructions\r"}
                <textarea
                  value={form.instructions}
                  onChange={(event) =>
                    setForm({ ...form, instructions: event.target.value })
                  }
                  rows={6}
                  maxLength={10_000}
                />
              </label>
              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowCreate(false)}
                >
                  {"Cancel\r"}
                </button>
                <button className="button button-primary" disabled={busy}>
                  {busy ? <Spinner /> : "Create Agent"}
                </button>
              </div>
            </form>
          </div>
        )}
        {showGroupTask && (
          <GroupTaskPanel
            agents={agents}
            onClose={() => setShowGroupTask(false)}
          />
        )}
        <ToastContainer />
      </div>
    </>
  );
}
