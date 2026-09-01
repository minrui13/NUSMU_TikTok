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
  participants: { id: string; name: string }[];
  turns: GroupTaskTurn[];
  status: GroupTaskStatus;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}