import { HttpError } from "./errors.js";
import {
  GroupTaskCoordinator,
  type GroupTaskState,
} from "./group-task-coordinator.js";
import { parseMentionedAgents } from "./mention-parser.js";

import type { AgentService } from "./agent-service.js";

export class GroupTaskService {
  private readonly tasks = new Map<string, GroupTaskCoordinator>();

  constructor(private readonly agentService: AgentService) {}

  createTask(description: string, userId: string): GroupTaskState {
    const knownAgents = this.agentService
      .listAgents()
      .map((agent) => ({ id: agent.id, name: agent.name }));
    const participants = parseMentionedAgents(description, knownAgents);

    if (participants.length < 1) {
      throw new HttpError(
        400,
        "Mention at least one existing Agent with @name in the task description",
      );
    }

    for (const participant of participants) {
      const { allowed, reason } = this.agentService.checkCanJoinSession(participant.id);
      if (!allowed) {
        throw new HttpError(
          403,
          `${participant.name} cannot join this group task: ${reason}`,
        );
      }
    }

    const coordinator = new GroupTaskCoordinator(
      this.agentService,
      description,
      participants,
      userId,
    );
    const initialState = coordinator.getState();
    this.tasks.set(initialState.id, coordinator);

    // Fire and forget, same pattern as AgentService.sendMessage — the
    // caller polls GET /api/group-tasks/:id for progress, same as Runs.
    void coordinator.run().catch(() => undefined);

    return initialState;
  }

  getTask(id: string): GroupTaskState {
    const coordinator = this.tasks.get(id);
    if (!coordinator) {
      throw new HttpError(404, "Group task not found");
    }
    return coordinator.getState();
  }
}
