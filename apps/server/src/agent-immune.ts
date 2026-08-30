import { randomUUID } from "node:crypto";
import type {
  ImmuneMemory,
  ImmuneThreatCategory,
  ImmuneThreatEvent,
} from "./types.js";

const now = () => new Date().toISOString();

const CATEGORY_LABELS: Record<ImmuneThreatCategory, string> = {
  prompt_injection: "Prompt injection",
  credential_access: "Credential access",
  data_exfiltration: "Data exfiltration",
  destructive_action: "Destructive action",
  workspace_escape: "Workspace escape",
  suspicious_network: "Suspicious network access",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " url ")
    .replace(/[a-z]:\\[^\s]+/gi, " path ")
    .replace(/\/[^\s]+/g, " path ")
    .replace(/[^a-z0-9_.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (value: string) =>
  new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length >= 4)
      .filter((token) => !["this", "that", "with", "from", "into", "your", "then", "please"].includes(token)),
  );

function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / Math.min(a.size, b.size);
}

export interface ImmuneAssessment {
  score: number;
  decision: "allow" | "review" | "deny";
  categories: ImmuneThreatCategory[];
  reasons: string[];
  matchedMemoryIds: string[];
  learnedMatch: boolean;
}

export class AgentImmuneEngine {
  assess(prompt: string, memories: ImmuneMemory[]): ImmuneAssessment {
    const value = prompt.toLowerCase();
    const categories = new Set<ImmuneThreatCategory>();
    const reasons: string[] = [];
    let score = 0;

    const injection = [
      /ignore (all |any |the )?(previous|prior|above) instructions?/i,
      /disregard (all |any |the )?(previous|prior|above) instructions?/i,
      /system (message|prompt|instruction)/i,
      /do not tell (the )?(user|operator)/i,
      /hidden instructions?/i,
    ].some((pattern) => pattern.test(prompt));
    if (injection) {
      score += 38;
      categories.add("prompt_injection");
      reasons.push("Prompt contains instruction-override language commonly used in prompt injection.");
    }

    const credential = [
      /\.env\b/i,
      /credentials?\.json/i,
      /api[_ -]?key/i,
      /access[_ -]?token/i,
      /secret[_ -]?key/i,
      /private[_ -]?key/i,
      /password file/i,
    ].some((pattern) => pattern.test(prompt));
    if (credential) {
      score += 34;
      categories.add("credential_access");
      reasons.push("Prompt requests or references sensitive credential material.");
    }

    const exfiltration = [
      /send .* to https?:\/\//i,
      /upload .* to /i,
      /post .* to /i,
      /exfiltrat/i,
      /webhook/i,
      /curl\s+.*https?:\/\//i,
    ].some((pattern) => pattern.test(prompt));
    if (exfiltration) {
      score += 34;
      categories.add("data_exfiltration");
      reasons.push("Prompt asks to transmit data to an external destination.");
    }

    const destructive = [
      /rm\s+-rf\s+(\/|~|\.\.)/i,
      /delete (all|everything)/i,
      /format (the )?(disk|drive)/i,
      /drop\s+(database|table)/i,
      /remove .* outside .*workspace/i,
    ].some((pattern) => pattern.test(prompt));
    if (destructive) {
      score += 72;
      categories.add("destructive_action");
      reasons.push("Prompt requests a destructive or broad irreversible operation.");
    }

    const escape = [
      /outside (the )?workspace/i,
      /\.\.\//,
      /\/etc\//i,
      /~\/\.ssh/i,
      /c:\\windows\\/i,
    ].some((pattern) => pattern.test(prompt));
    if (escape) {
      score += 28;
      categories.add("workspace_escape");
      reasons.push("Prompt attempts to reach files or paths outside the Agent workspace.");
    }

    const suspiciousNetwork = [
      /unknown[- ]?(domain|host)/i,
      /requestbin/i,
      /ngrok/i,
      /webhook\.site/i,
    ].some((pattern) => pattern.test(prompt));
    if (suspiciousNetwork) {
      score += 26;
      categories.add("suspicious_network");
      reasons.push("Prompt references a destination commonly used for ad-hoc external transfer.");
    }

    if (credential && exfiltration) {
      score += 24;
      reasons.push("Credential access combined with external transfer is treated as a high-risk chain.");
    }

    const matchedMemoryIds: string[] = [];
    let strongestMemorySimilarity = 0;
    for (const memory of memories) {
      if (!memory.autoBlock || memory.status !== "active") continue;
      const match = similarity(prompt, memory.fingerprint);
      if (match >= 0.55) {
        matchedMemoryIds.push(memory.id);
        strongestMemorySimilarity = Math.max(strongestMemorySimilarity, match);
      }
    }
    if (matchedMemoryIds.length) {
      score += 35;
      reasons.push(
        `Immune Memory matched a previously confirmed threat (${Math.round(strongestMemorySimilarity * 100)}% token overlap).`,
      );
    }

    score = Math.min(100, score);
    const decision = score >= 70 ? "deny" : score >= 45 ? "review" : "allow";
    return {
      score,
      decision,
      categories: [...categories],
      reasons,
      matchedMemoryIds,
      learnedMatch: matchedMemoryIds.length > 0,
    };
  }

  createThreatEvent(input: {
    agentId: string;
    runId: string;
    prompt: string;
    assessment: ImmuneAssessment;
  }): ImmuneThreatEvent {
    return {
      id: randomUUID(),
      agentId: input.agentId,
      runId: input.runId,
      promptExcerpt: input.prompt.slice(0, 500),
      score: input.assessment.score,
      decision: input.assessment.decision,
      categories: input.assessment.categories,
      reasons: input.assessment.reasons,
      matchedMemoryIds: input.assessment.matchedMemoryIds,
      learnedMatch: input.assessment.learnedMatch,
      reviewStatus: "pending",
      createdAt: now(),
      reviewedAt: null,
    };
  }

  learn(event: ImmuneThreatEvent, memories: ImmuneMemory[]): ImmuneMemory {
    const category = event.categories[0] ?? "prompt_injection";
    const fingerprint = normalize(event.promptExcerpt);
    const existing = memories.find(
      (memory) => memory.category === category && similarity(memory.fingerprint, fingerprint) >= 0.7,
    );
    const timestamp = now();
    if (existing) {
      existing.confirmations += 1;
      existing.detections += 1;
      existing.confidence = Math.min(0.99, 0.65 + existing.confirmations * 0.12);
      existing.autoBlock = existing.confirmations >= 1;
      existing.updatedAt = timestamp;
      existing.status = "active";
      return structuredClone(existing);
    }

    const memory: ImmuneMemory = {
      id: randomUUID(),
      category,
      label: CATEGORY_LABELS[category],
      fingerprint,
      confirmations: 1,
      dismissals: 0,
      detections: 1,
      confidence: 0.77,
      autoBlock: true,
      status: "active",
      learnedFromEventId: event.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memories.push(memory);
    return structuredClone(memory);
  }
}
