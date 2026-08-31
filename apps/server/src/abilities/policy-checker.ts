import { Ability, Risk } from "../types/abilities.js";

import { abilityRisk } from "./permissions.js";

// Human-readable labels for each ability, so reasons shown to a user
// never surface the raw camelCase identifier (e.g. "canReadWorkspace").
export const abilityLabel: Record<Ability, string> = {
  canReadWorkspace: "Read workspace files",
  canWriteWorkspace: "Write workspace files",
  canRunCommand: "Run commands",
  canAccessSecrets: "Access secrets",
  canUseNetwork: "Use network",
  canJoinSession: "Join shared sessions",
};

export type Decision = "allowed" | "denied" | "pending_approval";

export interface PolicyResult {
  ability: Ability;
  risk: Risk;
  decision: Decision;
  reason: string;
}

// Maps over required abilities and checks each against the list of granted abilities
export function evaluateAction(
  requiredAbilities: Ability[],
  grantedAbilities: Ability[],
): PolicyResult[] {
  return requiredAbilities.map((ability) =>
    checkAbility(ability, grantedAbilities),
  );
}

// This is a risk-based policy checker
// Granted low/medium-risk abilities are allowed; granted high/critical-risk
// abilities require approval. Any missing ability is denied.
export function checkAbility(
  ability: Ability,
  grantedAbilities: Ability[],
): PolicyResult {
  const risk = abilityRisk[ability];
  const granted = grantedAbilities.includes(ability);
  const label = abilityLabel[ability];

  if (granted && (risk === "low" || risk === "medium")) {
    return {
      ability,
      risk,
      decision: "allowed",
      reason: `${label} is granted`,
    };
  }

  if (granted && (risk === "high" || risk === "critical")) {
    return {
      ability,
      risk,
      decision: "pending_approval",
      reason: `${label} (${risk} risk) requires human approval`,
    };
  }
  return {
    ability,
    risk,
    decision: "denied",
    reason: granted
      ? `${label} (${risk} risk) is not permitted`
      : `${label} is not granted to this Agent`,
  };
}

// Determine if the agent can do the action with the overall granted abilities
export function overallDecision(results: PolicyResult[]): Decision {
  if (results.some((result) => result.decision === "denied")) {
    return "denied";
  }

  if (results.some((result) => result.decision === "pending_approval")) {
    return "pending_approval";
  }

  return "allowed";
}
