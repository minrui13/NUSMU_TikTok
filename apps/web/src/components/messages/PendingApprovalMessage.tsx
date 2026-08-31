import { formatTime } from "../../App";
import { AgentRun } from "../../types";
import "../../styles/messages.css";

export function PendingApprovalMessage({
  run,
  onApprove,
  onDeny,
}: {
  run: AgentRun;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <article className="message message-assistant pending-approval-message">
      <div className="message-meta pending">
        <strong className="message-label pending">{"Approval needed"}</strong>
        <span>{formatTime(run.createdAt)}</span>
      </div>
      <div className="pending-approval-note">
        <span>Prompt has {run.risk} risk:</span>
      </div>
      <div className="message-body">
        <p>
          {'"'}
          {run.prompt}
          {'"'}
        </p>
      </div>
      <div className="message-actions pending">
        <button className="button button-primary" onClick={onApprove}>
          {"Approve\r"}
        </button>
        <button className="button button-danger" onClick={onDeny}>
          {"Deny\r"}
        </button>
      </div>
    </article>
  );
}
