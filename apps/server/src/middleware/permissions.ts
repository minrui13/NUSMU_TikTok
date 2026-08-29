export type Ability =
  | "canReadWorkspace"
  | "canWriteWorkspace"
  | "canRunCommand"
  | "canAccessSecrets"
  | "canUseNetwork";

// Defining abilities
export const defaultAbilities = [
  {
    name: "canReadWorkspace",
    displayName: "Read workspace files",
    risk: "low",
  },
  {
    name: "canWriteWorkspace",
    displayName: "Write workspace files",
    risk: "medium",
  },
  {
    name: "canRunCommand",
    displayName: "Run shell commands",
    risk: "high",
  },
  {
    name: "canAccessSecrets",
    displayName: "Access secrets",
    risk: "critical",
  },
];

// Actual policies by the above defined abilities
export const defaultAgentAbilities: Record<Ability, boolean> = {
  canReadWorkspace: true,
  canWriteWorkspace: true,
  canRunCommand: false,
  canAccessSecrets: false,
  canUseNetwork: false,
};
