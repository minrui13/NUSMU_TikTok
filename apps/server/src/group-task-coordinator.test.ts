import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { AgentService } from "./agent-service.js";
import { loadConfig } from "./config.js";
import { GroupTaskCoordinator } from "./group-task-coordinator.js";
import { GroupTaskService } from "./group-task-service.js";
import { parseMentionedAgents } from "./mention-parser.js";
import { JsonStore } from "./store.js";
import { WorkspaceManager } from "./workspace.js";

import type { AgentRunner, RunnerRequest, RunnerResult } from "./types.js";

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
      "test-user",
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

describe("group task ability enforcement", () => {
  it("does not start the task, and spends zero tokens, when a mentioned Agent lacks canJoinSession", async () => {
    let runCallCount = 0;
    const countingRunner: AgentRunner = {
      run: async () => {
        runCallCount += 1; // should never increment in this test
        return { output: "9", threadId: "t", usage: { inputTokens: 100, outputTokens: 10 } };
      },
      cancel: async () => false,
      isAvailable: async () => true,
    };
    const service = await makeService(countingRunner);

    // deliberately NOT granting canJoinSession
    const blocked = await service.createAgent({ name: "Blocked" });

    const groupTaskService = new GroupTaskService(service);

    expect(() => groupTaskService.createTask(`Count down @Blocked`)).toThrow(
      /cannot join this group task/,
    );
    expect(runCallCount).toBe(0); // confirms no Agent run — no tokens spent
  });

  it("allows the task to start when every mentioned Agent has canJoinSession granted", async () => {
    const runner = new FakeCountdownRunner();
    const service = await makeService(runner);

    const allowed = await service.createAgent({
      name: "Allowed",
      abilities: { canJoinSession: true },
    });

    const groupTaskService = new GroupTaskService(service);
    const task = groupTaskService.createTask(`Count down @Allowed`, "test-user");

    expect(task.status).toBe("running");
    expect(task.participants.map((p) => p.name)).toEqual(["Allowed"]);

    // Wait for the background fire-and-forget run() to actually finish,
    // so afterEach's directory cleanup doesn't race against in-flight writes.
    const deadline = Date.now() + 5_000;
    let finalState = groupTaskService.getTask(task.id);
    while (finalState.status === "running" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      finalState = groupTaskService.getTask(task.id);
    }
    expect(finalState.status).toBe("completed");
  });
});