import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { z } from "zod";

import { defaultAgentAbilities } from "./abilities/permissions.js";
import { HttpError } from "./errors.js";
import { Ability } from "./types/abilities.js";
import { getKnownSecrets, redactSecrets } from "./utils/redaction.js";


import type { AgentService } from "./agent-service.js";
import type { AppConfig } from "./config.js";
import type { GroupTaskService } from "./group-task-service.js"; // add import

const agentIdParams = z.object({ id: z.string().uuid() });
const runIdParams = z.object({ id: z.string().uuid() });
const immuneEventIdParams = z.object({ id: z.string().uuid() });
const immuneReviewBody = z.object({ action: z.enum(["confirm", "dismiss"]) });
const createAgentBody = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional(),
  instructions: z.string().max(10_000).optional(),
});
const groupTaskIdParams = z.object({ id: z.string().uuid() });
const createGroupTaskBody = z.object({
  description: z.string().trim().min(1).max(20_000),
});
const updateAgentBody = createAgentBody
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );
const messageBody = z.object({
  content: z.string().trim().min(1).max(50_000),
});
const abilitiesBody = z.object({
  canReadWorkspace: z.boolean().optional(),
  canWriteWorkspace: z.boolean().optional(),
  canRunCommand: z.boolean().optional(),
  canAccessSecrets: z.boolean().optional(),
  canUseNetwork: z.boolean().optional(),
  canJoinSession: z.boolean().optional(),
});

const approvalBody = z.object({ isApprove: z.boolean() });

function getUserId(request: FastifyRequest): string {
  const header = request.headers["x-user-id"];
  return typeof header === "string" && header.trim()
    ? header.trim()
    : "anonymous";
}

export async function createApp(
  config: AppConfig,
  service: AgentService,
  groupTaskService: GroupTaskService,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    bodyLimit: 1_048_576,
  });

  await app.register(cors, {
    origin:
      config.nodeEnv === "development"
        ? ["http://localhost:5173", "http://127.0.0.1:5173"]
        : false,
  });

  app.addHook("onRequest", async (request, reply) => {
    if (
      !config.authToken ||
      !request.url.startsWith("/api/") ||
      request.url === "/api/health" ||
      request.url === "/api/auth"
    ) {
      return;
    }
    const header = request.headers.authorization ?? "";
    const candidate = header.startsWith("Bearer ") ? header.slice(7) : "";
    const expectedBuffer = Buffer.from(config.authToken);
    const candidateBuffer = Buffer.from(candidate);
    const valid =
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer);
    if (!valid) {
      return reply.code(401).send({ error: "Authentication required" });
    }
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "volc-agent-launchpad",
  }));

  app.get("/api/auth", async () => ({ required: config.authToken.length > 0 }));

  app.get("/api/system", async () => service.systemInfo());

  app.get("/api/agents", async () => ({ agents: service.listAgents() }));

  app.post("/api/agents", async (request, reply) => {
    const body = createAgentBody.parse(request.body);
    const agent = await service.createAgent(body);
    return reply.code(201).send({ agent });
  });

  app.get("/api/agents/:id", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { agent: service.getAgent(id) };
  });

  app.patch("/api/agents/:id", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    const body = updateAgentBody.parse(request.body);
    return { agent: await service.updateAgent(id, body) };
  });

  app.delete("/api/agents/:id", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return service.deleteAgent(id);
  });

  app.post("/api/agents/:id/start", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { agent: await service.startAgent(id) };
  });

  app.post("/api/agents/:id/stop", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { agent: await service.stopAgent(id) };
  });

  app.get("/api/agents/:id/messages", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { messages: service.getMessages(id) };
  });

  app.get("/api/agents/:id/runs", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { runs: service.getRuns(id) };
  });

  app.post("/api/agents/:id/messages", async (request, reply) => {
    const { id } = agentIdParams.parse(request.params);
    const body = messageBody.parse(request.body);
    const userId = getUserId(request);
    const result = await service.sendMessage(id, body.content, userId);
    return reply.code(202).send(result);
  });

  app.get("/api/runs", async () => {
    return { runs: service.getAllRuns() };
  });

  app.get("/api/runs/:id", async (request) => {
    const { id } = runIdParams.parse(request.params);
    return { run: service.getRun(id) };
  });

  app.get("/api/runs/:id/immune", async (request) => {
    const { id } = runIdParams.parse(request.params);
    return { event: service.getImmuneEventForRun(id) };
  });

  app.get("/api/agents/:id/immune-memories", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { memories: service.getImmuneMemories(id) };
  });

  app.post("/api/immune/events/:id/review", async (request) => {
    const { id } = immuneEventIdParams.parse(request.params);
    const body = immuneReviewBody.parse(request.body);
    return service.reviewImmuneEvent(id, body.action);
  });
  app.post("/api/group-tasks", async (request, reply) => {
    const body = createGroupTaskBody.parse(request.body);
    const userId = getUserId(request);
    const task = groupTaskService.createTask(body.description, userId);
    return reply.code(201).send({ task });
  });

  app.get("/api/group-tasks/:id", async (request) => {
    const { id } = groupTaskIdParams.parse(request.params);
    return { task: groupTaskService.getTask(id) };
  });

  // Get all abilities
  app.get("/api/abilities", async () => {
    return {
      abilities: defaultAgentAbilities,
    };
  });

  // Updates the permission of a specified Agent.
  app.patch("/api/agents/:id/abilities", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    const body = abilitiesBody.parse(request.body);

    const patch = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    ) as Partial<Record<Ability, boolean>>;

    const userId = getUserId(request);
    return { agent: await service.updateAbilities(id, patch, userId) };
  });

  // Shows the audit history for a specified Agent
  // Each event records who performed the action, which Agent was affected,
  // whether the policy allowed or denied it, and the reason for the decision.
  app.get("/api/agents/auditEvents", async () => {
    return { events: service.getAuditEvents() };
  });

  app.post("/api/runs/:id/approve", async (request) => {
    const { id } = runIdParams.parse(request.params);
    const body = approvalBody.parse(request.body);
    const userId = getUserId(request);
    return { run: await service.approveRun(id, userId, body.isApprove) };
  });

  app.get("/api/runs/pendingApprovals", async () => {
    return { runs: service.getPendingApprovals() };
  });

  if (config.nodeEnv === "production") {
    const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: "/",
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "API route not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  app.setErrorHandler((error, request, reply) => {
    const appError = error instanceof Error ? error : new Error(String(error));
    const validationError = error instanceof z.ZodError;
    const frameworkStatus =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null;
    const statusCode =
      error instanceof HttpError
        ? error.statusCode
        : validationError
          ? 400
          : frameworkStatus && frameworkStatus >= 400 && frameworkStatus <= 599
            ? frameworkStatus
            : 500;
    const safeMessage = redactSecrets(appError.message, getKnownSecrets());
    if (statusCode >= 500) {
      request.log.error({
        err: {
          name: appError.name,
          message: safeMessage,
          stack: appError.stack
            ? redactSecrets(appError.stack, getKnownSecrets())
            : undefined,
        },
      });
    }
    return reply.code(statusCode).send({
      error: safeMessage,
      ...(validationError ? { details: error.issues } : {}),
    });
  });

  return app;
}
