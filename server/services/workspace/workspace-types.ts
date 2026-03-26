import type { CommandReceipt } from "../command-bus";

export type ProviderSessionBindingPurpose = "chat" | "analysis" | "recovery";

export interface WorkspaceRecord {
  id: string;
  name: string;
  analysisType: string;
  filePath: string | null;
  workspaceJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface ThreadRecord {
  id: string;
  workspaceId: string;
  title: string;
  threadJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRecord {
  id: string;
  workspaceId: string;
  threadId: string;
  role: string;
  content: string;
  messageJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityRecord {
  id: string;
  workspaceId: string;
  threadId: string;
  runId: string | null;
  kind: string;
  activityJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface RunRecord {
  id: string;
  workspaceId: string;
  threadId: string;
  provider: string | null;
  model: string | null;
  effort: string | null;
  status: string;
  runJson: string;
  startedAt: number;
  finishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderSessionBindingRecord {
  threadId: string;
  purpose: ProviderSessionBindingPurpose;
  workspaceId: string;
  provider: string;
  providerSessionId: string;
  phaseTurnId: string | null;
  runId: string | null;
  bindingJson: string;
  updatedAt: number;
}

export type WorkspaceCommandReceipt = CommandReceipt;
