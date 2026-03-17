/**
 * File operations — save/load .gta.json files.
 * All reads go through the /api/files/load endpoint (migration + Zod validation).
 */

import { analysisStore } from "@/stores/analysis-store";
import { pipelineStore } from "@/stores/pipeline-store";
import { conversationStore } from "@/stores/conversation-store";
import { playStore, type PlaySession } from "@/stores/play-store";
import { recoveryStore } from "@/stores/recovery-store";
import { storeToAnalysisFile } from "shared/game-theory/utils/serialization";
import type { AnalysisFile } from "shared/game-theory/types/file";

interface LoadedAnalysisResponse {
  success: boolean;
  store?: unknown;
  meta?: {
    name: string;
    createdAt?: string;
    description?: string;
    metadata?: AnalysisFile["metadata"];
  };
  stage?: string;
  error?: string;
  issues?: string[];
}

interface PersistedWorkflowState {
  pipeline?: {
    analysis_state?: ReturnType<
      typeof pipelineStore.getState
    >["analysis_state"];
    phase_executions?: ReturnType<
      typeof pipelineStore.getState
    >["phase_executions"];
    phase_results?: ReturnType<typeof pipelineStore.getState>["phase_results"];
    steering_messages?: ReturnType<
      typeof pipelineStore.getState
    >["steering_messages"];
    proposal_review?: ReturnType<
      typeof pipelineStore.getState
    >["proposal_review"];
  };
  runtime?: {
    prompt_registry?: ReturnType<
      typeof pipelineStore.getState
    >["prompt_registry"];
    pending_revalidation_approvals?: ReturnType<
      typeof pipelineStore.getState
    >["pending_revalidation_approvals"];
    active_rerun_cycle?: ReturnType<
      typeof pipelineStore.getState
    >["active_rerun_cycle"];
  };
  conversation?: {
    messages?: ReturnType<typeof conversationStore.getState>["messages"];
    proposal_review?: ReturnType<
      typeof conversationStore.getState
    >["proposal_review"];
    proposals_by_id?: ReturnType<
      typeof conversationStore.getState
    >["proposals_by_id"];
  };
  play?: {
    active_session_id?: string | null;
  };
}

function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

function buildSerializedAnalysis(): string {
  const state = analysisStore.getState();
  const meta = state.fileMeta;
  const timestamp = new Date().toISOString();
  const playSessions = Object.values(playStore.getState().sessions);
  const persistedMetadata: AnalysisFile["metadata"] = {
    ...(meta.metadata ?? { tags: [] }),
    tags: meta.metadata?.tags ?? [],
    play_sessions: serializePlaySessions(playSessions),
    workflow_state: buildWorkflowState() as Record<string, unknown>,
  };

  const analysisFile = storeToAnalysisFile(state.canonical, {
    name: meta.name,
    description: meta.description,
    created_at: meta.createdAt ?? timestamp,
    updated_at: timestamp,
    metadata: persistedMetadata,
  });

  return JSON.stringify(analysisFile, null, 2);
}

function resetWorkspaceState(): void {
  pipelineStore.getState().resetPipeline();
  conversationStore.getState().resetConversation();
  playStore.getState().reset();
}

function buildWorkflowState(): PersistedWorkflowState {
  const pipeline = pipelineStore.getState();
  const conversation = conversationStore.getState();
  const play = playStore.getState();

  return {
    pipeline: {
      analysis_state: pipeline.analysis_state,
      phase_executions: pipeline.phase_executions,
      phase_results: pipeline.phase_results,
      steering_messages: pipeline.steering_messages,
      proposal_review: pipeline.proposal_review,
    },
    runtime: {
      prompt_registry: pipeline.prompt_registry,
      pending_revalidation_approvals: pipeline.pending_revalidation_approvals,
      active_rerun_cycle: pipeline.active_rerun_cycle,
    },
    conversation: {
      messages: conversation.messages,
      proposal_review: conversation.proposal_review,
      proposals_by_id: conversation.proposals_by_id,
    },
    play: {
      active_session_id: play.activeSessionId,
    },
  };
}

function serializePlaySessions(
  sessions: PlaySession[],
): NonNullable<AnalysisFile["metadata"]["play_sessions"]> {
  return sessions.map((session) => ({
    id: session.id,
    scenario_id: session.scenarioId,
    ai_controlled_players: session.aiControlledPlayers,
    branch_label: session.branchLabel,
    status: session.status,
    turns: session.turns.map((turn) => ({
      id: turn.id,
      player_id: turn.playerId,
      action: turn.action,
      reasoning: turn.reasoning,
      control_mode: turn.controlMode,
      timestamp: turn.timestamp,
    })),
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    source_session_id: session.sourceSessionId ?? null,
  }));
}

function deserializePlaySessions(
  sessions: AnalysisFile["metadata"]["play_sessions"] | undefined,
): PlaySession[] {
  return (
    sessions?.map((session) => ({
      id: session.id,
      scenarioId: session.scenario_id,
      aiControlledPlayers: session.ai_controlled_players,
      branchLabel: session.branch_label,
      status: session.status,
      turns: session.turns.map((turn) => ({
        id: turn.id,
        playerId: turn.player_id,
        action: turn.action,
        reasoning: turn.reasoning,
        controlMode: turn.control_mode,
        timestamp: turn.timestamp,
      })),
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      sourceSessionId: session.source_session_id ?? null,
    })) ?? []
  );
}

