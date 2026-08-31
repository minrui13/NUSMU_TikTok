import { useMemo, useState } from "react";
import type { AuditEvent } from "../types/audits";

export interface AuditFilters {
  decision: string; // "all" | AuditDecision
  risk: string; // "all" | Risk
  agentId: string; // "all" | agent id
  userQuery: string; // any that matched against userId
}

const defaultFilters: AuditFilters = {
  decision: "all",
  risk: "all",
  agentId: "all",
  userQuery: "",
};

export function useAuditFilters(events: AuditEvent[]) {
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filters.decision !== "all" && e.decision !== filters.decision)
        return false;
      if (filters.risk !== "all" && e.risk !== filters.risk) return false;
      if (filters.agentId !== "all" && e.agentId !== filters.agentId)
        return false;
      if (
        filters.userQuery &&
        !e.userId.toLowerCase().includes(filters.userQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [events, filters]);

  const resetFilters = () => setFilters(defaultFilters);

  return { filters, setFilters, filtered, resetFilters };
}
