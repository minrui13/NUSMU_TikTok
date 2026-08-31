// src/test-helpers.ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig } from "./config.js";
import { JsonStore } from "./store.js";
import { WorkspaceManager } from "./workspace.js";
import { AgentService } from "./agent-service.js";
import { createApp } from "./app.js";
import type { AgentRunner, RunnerRequest, RunnerResult } from "./types.js";
import type { GroupTaskService } from "./group-task-service.js";

class FakeRunner implements AgentRunner {
  async run(request: RunnerRequest): Promise<RunnerResult> {
    return {
      output: "fake output for: " + request.prompt,
      threadId: "thread-1",
      usage: null,
    };
  }
  async cancel(): Promise<boolean> {
    return true;
  }
  async isAvailable(): Promise<boolean> {
    return true;
  }
}

const fakeGroupTaskService = {
  createTask: () => {
    throw new Error("not used in policy tests");
  },
  getTask: () => {
    throw new Error("not used in policy tests");
  },
} as unknown as GroupTaskService;

export async function buildTestApp() {
  const tempDir = await mkdtemp(path.join(tmpdir(), "launchpad-test-"));
  const config = loadConfig({
    NODE_ENV: "test",
    APP_DATA_DIR: tempDir,
    AGENT_WORKSPACE_ROOT: path.join(tempDir, "workspaces"),
    ARK_API_KEY: "test-key",
    ARK_MODEL: "test-model",
  });
  const store = new JsonStore(path.join(tempDir, "db.json"));
  const workspaces = new WorkspaceManager(config.workspaceRoot);
  const runner = new FakeRunner();
  const service = new AgentService(config, store, workspaces, runner);
  await service.initialize();
  const app = await createApp(config, service, fakeGroupTaskService);
  return app;
}
