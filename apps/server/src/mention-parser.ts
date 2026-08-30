export interface MentionableAgent {
  id: string;
  name: string;
}

export function parseMentionedAgents(
  rawText: string,
  knownAgents: MentionableAgent[],
): MentionableAgent[] {
  const matches: { agent: MentionableAgent; index: number }[] = [];
  const lowerText = rawText.toLowerCase();

  for (const agent of knownAgents) {
    const needle = "@" + agent.name.toLowerCase();
    const index = lowerText.indexOf(needle);
    if (index !== -1) {
      matches.push({ agent, index });
    }
  }

  return matches.sort((a, b) => a.index - b.index).map((m) => m.agent);
}