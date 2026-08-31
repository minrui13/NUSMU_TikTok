import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import "../../styles/toasts.css";
import CloseIcon from "@mui/icons-material/Close";

import { AgentRun } from "../../types";

interface Props {
  run: AgentRun;
  agentName: string;
  onDismiss: () => void;
  navigateToView: () => void;
}

export function AllowedToast({
  run,
  agentName,
  onDismiss,
  navigateToView,
}: Props) {
  const output = run.output ?? "(no output)";
  return (
    <div
      className="prompt-status-toast"
      role="alert"
      onClick={navigateToView}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          navigateToView();
        }
      }}
      tabIndex={0}
    >
      <div className="prompt-status-toast-header">
        <div className="prompt-status-toast-header-left">
          <div className="prompt-status-toast-icon">
            <CheckCircleIcon color="success" />
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
      <div className="prompt-status-toast-body approve">
        <p className="mt-0">
          {output.slice(0, 80)}
          {output.length > 80 ? "..." : ""}
        </p>
      </div>
    </div>
  );
}
