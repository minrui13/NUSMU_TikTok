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
  sensitive_resource: "Sensitive resource access",
  data_exfiltration: "Data exfiltration",
  destructive_action: "Destructive action",
  workspace_escape: "Workspace escape",
  suspicious_network: "Suspicious network access",
  privilege_escalation: "Privilege escalation",
};

const TOKEN_ALIASES: Record<string, string> = {
  previous: "prior",
  above: "prior",
  read: "access",
  open: "access",
  retrieve: "access",
  sending: "send",
  sent: "send",
  transmit: "send",
  transmitted: "send",
  upload: "send",
  uploaded: "send",
};

const IGNORED_TOKENS = new Set([
  "this",
  "that",
  "with",
  "from",
  "into",
  "your",
  "then",
  "please",
  "before",
  "another",
]);

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
      .filter((token) => !IGNORED_TOKENS.has(token))
      .map((token) => TOKEN_ALIASES[token] ?? token),
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
  baseScore: number;
  memoryAdjustment: number;
  decision: "allow" | "review" | "deny";
  categories: ImmuneThreatCategory[];
  reasons: string[];
  scoreBreakdown: {
    label: string;
    score: number;
  }[];
  matchedMemoryIds: string[];
  learnedMatch: boolean;
}

export class AgentImmuneEngine {
  assess(
    prompt: string,
    memories: ImmuneMemory[],
    context: { roleTrustAdjustment?: number; roleTrustReasons?: string[] } = {},
  ): ImmuneAssessment {
    const categories = new Set<ImmuneThreatCategory>();
    const reasons: string[] = [];
    const scoreBreakdown: { label: string; score: number }[] = [];

    let baseScore = 0;

    const addSignal = (
      score: number,
      category: ImmuneThreatCategory,
      label: string,
      reason: string,
    ) => {
      baseScore += score;
      categories.add(category);
      reasons.push(reason);

      scoreBreakdown.push({
        label,
        score,
      });
    };

    // ---------------------------------------------------------
    // 1. PROMPT INJECTION
    // ---------------------------------------------------------

    const injection = [
      /ignore (all |any |the )?(previous|prior|above) instructions?/i,
      /disregard (all |any |the )?(previous|prior|above) instructions?/i,
      /forget (all |any |the )?(previous|prior|earlier) instructions?/i,
      /override (the )?(system|developer|previous) instructions?/i,
      /hidden instructions?/i,
      /system (message|prompt|instruction)/i,
      /do not tell (the )?(user|operator)/i,
    ].some((pattern) => pattern.test(prompt));

    if (injection) {
      addSignal(
        22,
        "prompt_injection",
        "Instruction override",
        "Prompt contains language attempting to override or replace existing Agent instructions.",
      );
    }

    // ---------------------------------------------------------
    // 2. SENSITIVE RESOURCE
    // ---------------------------------------------------------

    const sensitiveResource = [
      /\.env\b/i,
      /credentials?\.json/i,
      /\.ssh\b/i,
      /id_rsa/i,
      /id_ed25519/i,
      /secrets?\.json/i,
      /config.*secret/i,
      /environment variables?/i,
      /runtime configuration/i,
    ].some((pattern) => pattern.test(prompt));

    if (sensitiveResource) {
      addSignal(
        18,
        "sensitive_resource",
        "Sensitive resource",
        "Prompt references a file or configuration location commonly containing sensitive information.",
      );
    }

    // ---------------------------------------------------------
    // 3. CREDENTIAL ACCESS
    // ---------------------------------------------------------

    const credential = [
      /api[_ -]?key/i,
      /access[_ -]?token/i,
      /auth(?:entication)?[_ -]?token/i,
      /secret[_ -]?key/i,
      /private[_ -]?key/i,
      /password/i,
      /credential/i,
      /bearer token/i,
    ].some((pattern) => pattern.test(prompt));

    if (credential) {
      addSignal(
        25,
        "credential_access",
        "Credential request",
        "Prompt requests or references authentication credentials, tokens, passwords, or keys.",
      );
    }

    // ---------------------------------------------------------
    // 4. DATA EXFILTRATION
    // ---------------------------------------------------------

    const exfiltration = [
      /send .* to https?:\/\//i,
      /transmit .* to https?:\/\//i,
      /upload .* to /i,
      /post .* to /i,
      /forward .* to https?:\/\//i,
      /exfiltrat/i,
      /send .* webhook/i,
      /curl\s+.*https?:\/\//i,
    ].some((pattern) => pattern.test(prompt));

    if (exfiltration) {
      addSignal(
        20,
        "data_exfiltration",
        "External data transmission",
        "Prompt requests transmitting information to an external destination.",
      );
    }

    // ---------------------------------------------------------
    // 5. SUSPICIOUS NETWORK ACCESS
    // ---------------------------------------------------------

    const suspiciousNetwork = [
      /unknown[- ]?(domain|host)/i,
      /requestbin/i,
      /ngrok/i,
      /webhook\.site/i,
      /evil\.example/i,
    ].some((pattern) => pattern.test(prompt));

    if (suspiciousNetwork) {
      addSignal(
        12,
        "suspicious_network",
        "Suspicious network destination",
        "Prompt references an untrusted or ad-hoc external destination.",
      );
    }

    // ---------------------------------------------------------
    // 6. WORKSPACE ESCAPE
    // ---------------------------------------------------------

    const workspaceEscape = [
      /outside (the )?workspace/i,
      /\.\.\//,
      /\.\.\\/,
      /\/etc\//i,
      /~\/\.ssh/i,
      /c:\\windows\\/i,
      /c:\\users\\/i,
    ].some((pattern) => pattern.test(prompt));

    if (workspaceEscape) {
      addSignal(
        25,
        "workspace_escape",
        "Workspace boundary violation",
        "Prompt attempts to access a path outside the Agent's assigned workspace.",
      );
    }

    // ---------------------------------------------------------
    // 7. DESTRUCTIVE OPERATIONS
    // ---------------------------------------------------------

    const destructive = [
      /rm\s+-rf/i,
      /delete (all|everything|every file)/i,
      /remove (all|everything|every file)/i,
      /format (the )?(disk|drive)/i,
      /drop\s+(database|table)/i,
      /wipe (the )?(disk|workspace|filesystem)/i,
      /destroy (all|everything)/i,
    ].some((pattern) => pattern.test(prompt));

    if (destructive) {
      addSignal(
        30,
        "destructive_action",
        "Destructive operation",
        "Prompt requests a broad or potentially irreversible destructive action.",
      );
    }

    // ---------------------------------------------------------
    // 8. PRIVILEGE ESCALATION / SECURITY BYPASS
    // ---------------------------------------------------------

    const privilegeEscalation = [
      /disable (the )?sandbox/i,
      /bypass (the )?(sandbox|security|restriction|policy)/i,
      /administrator privileges?/i,
      /run as administrator/i,
      /run as root/i,
      /sudo\s+/i,
      /elevate privileges?/i,
      /disable security/i,
    ].some((pattern) => pattern.test(prompt));

    if (privilegeEscalation) {
      addSignal(
        30,
        "privilege_escalation",
        "Privilege escalation",
        "Prompt attempts to bypass security controls or obtain elevated privileges.",
      );
    }

    // ---------------------------------------------------------
    // COMBINATION SIGNALS
    // ---------------------------------------------------------

    if (credential && exfiltration) {
      baseScore += 10;

      reasons.push(
        "Credential access combined with external transmission increases the likelihood of credential exfiltration.",
      );

      scoreBreakdown.push({
        label: "Credential + exfiltration chain",
        score: 10,
      });
    }

    if (workspaceEscape && sensitiveResource) {
      baseScore += 8;

      reasons.push(
        "Sensitive resource access outside the workspace increases the severity of the request.",
      );

      scoreBreakdown.push({
        label: "Sensitive workspace escape",
        score: 8,
      });
    }

    // Do not let static rules immediately dominate the whole score.
    baseScore = Math.min(baseScore, 90);

    // ---------------------------------------------------------
    // IMMUNE MEMORY
    // ---------------------------------------------------------

    const matchedMemoryIds: string[] = [];
    let strongestMemorySimilarity = 0;
    let strongestMemoryConfidence = 0;

    for (const memory of memories) {
      if (!memory.autoBlock || memory.status !== "active") {
        continue;
      }

      const match = similarity(prompt, memory.fingerprint);

      if (match >= 0.55) {
        matchedMemoryIds.push(memory.id);

        if (match > strongestMemorySimilarity) {
          strongestMemorySimilarity = match;
          strongestMemoryConfidence = memory.confidence;
        }
      }
    }

    let memoryAdjustment = 0;

    if (matchedMemoryIds.length > 0) {
      // Similarity and historical confidence determine how much
      // previously learned evidence affects this run.
      memoryAdjustment = Math.round(
        strongestMemorySimilarity * strongestMemoryConfidence * 25,
      );

      reasons.push(
        `Immune Memory matched a previously confirmed threat (${Math.round(
          strongestMemorySimilarity * 100,
        )}% similarity, ${Math.round(
          strongestMemoryConfidence * 100,
        )}% memory confidence).`,
      );

      scoreBreakdown.push({
        label: "Immune Memory",
        score: memoryAdjustment,
      });
    }

    const hasNonDelegableThreat =
      exfiltration || workspaceEscape || destructive || privilegeEscalation;
    const requestedRoleAdjustment = context.roleTrustAdjustment ?? 0;
    const roleTrustAdjustment =
      requestedRoleAdjustment < 0 && hasNonDelegableThreat
        ? 0
        : requestedRoleAdjustment;

    if (roleTrustAdjustment !== 0) {
      scoreBreakdown.push({
        label: "Role-aware adaptive trust",
        score: roleTrustAdjustment,
      });
      reasons.push(
        ...(context.roleTrustReasons ?? []).map((reason) => `Adaptive trust: ${reason}`),
      );
    } else if (requestedRoleAdjustment < 0 && hasNonDelegableThreat) {
      reasons.push(
        "Role trust cannot reduce risk for exfiltration, workspace escape, destructive actions, or privilege escalation.",
      );
    }

    const score = Math.max(0, Math.min(100, baseScore + memoryAdjustment + roleTrustAdjustment));

    // ---------------------------------------------------------
    // DECISION BANDS
    // ---------------------------------------------------------

    const decision = score >= 70 ? "deny" : score >= 40 ? "review" : "allow";

    return {
      score,
      baseScore,
      memoryAdjustment,
      decision,
      categories: [...categories],
      reasons,
      scoreBreakdown,
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
      baseScore: input.assessment.baseScore,
      memoryAdjustment: input.assessment.memoryAdjustment,

      decision: input.assessment.decision,
      categories: input.assessment.categories,
      reasons: input.assessment.reasons,
      scoreBreakdown: input.assessment.scoreBreakdown,

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
      (memory) =>
        memory.category === category &&
        similarity(memory.fingerprint, fingerprint) >= 0.7,
    );
    const timestamp = now();
    if (existing) {
      existing.confirmations += 1;
      existing.detections += 1;
      existing.confidence = Math.min(
        0.95,
        0.55 + existing.confirmations * 0.1 - existing.dismissals * 0.12,
      );
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
