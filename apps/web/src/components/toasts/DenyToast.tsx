import CloseIcon from "@mui/icons-material/Close";
import DoDisturbIcon from "@mui/icons-material/DoDisturb";

import "../../styles/toasts.css";
import { View } from "../../types";
import { AuditEvent } from "../../types/audits";

interface Props {
  run: AuditEvent;
  agentName: string;
  onDismiss: () => void;
  navigateToView: (agentId: string | null, view: View) => void;
}
export function DenyToast({
  run,
  agentName,
  onDismiss,
  navigateToView,
}: Props) {
  return (
    <div
      className="prompt-status-toast"
      role="alert"
      onClick={() => navigateToView(run.agentId, "playground")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          navigateToView(run.agentId, "playground");
        }
      }}
      tabIndex={0}
    >
      <div className="prompt-status-toast-header">
        <div className="prompt-status-toast-header-left">
          <div className="prompt-status-toast-icon">
            <DoDisturbIcon color="warning" />
          </div>
          <strong>{agentName}</strong>
        </div>
        <div className="prompt-status-toast-close-btn">
          <button
            type="button"
            className="button toast-dismiss"
            onClick={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
            aria-label="Dismiss notification"
          >
            <CloseIcon
              sx={{
                color: "rgba(0, 0, 0, 0.2)",
                "&:hover": { color: "rgba(0, 0, 0, 0.5)" },
              }}
            />
          </button>
        </div>
      </div>
      <div className="prompt-status-toast-body deny">
        <div>
          <p className="action mb-2">
            <strong>{"Actions Denied:"}</strong>
          </p>
          {run.reason && <p className="toast-reason">{run.reason}</p>}
        </div>
        <div className="toast-metadata">
          <strong>{"Required ability:"}</strong>
          <div>
            <code>{run.action}</code>
          </div>
        </div>
        <div className="prompt-status-toast-actions deny">
          <button
            type="button"
            className="button button-primary"
            onClick={(event) => {
              event.stopPropagation();
              navigateToView(null, "abilities");
            }}
          >
            {"Review Agent abilities\r"}
          </button>
        </div>
      </div>
    </div>
  );
}
