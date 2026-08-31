import { CodexRunner } from "./codex-runner.js";
import { ContainerCodexRunner } from "./container-codex-runner.js";

import type { AppConfig } from "./config.js";
import type { AgentRunner } from "./types.js";

export function createRunner(config: AppConfig): AgentRunner {
  return config.runtimeProvider === "container"
    ? new ContainerCodexRunner(config)
    : new CodexRunner(config);
}
