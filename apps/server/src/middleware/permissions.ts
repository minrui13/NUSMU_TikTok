export type Ability =
  // Allows Agent to inspect files in its workspace
  | "canReadWorkspace"
  // Allows Agent to create, edit or delete workspace files
  | "canWriteWorkspace"
  // Allows Agent to execute shell commands such as tests, builds or package installation
  | "canRunCommand"
  // Allows Agent to read sensitive values such as API keys, tokens, passwords, or .env files
  | "canAccessSecrets"
  // Allows Agent to access the internet or external services.
  | "canUseNetwork";

// Default abilities settings for each agent
export const defaultAgentAbilities: Record<Ability, boolean> = {
  canReadWorkspace: true,
  canWriteWorkspace: true,
  canRunCommand: false,
  canAccessSecrets: false,
  canUseNetwork: false,
};

// These are just heuristic keyword classifier because
// we dont't know for certain what Codex will do from natural language alone.
// canReadWorkspace is always included because agents always need to read
// access to inspect files before understanding what to do
const patterns: Array<{ ability: Ability; pattern: RegExp }> = [
  {
    ability: "canRunCommand",
    pattern: /\b(run|execute|install|npm|test|build|compile)\b/i,
  },
  {
    ability: "canWriteWorkspace",
    pattern: /\b(create|write|add|generate|edit|delete|modify)\b/i,
  },
  {
    ability: "canAccessSecrets",
    pattern: /\b(secret|credential|api[\s-]?key|token|\.env)\b/i,
  },
  {
    ability: "canUseNetwork",
    pattern: /\b(fetch|download|curl|http|install from|clone)\b/i,
  },
];

export type Risk = "low" | "medium" | "high" | "critical";

// Risk Level of each ability
export const abilityRisk: Record<Ability, Risk> = {
  canReadWorkspace: "low",
  canWriteWorkspace: "medium",
  canRunCommand: "high",
  canAccessSecrets: "critical",
  canUseNetwork: "high",
};

// Scans the prompt and check against the pattertn to see which ability is required
export function classifyAction(prompt: string): Ability[] {
  const matched = patterns
    .filter(({ pattern }) => pattern.test(prompt))
    .map(({ ability }) => ability);
  return Array.from(new Set([...matched, "canReadWorkspace"]));
}
