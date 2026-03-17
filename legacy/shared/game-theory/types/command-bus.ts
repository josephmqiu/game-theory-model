import type { EvidenceProposal, PhaseRunInput } from "./analysis-pipeline";
import type { AIStreamChunk } from "./ai-stream";

export type AppCommandType =
  | "start_analysis"
  | "run_full_analysis"
  | "send_chat"
  | "run_phase"
  | "run_next_phase"
  | "approve_revalidation"
  | "dismiss_revalidation"
  | "apply_proposal"
  | "register_proposal_group"
  | "start_play_session"
  | "branch_play_session"
  | "play_turn";

export interface PlaySessionTurnCommand {
  sessionId: string;
  playerId: string;
  action: string;
  reasoning?: string;
}

export interface PlaySessionStartCommand {
  scenarioId: string;
  aiControlledPlayers?: string[];
}

export interface PlaySessionBranchCommand {
  sessionId: string;
  branchLabel: string;
}

export interface AppCommandPayloadMap {
  start_analysis: {
    description: string;
    manual?: boolean;
  };
  run_full_analysis: {
    description: string;
  };
  send_chat: {
    system: string;
    provider: "anthropic" | "openai" | "opencode" | "copilot";
    model: string;
    messages: Array<{
      role: "user" | "assistant";
      content: string;
    }>;
  };
  run_phase: {
    phase: number;
    input?: PhaseRunInput;
  };
  run_next_phase: Record<string, never>;
  approve_revalidation: {
    eventId: string;
  };
  dismiss_revalidation: {
    eventId: string;
  };
  apply_proposal: {
    proposalId: string;
  };
  register_proposal_group: {
    phase: number;
    content: string;
    messageType?: "proposal" | "result" | "finding";
    proposals: EvidenceProposal[];
  };
  start_play_session: PlaySessionStartCommand;
  branch_play_session: PlaySessionBranchCommand;
  play_turn: PlaySessionTurnCommand;
}

export interface AppCommandEnvelope<T extends AppCommandType = AppCommandType> {
  id: string;
  type: T;
  payload: AppCommandPayloadMap[T];
  sourceClientId?: string | null;
  ownerClientId?: string | null;
  status: "queued" | "completed" | "failed";
  result?: unknown;
  error?: string | null;
  createdAt: string;
  claimedAt?: string | null;
  completedAt?: string | null;
}

export interface SendChatCommandResult {
  content: string;
  thinking: string[];
  chunks: AIStreamChunk[];
}
