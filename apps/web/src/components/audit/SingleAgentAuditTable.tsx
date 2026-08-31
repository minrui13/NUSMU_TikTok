import { useEffect, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import { api } from "../../api";
import type { AuditEvent } from "../../types/audits";
import { Agent } from "../../types";

import { makeStyles } from "@mui/styles";
import { riskColour } from "../AbilitiesView";
import { TablePagination } from "@mui/material";
import { usePagination } from "../../hooks/usePagination";
import "../../styles/audit.css";
import { formatTime } from "../../App";
import { AuditFilterBar } from "./AuditFilterBar";
import { useAuditFilters } from "../../hooks/useAuditFilters";

const useStyles = makeStyles(() => ({
  container: {
    borderRadius: "17px",
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

export function SingleAgentAuditTable({ agents }: Props) {
  const classes = useStyles();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const { filters, setFilters, filtered, resetFilters } =
    useAuditFilters(events);
  const {
    paged,
    page,
    rowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,
  } = usePagination(filtered);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const { events } = await api.allAuditEvents();
        if (!cancelled) setEvents(events);
      } finally {
        if (!cancelled) setLoading(false);
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

  if (loading) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
      >
        <CircularProgress size={28} />
      </div>
    );
  }

  return (
    <>
      <AuditFilterBar
        filters={filters}
        setFilters={setFilters}
        onReset={resetFilters}
        agents={agents}
      />
      <TableContainer
        component={Paper}
        className={`audit-log-table ${classes.container}`}
      >
        <Table
          size="small"
          stickyHeader
          className={`audit-log-table single ${classes.table}`}
        >
          <TableHead className="audit-log-table-head single">
            <TableRow className="audit-log-table-row">
              <TableCell className="audit-log-table-cell single">
                Time
              </TableCell>
              <TableCell className="audit-log-table-cell single">
                Agent
              </TableCell>
              <TableCell className="audit-log-table-cell single">
                User
              </TableCell>
              <TableCell className="audit-log-table-cell single">
                Action
              </TableCell>
              <TableCell className="audit-log-table-cell single">
                Risk
              </TableCell>
              <TableCell className="audit-log-table-cell single">
                Decision
              </TableCell>
              <TableCell className="audit-log-table-cell single">
                Reason
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody className="audit-log-table-body">
            {paged.length === 0 && (
              <TableRow>
                <TableCell
                  className="audit-log-table-cell single"
                  colSpan={7}
                  align="center"
                >
                  No audit events yet.
                </TableCell>
              </TableRow>
            )}
            {paged.map((event) => (
              <TableRow key={event.id} hover>
                <TableCell className="audit-log-table-cell single">
                  {formatTime(event.createdAt)}
                </TableCell>
                <TableCell className="audit-log-table-cell single">
                  {agentName(event.agentId)}
                </TableCell>
                <TableCell className="audit-log-table-cell single">
                  {event.userId}
                </TableCell>
                <TableCell className="audit-log-table-cell single">
                  {event.action}
                </TableCell>
                <TableCell className="audit-log-table-cell single">
                  {event.risk ? (
                    <Chip
                      label={event.risk}
                      sx={{
                        color: "white",
                        backgroundColor: riskColour(event.risk),
                      }}
                      size="small"
                      className={classes.chip}
                    />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="audit-log-table-cell single">
                  <Chip
                    label={event.decision.replace("_", " ")}
                    size="small"
                    color={decisionColor[event.decision] ?? "default"}
                  />
                </TableCell>
                <TableCell className="audit-log-table-cell single">
                  {event.reason ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>
    </>
  );
}
