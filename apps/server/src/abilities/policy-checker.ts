import { Ability, Risk } from "../types/abilities.js";

import { abilityRisk } from "./permissions.js";

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

  if (granted && (risk === "low" || risk === "medium")) {
    return {
      ability,
      risk,
      decision: "allowed",
      reason: `${ability} is granted`,
    };
  }

  if (granted && (risk === "high" || risk === "critical")) {
    return {
      ability,
      risk,
      decision: "pending_approval",
      reason: `${ability} (${risk} risk) requires human approval`,
    };
  }
  return {
    ability,
    risk,
    decision: "denied",
    reason: granted
      ? `${ability} (${risk} risk) is not permitted` // Should not happen given the logic above, but just in case
      : `${ability} is not granted to this Agent`,
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
