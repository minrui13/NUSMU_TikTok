import { Ability, Risk } from "../types/abilities.js";

// Default abilities settings for each agent
export const defaultAgentAbilities: Record<Ability, boolean> = {
  canReadWorkspace: true,
  canWriteWorkspace: true,
  canRunCommand: false,
  canAccessSecrets: false,
  canUseNetwork: false,
  canJoinSession: false,
};

// These are just heuristic keyword classifier because
// we dont't know for certain what Codex will do from natural language alone.
// canReadWorkspace is always included because agents always need to read
// access to inspect files before understanding what to do
const patterns: Array<{
  ability: Ability;
  pattern: RegExp;
}> = [
  {
    ability: "canRunCommand",
    pattern:
      /\b(run|execute|shell|command|npm|pnpm|yarn|bun|test|build|compile|install|start)\b/i,
  },
  {
    ability: "canWriteWorkspace",
    pattern:
      /\b(create|write|add|generate|edit|update|delete|remove|modify|save|overwrite)\b/i,
  },
  {
    ability: "canAccessSecrets",
    pattern:
      /(\.env\b|secret|credential|password|api[\s_-]?key|access[\s_-]?token|bearer\s+[a-z0-9._-]+)/i,
  },
  {
    ability: "canUseNetwork",
    pattern:
      /\b(fetch|download|upload|curl|wget|clone|push|pull|request|http|https|api\.)\b|https?:\/\/\S+/i,
  },
];

// Risk Level of each ability
export const abilityRisk: Record<Ability, Risk> = {
  canReadWorkspace: "low",
  canWriteWorkspace: "medium",
  canRunCommand: "high",
  canAccessSecrets: "critical",
  canUseNetwork: "high",
  canJoinSession: "medium",
};

// Scans the prompt and check against the pattertn to see which ability is required
export function classifyAction(prompt: string): Ability[] {
  const normalisedPrompt = prompt.trim().replace(/\s+/g, " ");

  const matchedAbilities = patterns
    .filter(({ pattern }) => pattern.test(normalisedPrompt))
    .map(({ ability }) => ability);

  matchedAbilities.push("canReadWorkspace");

  return Array.from(new Set(matchedAbilities));
}
