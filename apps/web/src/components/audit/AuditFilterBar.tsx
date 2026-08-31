import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import type { AuditFilters } from "../../hooks/useAuditFilters";
import { Agent } from "../../types";
import "../../styles/audit.css";

interface Props {
  filters: AuditFilters;
  setFilters: React.Dispatch<React.SetStateAction<AuditFilters>>;
  onReset: () => void;
  agents: Agent[];
}

export function AuditFilterBar({
  filters,
  setFilters,
  onReset,
  agents,
}: Props) {
  return (
    <div className="audit-filter-bar">
      <FormControl
        size="small"
        style={{ minWidth: 140 }}
        className="audit-filter-controls"
      >
        <InputLabel>Decision</InputLabel>
        <Select
          label="Decision"
          value={filters.decision}
          onChange={(e) =>
            setFilters((f) => ({ ...f, decision: e.target.value }))
          }
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="allowed">Allowed</MenuItem>
          <MenuItem value="pending_approval">Pending approval</MenuItem>
          <MenuItem value="denied">Denied</MenuItem>
        </Select>
      </FormControl>

      <FormControl
        size="small"
        style={{ minWidth: 120 }}
        className="audit-filter-controls"
      >
        <InputLabel>Risk</InputLabel>
        <Select
          label="Risk"
          value={filters.risk}
          onChange={(e) => setFilters((f) => ({ ...f, risk: e.target.value }))}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
        </Select>
      </FormControl>

      <FormControl
        size="small"
        style={{ minWidth: 160 }}
        className="audit-filter-controls"
      >
        <InputLabel>Agent</InputLabel>
        <Select
          label="Agent"
          value={filters.agentId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, agentId: e.target.value }))
          }
        >
          <MenuItem value="all">All</MenuItem>
          {agents.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        className="audit-filter-controls"
        size="small"
        label="User"
        placeholder="alice, system:coordinator…"
        value={filters.userQuery}
        onChange={(e) =>
          setFilters((f) => ({ ...f, userQuery: e.target.value }))
        }
      />

      <Button onClick={onReset} size="small">
        Clear filters
      </Button>
    </div>
  );
}
