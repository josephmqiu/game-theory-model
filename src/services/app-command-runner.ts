import { createPipelineHostFromStores } from "@/services/pipeline-host";
import { createPipelineOrchestrator } from "shared/game-theory/pipeline/orchestrator";
import type {
  AppCommandEnvelope,
  AppCommandPayloadMap,
  AppCommandType,
  SendChatCommandResult,
} from "shared/game-theory/types/command-bus";
import { acceptConversationProposal } from "@/stores/proposal-actions";
import { analysisStore } from "@/stores/analysis-store";
import { conversationStore } from "@/stores/conversation-store";
import { playStore } from "@/stores/play-store";
import type { AIStreamChunk } from "shared/game-theory/types/ai-stream";

const pipelineController = createPipelineOrchestrator(
  createPipelineHostFromStores(),
);

function findNextRunnablePhase(): number {
  const analysisState = analysisStore.getState();
  const pipelineState = pipelineController.getState();

  if (!pipelineState) {
    if (Object.keys(analysisState.canonical.games).length > 0) {
      return 6;
    }
    throw new Error("Start an analysis before running the next phase.");
  }

  for (let phase = 1; phase <= 10; phase += 1) {
    const phaseState = pipelineState.phase_states[phase];
    if (!phaseState || phaseState.status === "pending" || phaseState.status === "needs_rerun") {
      return phase;
    }
  }

  return 10;
}

export async function sendChatCommand(
  payload: AppCommandPayloadMap["send_chat"],
  options?: {
    onChunk?: (chunk: AIStreamChunk, snapshot: { content: string; thinking: string[] }) => void;
  },
): Promise<SendChatCommandResult> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Response body is not readable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const thinking: string[] = [];
  const chunks: AIStreamChunk[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      let parsed: AIStreamChunk;
      try {
        parsed = JSON.parse(line.slice(6)) as AIStreamChunk;
      } catch {
        continue;
      }

      chunks.push(parsed);

      if (parsed.type === "text") {
        content += parsed.content;
      } else if (parsed.type === "thinking") {
        if (thinking[thinking.length - 1] !== parsed.content) {
          thinking.push(parsed.content);
        }
      } else if (parsed.type === "error") {
        throw new Error(parsed.content || "Stream error from server");
      } else if (parsed.type === "done") {
        break;
      }

      options?.onChunk?.(parsed, {
        content,
        thinking: [...thinking],
      });
    }
  }

  const finalContent = content || "(No response)";
  conversationStore.getState().appendMessage({
    role: "ai",
    content: finalContent,
  });

  return {
    content: finalContent,
    thinking,
    chunks,
  };
}

export async function executeAppCommand<T extends AppCommandType>(
  command:
    | Pick<AppCommandEnvelope<T>, "type" | "payload">
    | AppCommandEnvelope<T>,
): Promise<unknown> {
  switch (command.type) {
    case "start_analysis":
      return pipelineController.startAnalysis(
        (command.payload as AppCommandPayloadMap["start_analysis"]).description,
        {
          manual:
            (command.payload as AppCommandPayloadMap["start_analysis"]).manual ??
            false,
        },
      );

    case "send_chat":
      return sendChatCommand(command.payload as AppCommandPayloadMap["send_chat"]);

    case "run_phase": {
      const payload = command.payload as AppCommandPayloadMap["run_phase"];
      return pipelineController.runPhase(payload.phase, payload.input);
    }

    case "run_next_phase":
      return pipelineController.runPhase(findNextRunnablePhase());

    case "approve_revalidation":
      return pipelineController.approveRevalidation(
        (command.payload as AppCommandPayloadMap["approve_revalidation"]).eventId,
      );

    case "dismiss_revalidation":
      pipelineController.dismissRevalidation(
        (command.payload as AppCommandPayloadMap["dismiss_revalidation"]).eventId,
      );
      return { success: true };

    case "apply_proposal": {
      const proposalId = (
        command.payload as AppCommandPayloadMap["apply_proposal"]
      ).proposalId;
      const result = acceptConversationProposal({
        proposalId,
        canonical: analysisStore.getState().canonical,
        currentPersistedRevision: analysisStore.getState().eventLog.cursor,
        dispatch: analysisStore.getState().dispatch,
      });

      if (result.status === "rejected") {
        throw new Error(result.errors.join(", "));
      }

      return result;
    }

    case "register_proposal_group": {
      const payload =
        command.payload as AppCommandPayloadMap["register_proposal_group"];
      const group = conversationStore.getState().registerProposalGroup({
        phase: payload.phase,
        content: payload.content,
        message_type: payload.messageType,
        proposals: payload.proposals,
      });
      return group;
    }

    case "start_play_session": {
      const payload = command.payload as AppCommandPayloadMap["start_play_session"];
      return playStore.getState().startSession({
        scenarioId: payload.scenarioId,
        aiControlledPlayers: payload.aiControlledPlayers,
      });
    }

    case "branch_play_session": {
      const payload = command.payload as AppCommandPayloadMap["branch_play_session"];
      return playStore.getState().branchSession({
        sessionId: payload.sessionId,
        branchLabel: payload.branchLabel,
      });
    }

    case "play_turn": {
      const payload = command.payload as AppCommandPayloadMap["play_turn"];
      return playStore.getState().playTurn({
        sessionId: payload.sessionId,
        playerId: payload.playerId,
        action: payload.action,
        reasoning: payload.reasoning,
      });
    }

    default:
      throw new Error(`Unsupported app command: ${(command as AppCommandEnvelope).type}`);
  }
}
