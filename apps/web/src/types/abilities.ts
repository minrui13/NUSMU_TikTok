
export const defaultAbilities: {
  key: Ability;
  label: string;
  risk: "low" | "medium" | "high" | "critical";
}[] = [
  { key: "canReadWorkspace", label: "Read", risk: "low" },
  { key: "canWriteWorkspace", label: "Write", risk: "medium" },
  { key: "canRunCommand", label: "Run commands", risk: "high" },
  { key: "canAccessSecrets", label: "Secrets", risk: "critical" },
  { key: "canUseNetwork", label: "Network", risk: "high" },
  { key: "canJoinSession", label: "Join sessions", risk: "medium" },
];

export type Ability =
  | "canReadWorkspace"
  | "canWriteWorkspace"
  | "canRunCommand"
  | "canAccessSecrets"
  | "canUseNetwork"
  | "canJoinSession";

export type AbilityBody = Partial<Record<Ability, boolean>>;
