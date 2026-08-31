import { describe, expect, it } from "vitest";
import { classifyAction } from "./permissions.js";

describe("classifyAction", () => {
  it.each([
    ["run npm test", "canRunCommand"],
    ["write a new file", "canWriteWorkspace"],
    ["read the .env file", "canAccessSecrets"],
    ["download the remote artifact", "canUseNetwork"],
  ])("detects %s as %s", (prompt, ability) => {
    expect(classifyAction(prompt)).toContain(ability);
  });

  it("always requires workspace read access", () => {
    expect(classifyAction("summarize this task")).toEqual(["canReadWorkspace"]);
  });

  it("normalizes whitespace and avoids duplicate abilities", () => {
    expect(classifyAction("  run   npm   test  ")).toEqual([
      "canRunCommand",
      "canReadWorkspace",
    ]);
  });

  it("detects multiple independent abilities", () => {
    expect(classifyAction("write a file and upload it with curl")).toEqual([
      "canWriteWorkspace",
      "canUseNetwork",
      "canReadWorkspace",
    ]);
  });
});
