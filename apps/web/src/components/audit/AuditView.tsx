import { useState } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { Agent } from "../../types";
import { SingleAgentAuditTable } from "./SingleAgentAuditTable";
import { GroupTaskAuditTable } from "./GroupTaskAuditTable";
import "../../styles/audit.css";

interface Props {
  agents: Agent[];
}

export function AuditView({ agents }: Props) {
  const [tab, setTab] = useState<"single" | "group">("single");

  return (
    <div className="audit-view">
      <h2>{"Audit Log"}</h2>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        className="audit-view-tabs"
        sx={{
          "& .MuiTab-root": {
            fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
            letterSpacing: "-0.035em",
            paddingBottom: "8px",
            fontSize: 16,
          },
          "& .MuiTab-root:not(.Mui-selected)": {
            color: "#0505053d !important",
            fontWeight: 500,
          },
          "& .Mui-selected": {
            color: "#6b56db !important",
            fontWeight: 600,
          },
          "& .MuiTabs-indicator": {
            backgroundColor: "#6b56db !important",
          },
        }}
      >
        <Tab label="Single Task Log" value="single" />
        <Tab label="Group Task Log" value="group" />
      </Tabs>
      {tab === "single" && <SingleAgentAuditTable agents={agents} />}
      {tab === "group" && <GroupTaskAuditTable agents={agents} />}
    </div>
  );
}
