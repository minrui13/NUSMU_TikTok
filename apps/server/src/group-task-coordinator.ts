import { randomUUID } from "node:crypto";
import type { AgentService } from "./agent-service.js";
import type { MentionableAgent } from "./mention-parser.js";

export type GroupTaskStatus = "running" | "completed" | "failed";

export interface GroupTaskTurn {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  createdAt: string;
}

export interface GroupTaskState {
  id: string;
  description: string;
  participants: MentionableAgent[];
  turns: GroupTaskTurn[];
  status: GroupTaskStatus;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

const DONE_MARKER = "[TASK COMPLETE]";

export class GroupTaskCoordinator {
  private task: GroupTaskState;

  constructor(
    private readonly service: AgentService,
    description: string,
    private readonly participants: MentionableAgent[],
    private readonly maxTurns = 40,
  ) {
    if (participants.length < 1) {
      throw new Error("A group task needs at least one @mentioned Agent");
    }
    this.task = {
      id: randomUUID(),
      description,
      participants,
      turns: [],
      status: "running",
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
  }

  getState(): GroupTaskState {
    return structuredClone(this.task);
  }

  async run(turnTimeoutMs = 20_000): Promise<GroupTaskState> {
    let turnIndex = 0;

    while (this.task.status === "running" && this.task.turns.length < this.maxTurns) {
      const participant = this.participants[turnIndex % this.participants.length]!;
      const prompt = this.buildPrompt(participant);

      const { run } = await this.service.sendMessage(participant.id, prompt);
      const settled = await this.waitForCompletion(run.id, turnTimeoutMs);
      if (!settled) {
        return this.fail(`${participant.name} did not respond within ${turnTimeoutMs}ms`);
      }

      const finished = this.service.getRun(run.id);
      if (finished.status !== "completed" || !finished.output) {
        return this.fail(`${participant.name} failed: ${finished.error ?? "no output"}`);
      }

      const content = finished.output.trim();

      // Generic anomaly check: catches stuck loops / duplicate turns
      // without any domain-specific (e.g. countdown) parsing.
      const isDuplicate = this.task.turns.some(
        (turn) => turn.content.toLowerCase() === content.toLowerCase(),
      );
      if (isDuplicate) {
        return this.fail(`${participant.name} repeated an earlier turn verbatim: "${content}"`);
      }

      this.task.turns.push({
        id: randomUUID(),
        agentId: participant.id,
        agentName: participant.name,
        content,
        createdAt: new Date().toISOString(),
      });

      if (content.includes(DONE_MARKER)) {
        this.task.status = "completed";
        this.task.completedAt = new Date().toISOString();
        return this.getState();
      }

      turnIndex += 1;
    }

    if (this.task.status === "running") {
      return this.fail(`Exceeded max turns (${this.maxTurns}) without completion`);
    }
    return this.getState();
  }

  private buildPrompt(participant: MentionableAgent): string {
    const others = this.participants.filter((p) => p.id !== participant.id).map((p) => p.name);
    const history = this.task.turns.map((t) => `${t.agentName}: ${t.content}`).join("\n");

    return [
      `You are "${participant.name}", one participant in a shared group task with: ${others.join(", ") || "no one else"}.`,
      `Task: ${this.task.description}`,
      history ? `Conversation so far:\n${history}` : "You go first.",
      `Give only your next contribution — do not repeat any earlier turn.`,
      `If the task is now fully complete, end your reply with exactly: ${DONE_MARKER}`,
    ].join("\n\n");
  }

  private async waitForCompletion(runId: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const run = this.service.getRun(runId);
      if (["completed", "failed", "cancelled"].includes(run.status)) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  private fail(error: string): GroupTaskState {
    this.task.status = "failed";
    this.task.error = error;
    this.task.completedAt = new Date().toISOString();
    return this.getState();
  }
}