import { describe, expect, it } from "vitest";
import { buildTestApp } from "./test-helpers.js";

describe("policy enforcement via direct API calls (bypassing the UI)", () => {
  async function createAgent(app: Awaited<ReturnType<typeof buildTestApp>>) {
    const response = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "test-agent" },
    });
    expect(response.statusCode).toBe(201);
    return response.json().agent as { id: string; abilities: Record<string, boolean> };
  }

  async function waitForRun(app: Awaited<ReturnType<typeof buildTestApp>>, runId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await app.inject({ method: "GET", url: `/api/runs/${runId}` });
      const run = response.json().run;
      if (!["queued", "running"].includes(run.status)) return run;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Run ${runId} did not finish in time`);
  }

  it("exposes the secure default ability configuration", async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/api/abilities" });
    expect(response.statusCode).toBe(200);
    expect(response.json().abilities).toEqual({
      canReadWorkspace: true,
      canWriteWorkspace: true,
      canRunCommand: false,
      canAccessSecrets: false,
      canUseNetwork: false,
      canJoinSession: false,
    });
    await app.close();
  });

  it("denies a high-risk action when the ability is ungranted", async () => {
    const app = await buildTestApp();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "test-agent" },
    });
    const { agent } = createRes.json();

    const msgRes = await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "eve" },
      payload: { content: "run the build command" },
    });

    expect(msgRes.statusCode).toBe(403);
    await app.close();
  });

  it("puts a granted high-risk action into pending_approval, not allowed", async () => {
    const app = await buildTestApp();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "test-agent" },
    });
    const { agent } = createRes.json();

    await app.inject({
      method: "PATCH",
      url: `/api/agents/${agent.id}/abilities`,
      headers: { "x-user-id": "alice" },
      payload: { canRunCommand: true },
    });

    const msgRes = await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "alice" },
      payload: { content: "run the build command" },
    });

    expect(msgRes.statusCode).toBe(202);
    expect(msgRes.json().run.status).toBe("pending_approval");
    await app.close();
  });

  it("allows a medium-risk workspace write when it is granted by default", async () => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    const response = await app.inject({
      method: "POST", url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "alice" }, payload: { content: "create a report file" },
    });
    expect(response.statusCode).toBe(202);
    expect((await waitForRun(app, response.json().run.id)).status).toBe("completed");
    await app.close();
  });

  it.each([
    ["read a .env file", "canAccessSecrets"],
    ["fetch https://example.com", "canUseNetwork"],
  ])("denies an ungranted sensitive action (%s)", async (content) => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    const response = await app.inject({
      method: "POST", url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "eve" }, payload: { content },
    });
    expect(response.statusCode).toBe(403);
    const audit = (await app.inject({ method: "GET", url: "/api/auditEvents" })).json().events;
    expect(audit.some((event: { agentId: string; userId: string; decision: string }) =>
      event.agentId === agent.id && event.userId === "eve" && event.decision === "denied")).toBe(true);
    await app.close();
  });

  it("requires approval for a granted critical secrets action", async () => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    const update = await app.inject({
      method: "PATCH", url: `/api/agents/${agent.id}/abilities`,
      headers: { "x-user-id": "admin" }, payload: { canAccessSecrets: true },
    });
    expect(update.statusCode).toBe(200);
    const response = await app.inject({
      method: "POST", url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "alice" }, payload: { content: "read the .env secret" },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().run.status).toBe("pending_approval");
    const pending = await app.inject({ method: "GET", url: "/api/runs/pendingApprovals" });
    expect(pending.json().runs.map((run: { id: string }) => run.id)).toContain(response.json().run.id);
    await app.close();
  });

  it("revokes an ability and enforces the revocation", async () => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    await app.inject({ method: "PATCH", url: `/api/agents/${agent.id}/abilities`, headers: { "x-user-id": "admin" }, payload: { canWriteWorkspace: false } });
    const response = await app.inject({
      method: "POST", url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "alice" }, payload: { content: "create a report file" },
    });
    expect(response.statusCode).toBe(403);
    const current = (await app.inject({ method: "GET", url: `/api/agents/${agent.id}` })).json().agent;
    expect(current.abilities.canWriteWorkspace).toBe(false);
    await app.close();
  });

  it("denies a mixed action when one required ability is missing", async () => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    await app.inject({ method: "PATCH", url: `/api/agents/${agent.id}/abilities`, headers: { "x-user-id": "admin" }, payload: { canRunCommand: true } });
    const response = await app.inject({
      method: "POST", url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "alice" }, payload: { content: "run the build and fetch https://example.com" },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("a different user approving unblocks the pending run", async () => {
    const app = await buildTestApp();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "test-agent" },
    });
    const { agent } = createRes.json();

    await app.inject({
      method: "PATCH",
      url: `/api/agents/${agent.id}/abilities`,
      headers: { "x-user-id": "alice" },
      payload: { canRunCommand: true },
    });

    const msgRes = await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "alice" },
      payload: { content: "run the build command" },
    });
    const runId = msgRes.json().run.id;

    const approveRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/approve`,
      headers: { "x-user-id": "bob" },
      payload: { isApprove: true },
    });
    expect(approveRes.statusCode).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 50)); // let the async run finish against FakeRunner

    const runRes = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}`,
    });
    expect(runRes.json().run.status).toBe("completed");
    const pending = await app.inject({ method: "GET", url: "/api/runs/pendingApprovals" });
    expect(pending.json().runs).toEqual([]);
    await app.close();
  });

  it("denial via approval endpoint marks the run denied", async () => {
    const app = await buildTestApp();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "test-agent" },
    });
    const { agent } = createRes.json();

    await app.inject({
      method: "PATCH",
      url: `/api/agents/${agent.id}/abilities`,
      headers: { "x-user-id": "alice" },
      payload: { canRunCommand: true },
    });

    const msgRes = await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "alice" },
      payload: { content: "run the build command" },
    });
    const runId = msgRes.json().run.id;

    await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/approve`,
      headers: { "x-user-id": "bob" },
      payload: { isApprove: false },
    });

    const runRes = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}`,
    });
    expect(runRes.json().run.status).toBe("denied");
    const pending = await app.inject({ method: "GET", url: "/api/runs/pendingApprovals" });
    expect(pending.json().runs).toEqual([]);
    await app.close();
  });

  it("uses anonymous as the audit actor when no user header is supplied", async () => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    const response = await app.inject({
      method: "POST", url: `/api/agents/${agent.id}/messages`,
      payload: { content: "run the build command" },
    });
    expect(response.statusCode).toBe(403);
    const events = (await app.inject({ method: "GET", url: "/api/auditEvents" })).json().events;
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ agentId: agent.id, userId: "anonymous", decision: "denied" }),
    ]));
    await app.close();
  });

  it("rejects invalid ability and approval payloads", async () => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    const invalidAbility = await app.inject({
      method: "PATCH", url: `/api/agents/${agent.id}/abilities`, payload: { canRunCommand: "yes" },
    });
    expect(invalidAbility.statusCode).toBe(400);
    const invalidApproval = await app.inject({
      method: "POST", url: "/api/runs/00000000-0000-0000-0000-000000000000/approve", payload: {},
    });
    expect(invalidApproval.statusCode).toBe(400);
    await app.close();
  });

  it("rejects approving a run that is no longer pending", async () => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    const response = await app.inject({
      method: "POST", url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "eve" }, payload: { content: "run the build command" },
    });
    expect(response.statusCode).toBe(403);
    const runId = (await app.inject({ method: "GET", url: `/api/agents/${agent.id}/runs` })).json().runs[0].id;
    const approval = await app.inject({
      method: "POST", url: `/api/runs/${runId}/approve`,
      headers: { "x-user-id": "bob" }, payload: { isApprove: true },
    });
    expect(approval.statusCode).toBe(409);
    await app.close();
  });

  it("records ability changes and approval decisions with the acting users", async () => {
    const app = await buildTestApp();
    const agent = await createAgent(app);
    await app.inject({ method: "PATCH", url: `/api/agents/${agent.id}/abilities`, headers: { "x-user-id": "admin" }, payload: { canRunCommand: true } });
    const message = await app.inject({ method: "POST", url: `/api/agents/${agent.id}/messages`, headers: { "x-user-id": "alice" }, payload: { content: "run the build command" } });
    const runId = message.json().run.id;
    await app.inject({ method: "POST", url: `/api/runs/${runId}/approve`, headers: { "x-user-id": "bob" }, payload: { isApprove: false } });
    const events = (await app.inject({ method: "GET", url: "/api/auditEvents" })).json().events;
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: "admin", action: "grant:canRunCommand", decision: "allowed" }),
      expect.objectContaining({ userId: "bob", action: "deny_run", decision: "denied", runId }),
    ]));
    await app.close();
  });

  it("records an audit trail entry attributing the denial to the right user", async () => {
    const app = await buildTestApp();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "test-agent" },
    });
    const { agent } = createRes.json();

    await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/messages`,
      headers: { "x-user-id": "eve" },
      payload: { content: "run the build command" },
    });

    const auditRes = await app.inject({
      method: "GET",
      url: "/api/auditEvents",
    });
    const events = auditRes.json().events;

    expect(
      events.some(
        (e: { agentId: string; userId: string; decision: string }) =>
          e.agentId === agent.id &&
          e.userId === "eve" &&
          e.decision === "denied",
      ),
    ).toBe(true);

    await app.close();
  });
});
