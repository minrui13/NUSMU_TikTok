import { classifyAction } from "./abilities/permissions.js";
import type { Agent, AgentRole } from "./types.js";
import type { Ability } from "./types/abilities.js";
import type { AuditEvent } from "./types/audits.js";

export const AGENT_ROLES: AgentRole[] = [
  "frontend_developer",
  "backend_developer",
  "fullstack_developer",
  "marketing",
  "admin",
];

export const ROLE_LABELS: Record<AgentRole, string> = {
  frontend_developer: "Frontend Developer",
  backend_developer: "Backend Developer",
  fullstack_developer: "Fullstack Developer",
  marketing: "Marketing",
  admin: "Administrator",
};

function roleFamily(role: AgentRole): "developer" | "marketing" | "admin" {
  if (
    ["frontend_developer", "backend_developer", "fullstack_developer"].includes(
      role,
    )
  ) {
    return "developer";
  }
  return role === "marketing" ? "marketing" : "admin";
}

const BASE_ROLE_ADJUSTMENT: Record<
  AgentRole,
  Partial<Record<Ability, number>>
> = {
  frontend_developer: {
    canAccessSecrets: -8,
    canRunCommand: -5,
    canUseNetwork: -3,
  },
  backend_developer: {
    canAccessSecrets: -10,
    canRunCommand: -8,
    canUseNetwork: -5,
  },
  fullstack_developer: {
    canAccessSecrets: -10,
    canRunCommand: -8,
    canUseNetwork: -5,
  },
  marketing: { canAccessSecrets: 22, canRunCommand: 12, canUseNetwork: 3 },
  admin: { canAccessSecrets: -15, canRunCommand: -10, canUseNetwork: -8 },
};

export interface AdaptiveTrustEvidence {
  adjustment: number;
  reasons: string[];
  personalApprovals: number;
  personalDenials: number;
  roleApprovals: number;
  roleDenials: number;
  familyApprovals: number;
  familyDenials: number;
  distinctRoleApprovedAgents: number;
  distinctRoleDeniedAgents: number;

  rolePattern: "allow" | "block" | "mixed" | "learning";
}

function auditTouchesAbility(event: AuditEvent, ability: Ability): boolean {
  if (!event.prompt) return false;
  return classifyAction(event.prompt).includes(ability);
}

export function calculateAdaptiveTrust(input: {
  agent: Agent;
  ability: Ability;
  agents: Agent[];
  auditEvents: AuditEvent[];
}): AdaptiveTrustEvidence {
  const { agent, ability, agents, auditEvents } = input;
  const reasons: string[] = [];
  let adjustment = BASE_ROLE_ADJUSTMENT[agent.role]?.[ability] ?? 0;

  if (adjustment !== 0) {
    reasons.push(
      `${ROLE_LABELS[agent.role]} baseline ${adjustment > 0 ? "+" : ""}${adjustment}`,
    );
  }

  const agentRoleById = new Map(
    agents.map((item) => [item.id, item.role] as const),
  );
  const relevant = auditEvents.filter(
    (event) =>
      (event.action === "approve_run" || event.action === "deny_run") &&
      auditTouchesAbility(event, ability),
  );

  const personal = relevant.filter((event) => event.agentId === agent.id);
  const sameRole = relevant.filter(
    (event) => agentRoleById.get(event.agentId) === agent.role,
  );
  const approvedRoleAgentIds = new Set(
    sameRole
      .filter((event) => event.decision === "allowed")
      .map((event) => event.agentId),
  );

  const deniedRoleAgentIds = new Set(
    sameRole
      .filter((event) => event.decision === "denied")
      .map((event) => event.agentId),
  );

  const distinctRoleApprovedAgents = approvedRoleAgentIds.size;
  const distinctRoleDeniedAgents = deniedRoleAgentIds.size;
  let rolePattern: AdaptiveTrustEvidence["rolePattern"] = "learning";

  if (distinctRoleApprovedAgents >= 2 && distinctRoleDeniedAgents === 0) {
    rolePattern = "allow";
  } else if (
    distinctRoleDeniedAgents >= 3 &&
    distinctRoleApprovedAgents === 0
  ) {
    rolePattern = "block";
  } else if (distinctRoleApprovedAgents > 0 && distinctRoleDeniedAgents > 0) {
    rolePattern = "mixed";
  }

  const sameFamily = relevant.filter((event) => {
    const role = agentRoleById.get(event.agentId);
    return role ? roleFamily(role) === roleFamily(agent.role) : false;
  });

  const count = (events: AuditEvent[], decision: "allowed" | "denied") =>
    events.filter((event) => event.decision === decision).length;

  const personalApprovals = count(personal, "allowed");
  const personalDenials = count(personal, "denied");
  const roleApprovals = count(sameRole, "allowed");
  const roleDenials = count(sameRole, "denied");
  const familyApprovals = count(sameFamily, "allowed");
  const familyDenials = count(sameFamily, "denied");

  const personalAdjustment = Math.max(
    -24,
    Math.min(28, personalDenials * 14 - personalApprovals * 12),
  );
  if (personalAdjustment !== 0) {
    adjustment += personalAdjustment;
    reasons.push(
      `Agent history ${personalAdjustment > 0 ? "+" : ""}${personalAdjustment} (${personalApprovals} approved / ${personalDenials} denied)`,
    );
  }

  const roleAdjustment = Math.max(
    -18,
    Math.min(24, roleDenials * 8 - roleApprovals * 6),
  );
  if (roleAdjustment !== 0) {
    adjustment += roleAdjustment;
    reasons.push(
      `Role history ${roleAdjustment > 0 ? "+" : ""}${roleAdjustment} (${roleApprovals} approved / ${roleDenials} denied)`,
    );
  }

  // Strong role-level behavioural learning.
  //
  // Two different Agents in the same role approved with no denials
  // establishes a reusable "normal behaviour" pattern.
  //
  // Three different Agents in the same role denied with no approvals
  // establishes a reusable suspicious-behaviour pattern.
  //
  // Mixed evidence deliberately does NOT auto-learn either direction.
  if (rolePattern === "allow") {
    adjustment -= 25;

    reasons.push(
      `Established ${ROLE_LABELS[agent.role]} allow pattern -25 ` +
        `(${distinctRoleApprovedAgents} distinct Agents approved / 0 denied)`,
    );
  }

  if (rolePattern === "block") {
    adjustment += 35;

    reasons.push(
      `Established ${ROLE_LABELS[agent.role]} rejection pattern +35 ` +
        `(0 approved / ${distinctRoleDeniedAgents} distinct Agents denied)`,
    );
  }

  if (rolePattern === "mixed") {
    reasons.push(
      `Mixed ${ROLE_LABELS[agent.role]} evidence — human review remains required`,
    );
  }

  // Only generalise across the developer family after repeated evidence.
  if (
    roleFamily(agent.role) === "developer" &&
    familyApprovals >= 3 &&
    familyDenials === 0
  ) {
    adjustment -= 12;
    reasons.push(
      `Developer-family trust -12 (${familyApprovals} approved / 0 denied)`,
    );
  }
  if (familyDenials >= 3 && familyApprovals === 0) {
    adjustment += 24;
    reasons.push(
      `Role-family rejection pattern +24 (0 approved / ${familyDenials} denied)`,
    );
  }

  return {
    adjustment: Math.max(-60, Math.min(60, adjustment)),
    reasons,

    personalApprovals,
    personalDenials,

    roleApprovals,
    roleDenials,

    familyApprovals,
    familyDenials,

    distinctRoleApprovedAgents,
    distinctRoleDeniedAgents,

    rolePattern,
  };
}
