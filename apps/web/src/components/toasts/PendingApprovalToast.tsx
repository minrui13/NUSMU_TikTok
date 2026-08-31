import WarningIcon from "@mui/icons-material/Warning";

import "../../styles/toasts.css";
import { AuditEvent } from "../../types/audits";

interface Props {
  run: AuditEvent;
  agentName: String;
  onDismiss: () => void;
  onReview: () => void;
}

export function PendingApprovalToast({
  run,
  agentName,
  onDismiss,
  onReview,
}: Props) {
  return (
    <div
      className="prompt-status-toast"
      role="alert"
      onClick={onReview}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onReview();
        }
      }}
      tabIndex={0}
    >
      <div className="prompt-status-toast-header">
        <div className="prompt-status-toast-icon">
          <WarningIcon color="error" />
        </div>
        <strong>{agentName}</strong>
      </div>
      <div className="prompt-status-toast-body pending">
        <p className="action">
          <strong>{"Approval needed"}</strong>
        </p>
        {run.prompt && (
          <p className="mt-0">
            {run.prompt.slice(0, 80)}
            {run.prompt.length > 80 ? "..." : ""}
          </p>
        )}
      </div>
      <div className="prompt-status-toast-actions pending">
        <button
          type="button"
          className="button button-primary"
          onClick={(event) => {
            event.stopPropagation();
            onReview();
          }}
        >
          {"Review Action\r"}
        </button>

        <button
          type="button"
          className="button button-secondary"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          {"Deny Action\r"}
        </button>
      </div>
    </div>
  );
}
