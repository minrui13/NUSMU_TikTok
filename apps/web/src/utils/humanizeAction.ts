// Maps known raw event/ability identifiers to human-readable labels.
// Keep this in sync with the server's own display names where relevant
// (see apps/server/src/abilities/policy-checker.ts:abilityLabel) so the
// same concept reads the same way across the audit log and the
// Abilities screen.
const KNOWN_ACTIONS: Record<string, string> = {
  agent_turn_started: "Started its turn",
  agent_turn_completed: "Completed its turn",
  agent_turn_failed: "Turn failed",
  canReadWorkspace: "Read workspace files",
  canWriteWorkspace: "Write workspace files",
  canRunCommand: "Run commands",
  canAccessSecrets: "Access secrets",
  canUseNetwork: "Use network",
  canJoinSession: "Join shared sessions",
};

/**
 * Converts a raw action/ability identifier (snake_case or camelCase)
 * into a human-readable label. Falls back to a generic word-splitting
 * transform for anything not explicitly listed, so a future event type
 * never renders as an unbroken camelCase/snake_case blob.
 */
export function humanizeAction(action: string): string {
  if (KNOWN_ACTIONS[action]) return KNOWN_ACTIONS[action];

  return action
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Renders a userId like "system:coordinator" as a friendlier label. */
export function humanizeUser(userId: string): string {
  if (userId.startsWith("system:")) {
    return userId.slice("system:".length).replace(/^./, (c) => c.toUpperCase()) + " (system)";
  }
  return userId;
}