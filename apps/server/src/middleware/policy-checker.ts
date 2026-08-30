import { type Ability, type Risk, abilityRisk } from "./permissions.js";

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
// If permission is granted, agent is allowed
// If there is low/medium risk and missing grant, agent is denied
// If there is high/critical risk and missing grant, requires human approval
export function checkAbility(
  ability: Ability,
  grantedAbilities: Ability[],
): PolicyResult {
  const risk = abilityRisk[ability];
  const granted = grantedAbilities.includes(ability);

  if (granted) {
    return {
      ability,
      risk,
      decision: "allowed",
      reason: `${ability} is granted`,
    };
  }

  if (risk === "high" || risk === "critical") {
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
    reason: `${ability} (${risk} risk) is not permitted`,
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
