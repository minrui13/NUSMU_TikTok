import { describe, expect, it } from "vitest";
import { checkAbility, overallDecision } from "./policy-checker";

describe("checkAbility", () => {
  it("denies an ungranted low-risk ability", () => {
    const result = checkAbility("canReadWorkspace", []);
    expect(result.decision).toBe("denied");
  });

  it("allows a granted low-risk ability", () => {
    const result = checkAbility("canReadWorkspace", ["canReadWorkspace"]);
    expect(result.decision).toBe("allowed");
  });

  it("denies an ungranted high-risk ability outright, not pending", () => {
    const result = checkAbility("canRunCommand", []);
    expect(result.decision).toBe("denied");
  });

  it("requires approval for a granted high-risk ability", () => {
    const result = checkAbility("canRunCommand", ["canRunCommand"]);
    expect(result.decision).toBe("pending_approval");
  });

  it("requires approval for a granted critical-risk ability", () => {
    const result = checkAbility("canAccessSecrets", ["canAccessSecrets"]);
    expect(result.decision).toBe("pending_approval");
  });

  it("allows a granted medium-risk ability without approval", () => {
    const result = checkAbility("canWriteWorkspace", ["canWriteWorkspace"]);
    expect(result.decision).toBe("allowed");
  });

  it("prioritizes denial over pending approval", () => {
    expect(
      overallDecision([
        checkAbility("canRunCommand", ["canRunCommand"]),
        checkAbility("canAccessSecrets", []),
      ]),
    ).toBe("denied");
  });

  it("returns pending approval when there are no denied abilities", () => {
    expect(
      overallDecision([
        checkAbility("canRunCommand", ["canRunCommand"]),
        checkAbility("canWriteWorkspace", ["canWriteWorkspace"]),
      ]),
    ).toBe("pending_approval");
  });

  it("allows an action when every required ability is allowed", () => {
    expect(
      overallDecision([
        checkAbility("canReadWorkspace", ["canReadWorkspace"]),
        checkAbility("canWriteWorkspace", ["canWriteWorkspace"]),
      ]),
    ).toBe("allowed");
  });
});
