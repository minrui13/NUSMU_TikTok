import { useEffect, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import { api } from "../../api";
import { Agent } from "../../types";
import { AuditEvent } from "../../types/audits";
import { usePagination } from "../../hooks/usePagination";
import { TablePagination } from "@mui/material";
import { makeStyles } from "@mui/styles";
import "../../styles/audit.css";
import { formatTime } from "../../App";
import { useAuditFilters } from "../../hooks/useAuditFilters";
import { AuditFilterBar } from "./AuditFilterBar";

const useStyles = makeStyles(() => ({
  container: {
    borderRadius: "17px !important",
  },
  table: {
    "& .MuiTableCell-root": {
      border: "1px solid rgba(0, 0, 0, 0.04)",
    },
  },
  chip: {
    ml: 1,
    textTransform: "capitalize",
    fontSize: "0.8rem",
  },
}));

interface Props {
  agents: Agent[];
}

const decisionColor: Record<
  string,
  "success" | "warning" | "error" | "default"
> = {
  allowed: "success",
  pending_approval: "warning",
  denied: "error",
};

export function GroupTaskAuditTable({ agents }: Props) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const classes = useStyles();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { events } = await api.allAuditEvents();
      if (!cancelled) {
        // filter to events that belong to a coordination session
        setEvents(events.filter((e) => e.sessionId !== null));
      }
    };
    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const agentName = (agentId: string) =>
    agents.find((a) => a.id === agentId)?.name ?? agentId.slice(0, 8);

  const { filters, setFilters, filtered, resetFilters } = useAuditFilters(
    events.filter((e) => e.sessionId !== null), // your existing session filter, applied first
  );
  const sessions = Array.from(new Set(filtered.map((e) => e.sessionId)));
  const {
    paged: pagedSessions,
    page,
    rowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,
  } = usePagination(sessions, 5);

  return (
    <div className="group-task-audit-log">
      <AuditFilterBar
        filters={filters}
        setFilters={setFilters}
        onReset={resetFilters}
        agents={agents}
      />{" "}
      {sessions.length === 0 && (
        <p>No group tasks coordination sessions yet.</p>
      )}
      {pagedSessions.map((sessionId) => (
        <TableContainer
          className={`audit-log-table ${classes.container}`}
          key={sessionId}
          component={Paper}
          style={{ marginBottom: "1.5rem" }}
        >
          <div className="audit-log-table-label group">
            Session: {sessionId?.slice(0, 8)}
          </div>
          <Table
            size="small"
            className={`audit-log-table group ${classes.table}`}
          >
            <TableHead className="audit-log-table-head group">
              <TableRow className="audit-log-table-row">
                <TableCell className="audit-log-table-cell">Time</TableCell>
                <TableCell className="audit-log-table-cell">Agent</TableCell>
                <TableCell className="audit-log-table-cell">Action</TableCell>
                <TableCell className="audit-log-table-cell">Decision</TableCell>
                <TableCell className="audit-log-table-cell">Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events
                .filter((e) => e.sessionId === sessionId)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((event) => (
                  <TableRow className="audit-log-table-row" key={event.id}>
                    <TableCell className="audit-log-table-cell">
                      {formatTime(event.createdAt)}
                    </TableCell>
                    <TableCell className="audit-log-table-cell">
                      {agentName(event.agentId)}
                    </TableCell>
                    <TableCell className="audit-log-table-cell">
                      {event.action}
                    </TableCell>
                    <TableCell className="audit-log-table-cell">
                      <Chip
                        label={event.decision.replace("_", " ")}
                        size="small"
                        color={decisionColor[event.decision] ?? "default"}
                      />
                    </TableCell>
                    <TableCell className="audit-log-table-cell">
                      {event.reason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      ))}{" "}
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 20]}
      />
    </div>
  );
}