function readWorkflowState(
  metadata: AnalysisFile["metadata"] | undefined,
): PersistedWorkflowState | null {
  const raw = metadata?.workflow_state;
  if (!raw || typeof raw !== "object") return null;
  return raw as PersistedWorkflowState;
}

// ── Save ──

export async function saveFile(saveAs = false): Promise<void> {
  const state = analysisStore.getState();
  const meta = state.fileMeta;
  const serialized = buildSerializedAnalysis();

  try {
    if (isElectron()) {
      const filePath =
        !meta.filePath || saveAs
          ? await window.electronAPI!.saveFile(
              serialized,
              `${meta.name}.gta.json`,
            )
          : await window.electronAPI!.saveToPath(meta.filePath, serialized);

      if (!filePath) return;

      analysisStore.getState().setFileMeta({
        filePath,
        dirty: false,
      });
      return;
    }

    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta.name}.gta.json`;
    a.click();
    URL.revokeObjectURL(url);
    analysisStore.getState().setFileMeta({ dirty: false });
  } catch (err) {
    console.error("Save failed:", err);
  }
}

// ── Load ──

export async function loadFileFromContent(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    const response = await fetch("/api/files/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    const result = (await response.json()) as LoadedAnalysisResponse;

    if (result.success && result.store) {
      const metadata = result.meta?.metadata ?? { tags: [] };
      analysisStore
        .getState()
        .loadCanonical(
          result.store as ReturnType<
            typeof analysisStore.getState
          >["canonical"],
          {
            filePath,
            name: result.meta?.name ?? "Loaded Analysis",
            createdAt: result.meta?.createdAt ?? null,
            description: result.meta?.description,
            metadata,
            dirty: false,
          },
        );
      const workflowState = readWorkflowState(metadata);
      pipelineStore.getState().restoreSnapshot({
        analysis_state: workflowState?.pipeline?.analysis_state ?? null,
        phase_executions: workflowState?.pipeline?.phase_executions ?? {},
        phase_results: workflowState?.pipeline?.phase_results ?? {},
        steering_messages: workflowState?.pipeline?.steering_messages ?? [],
        proposal_review: workflowState?.pipeline?.proposal_review ?? null,
        prompt_registry:
          workflowState?.runtime?.prompt_registry ??
          pipelineStore.getState().prompt_registry,
        pending_revalidation_approvals:
          workflowState?.runtime?.pending_revalidation_approvals ?? {},
        active_rerun_cycle: workflowState?.runtime?.active_rerun_cycle ?? null,
      });
      conversationStore.getState().restoreSnapshot({
        messages: workflowState?.conversation?.messages ?? [],
        proposal_review:
          workflowState?.conversation?.proposal_review ??
          conversationStore.getState().proposal_review,
        proposals_by_id: workflowState?.conversation?.proposals_by_id ?? {},
      });
      playStore
        .getState()
        .replaceSessions(
          deserializePlaySessions(metadata.play_sessions),
          workflowState?.play?.active_session_id ?? null,
        );
    } else {
      const stage = result.stage as
        | "parse"
        | "migration"
        | "validation"
        | "structural"
        | undefined;
      if (stage) {
        recoveryStore.getState().enterRecovery({
          stage,
          error: {
            message: result.error ?? "File could not be loaded.",
            issues: result.issues?.map(String),
          },
          rawContent: content,
          filePath,
        });
      } else {
        recoveryStore.getState().enterRecovery({
          stage: "parse",
          error: {
            message: result.error ?? "File could not be loaded.",
          },
          rawContent: content,
          filePath,
        });
      }
    }
  } catch (err) {
    recoveryStore.getState().enterRecovery({
      stage: "parse",
      error: {
        message: err instanceof Error ? err.message : "Failed to load file.",
      },
      rawContent: content,
      filePath,
    });
  }
}

export async function loadFile(): Promise<void> {
  if (isElectron()) {
    const file = await window.electronAPI!.openFile();
    if (!file) return;
    await loadFileFromContent(file.filePath, file.content);
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".gta.json";

  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });

  if (!file) return;

  await loadFileFromContent(file.name, await file.text());
}

// ── Event listeners ──

export function setupFileEventListeners(): () => void {
  function handleSave() {
    saveFile();
  }
  function handleSaveAs() {
    saveFile(true);
  }
  function handleOpen() {
    loadFile();
  }
  function handleNew() {
    analysisStore.getState().newAnalysis();
    resetWorkspaceState();
  }

  window.addEventListener("gta:save", handleSave);
  window.addEventListener("gta:save-as", handleSaveAs);
  window.addEventListener("gta:open", handleOpen);
  window.addEventListener("gta:new", handleNew);

  return () => {
    window.removeEventListener("gta:save", handleSave);
    window.removeEventListener("gta:save-as", handleSaveAs);
    window.removeEventListener("gta:open", handleOpen);
    window.removeEventListener("gta:new", handleNew);
  };
}
