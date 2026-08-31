import {
  Checkbox,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { makeStyles } from "@mui/styles";

import { Ability } from "../types/abilities";

import Loading from "./Loading";

import type { Agent } from "../types";
import "../styles/abilities.css";

interface AbilityMeta {
  key: Ability;
  label: string;
  risk: "low" | "medium" | "high" | "critical";
}

interface AbilitiesTableProps {
  agents: Agent[];
  abilities: AbilityMeta[];
  onUpdate: (agentId: string, ability: Ability, next: boolean) => void;
  saving: Record<string, boolean>;
  onSelectAgent: (agentId: string) => void;
}

function riskColour(risk: AbilityMeta["risk"]) {
  switch (risk) {
    case "low":
      return "rgb(46, 125, 50)";
    case "medium":
      return "rgb(237, 108, 2)";
    case "high":
      return "rgb(211, 47, 47)";
    case "critical":
      return "#b02727";
  }
}

const useStyles = makeStyles(() => ({
  container: {
    borderRadius: "17px",
    overflowX: "auto",
    overflowY: "hidden",
  },
  table: {
    minWidth: 850,
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

export function AbilitiesTable({
  agents,
  abilities,
  onUpdate,
  saving,
  onSelectAgent,
}: AbilitiesTableProps) {
  const classes = useStyles();
  const sortedAgents = [...agents].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  return (
    <div>
      <h2>{"Abilities"}</h2>
      <TableContainer
        component={Paper}
        variant="outlined"
        className={classes.container}
      >
        <Table className={`abilities-table ${classes.table}`}>
          <TableHead className="abilities-table-head">
            <TableRow>
              <TableCell className="abilities-table-cell abilities-sticky-column">
                <p className="p-0" style={{ color: "rgba(79, 79, 79, 0.87)" }}>
                  {"Agents\r"}
                </p>
              </TableCell>
              {abilities.map((item) => (
                <TableCell key={item.key} className="abilities-table-cell">
                  <div>
                    {item.label}
                    <Chip
                      label={item.risk}
                      sx={{
                        color: "white",
                        backgroundColor: riskColour(item.risk),
                      }}
                      size="small"
                      className={classes.chip}
                    />
                  </div>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody className="abilities-table-body">
            {sortedAgents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell className="abilities-table-cell abilities-sticky-column">
                  <p
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                    className="m-0"
                    onClick={() => onSelectAgent(agent.id)}
                  >
                    {agent.name}
                  </p>
                </TableCell>
                {abilities.map((ability) => {
                  const cellKey = agent.id + ":" + ability.key;
                  const checked = agent.abilities?.[ability.key] ?? false;
                  const isSaving = saving[cellKey] ?? false;
                  return (
                    <TableCell key={ability.key}>
                      <Checkbox
                        checked={checked}
                        disabled={isSaving}
                        onChange={() =>
                          onUpdate(agent.id, ability.key, !checked)
                        }
                      />
                      {isSaving && <Loading />}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {agents.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={abilities.length + 1}
                  className="abilities-table-cell"
                >
                  {"No agents yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
