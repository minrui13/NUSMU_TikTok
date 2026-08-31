import { useEffect, useRef, useState } from "react";
import { Agent, GroupTaskState } from "../types";
import { api, ApiError } from "../api";
import CloseIcon from "@mui/icons-material/Close";
import "../styles/taskpanel.css";
import Loading from "./Loading";

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function GroupTaskPanel({
  agents,
  onClose,
}: {
  agents: Agent[];
  onClose: () => void;
}) {
  const [description, setDescription] = useState("");
  const [task, setTask] = useState<GroupTaskState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const mentionedAgents = agents
    .map((agent) => ({
      agent,
      index: description.toLowerCase().indexOf("@" + agent.name.toLowerCase()),
    }))
    .filter(({ index }) => index !== -1)
    .sort((a, b) => a.index - b.index)
    .map(({ agent }) => agent);

  async function start() {
    setError(null);
    if (mentionedAgents.length < 1) {
      setError(
        "Mention at least one Agent with @name so the group knows who's included.",
      );
      return;
    }
    setBusy(true);
    try {
      const { task: created } = await api.createGroupTask({ description });
      setTask(created);
      pollRef.current = window.setInterval(async () => {
        const { task: latest } = await api.groupTask(created.id);
        setTask(latest);
        if (latest.status !== "running" && pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 1000);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to start group task",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header group-task-panel">
          <h2 className="group-task-panel-title">{"Group Task"}</h2>
          <button
            className="button icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon
              sx={{
                color: "rgba(0, 0, 0, 0.2)",
                "&:hover": { color: "rgba(0, 0, 0, 0.5)" },
              }}
            />
          </button>
        </div>

        {!task && (
          <div className="modal-body">
            <label>
              {"Task description — mention Agents with @name\r"}
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Count off from 10, subtract 1 each turn, no repeats, until you reach 1 @AgentA @AgentB"
              />
            </label>
            <div className="group-task-panel-agents hint">
              <p className="group-task-panel-agents-label">
                Available Agents:{" "}
              </p>
              <div className="group-task-panel-agents-names">
                {agents.map((a) => (
                  <code
                    key={a.id}
                    className={
                      mentionedAgents.some((m) => m.id === a.id)
                        ? "mention-hit"
                        : ""
                    }
                  >
                    {"@"}
                    {a.name}
                  </code>
                ))}
              </div>
            </div>
            {mentionedAgents.length > 0 && (
              <div className="hint">
                {"Participants in order:"}{" "}
                {mentionedAgents.map((a) => a.name).join(" → ")}
              </div>
            )}
            {error && <div className="error-banner">{error}</div>}
            <button
              type="button"
              className="button button-primary group-task-panel-button "
              onClick={start}
              disabled={busy || !description.trim()}
            >
              {busy ? "Starting…" : "Start Group Task"}
            </button>
          </div>
        )}

        {task && (
          <div className="modal-body">
            <div
              className={
                "status status-" +
                (task.status === "running"
                  ? "busy"
                  : task.status === "completed"
                    ? "ready"
                    : "error")
              }
            >
              <span className="status-dot" />
              {task.status}
            </div>
            {task.error && (
              <div className="group-task-panel-error error-banner">
                {task.error}
              </div>
            )}
            <div className="group-task-feed">
              {task.turns.map((turn) => (
                <div key={turn.id} className="group-task-turn">
                  <div className="group-task-turn-details">
                    <strong>{turn.agentName}</strong>
                    <span className="timestamp">
                      {formatTime(turn.createdAt)}
                    </span>
                  </div>
                  <div>{turn.content}</div>
                </div>
              ))}
              {task.turns.length === 0 && task.status === "running" && (
                <div style={{ padding: 15 }}>
                  <Loading />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
