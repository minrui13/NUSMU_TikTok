import { formatTime } from "../../App";
import { AgentRun } from "../../types";
import "../../styles/messages.css";

interface Props {
  onViewAbilities: () => void;
  run: AgentRun;
}

export function FailedMessage({ run, onViewAbilities }: Props) {
  const error = run.error;
  const isPolicyDenied = error?.includes("is not granted");

  if (!isPolicyDenied) {
    return (
      <article className="run-error">
        <strong>{"Run failed"}</strong>
        <span>{run.error}</span>
      </article>
    );
  }

  return (
    <div className="run-policy-denied" role="alert">
      <article className="message message-assistant pending-approval-message">
        <div className="message-meta">
          <strong className="message-label deny">{"Actions Denied"}</strong>
          <span>{formatTime(run.createdAt)}</span>
        </div>
        <div className="message-body">
          <p className="policy-reason">{error}</p>
        </div>
        <div className="message-actions deny">
          <button
            type="button"
            onClick={onViewAbilities}
            className="button button-primary"
          >
            {"Review Agent abilities\r"}
          </button>
        </div>
      </article>
    </div>
  );
}
