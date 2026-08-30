import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { AgentService } from "./agent-service.js";
import { loadConfig } from "./config.js";
import { GroupTaskCoordinator } from "./group-task-coordinator.js";
import { parseMentionedAgents } from "./mention-parser.js";
import { JsonStore } from "./store.js";
import type { AgentRunner, RunnerRequest, RunnerResult } from "./types.js";
import { WorkspaceManager } from "./workspace.js";

// Reads the shared history in the prompt and replies with the next
// lower number, or the DONE marker once it reaches 1.
class FakeCountdownRunner implements AgentRunner {
  async run(request: RunnerRequest): Promise<RunnerResult> {
    const numbers = [...request.prompt.matchAll(/:\s*(\d+)\s*$/gm)].map((m) =>
      Number.parseInt(m[1]!, 10),
    );
    const last = numbers.length > 0 ? numbers[numbers.length - 1]! : 10;
    const next = last - 1;
    const output = next === 1 ? "1 [TASK COMPLETE]" : String(next);
    return { output, threadId: request.threadId ?? "fake-thread", usage: null };
  }
  async cancel(): Promise<boolean> {
    return false;
  }
  async isAvailable(): Promise<boolean> {
    return true;
  }
}

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeService(runner: AgentRunner): Promise<AgentService> {
  const root = await mkdtemp(path.join(tmpdir(), "group-task-test-"));
  dirs.push(root);
  const config = loadConfig({
    NODE_ENV: "test",
    APP_DATA_DIR: path.join(root, "data"),
    AGENT_WORKSPACE_ROOT: path.join(root, "workspaces"),
    CODEX_HOME: path.join(root, "codex"),
    ARK_API_KEY: "test-key",
    ARK_MODEL: "ep-test",
  });
  const service = new AgentService(
    config,
    new JsonStore(path.join(root, "data", "db.json")),
    new WorkspaceManager(path.join(root, "workspaces")),
    runner,
  );
  await service.initialize();
  return service;
}

describe("group chat @mention task", () => {
  it("parses @mentions in the order they appear", () => {
    const known = [
      { id: "1", name: "Alpha" },
      { id: "2", name: "Beta" },
      { id: "3", name: "Gamma" },
    ];
    const mentioned = parseMentionedAgents(
      "Count down @Gamma @Alpha @Beta please",
      known,
    );
    expect(mentioned.map((a) => a.name)).toEqual(["Gamma", "Alpha", "Beta"]);
  });

  it("runs a full countdown to completion with no duplicate turns", async () => {
    const service = await makeService(new FakeCountdownRunner());
    const a = await service.createAgent({ name: "Agent A" });
    const b = await service.createAgent({ name: "Agent B" });

    const coordinator = new GroupTaskCoordinator(
      service,
      "Count off from 10, subtract 1 each turn, no repeats, until you reach 1.",
      [
        { id: a.id, name: a.name },
        { id: b.id, name: b.name },
      ],
    );
    const result = await coordinator.run();

    expect(result.status).toBe("completed");
    expect(result.turns).toHaveLength(9); // 9 down to 1
    const contents = result.turns.map((t) => t.content);
    expect(new Set(contents).size).toBe(contents.length); // no duplicates
  });

  it("fails when an Agent repeats a previous turn verbatim", async () => {
    const stuckRunner: AgentRunner = {
      run: async () => ({ output: "9", threadId: "t", usage: null }),
      cancel: async () => false,
      isAvailable: async () => true,
    };
    const service = await makeService(stuckRunner);
    const a = await service.createAgent({ name: "Stuck" });

    const coordinator = new GroupTaskCoordinator(service, "Count down", [
      { id: a.id, name: a.name },
    ]);
    const result = await coordinator.run();

    expect(result.status).toBe("failed");
    expect(result.error).toContain("repeated an earlier turn");
  });
});