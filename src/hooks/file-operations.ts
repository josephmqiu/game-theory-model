/**
 * File operations — save/load .gta.json files.
 * All reads go through the /api/files/load endpoint (migration + Zod validation).
 */

import { analysisStore } from "@/stores/analysis-store";
import { pipelineStore } from "@/stores/pipeline-store";
import { conversationStore } from "@/stores/conversation-store";
import { playStore, type PlaySession } from "@/stores/play-store";
import { storeToAnalysisFile } from "shared/game-theory/utils/serialization";
import type { AnalysisFile } from "shared/game-theory/types/file";

interface LoadedAnalysisResponse {
  success: boolean;
  store?: unknown;
  meta?: {
    name: string;
    description?: string;
    metadata?: AnalysisFile["metadata"];
  };
  error?: string;
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
  };

  const analysisFile = storeToAnalysisFile(state.canonical, {
    name: meta.name,
    description: meta.description,
    created_at: timestamp,
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
            description: result.meta?.description,
            metadata,
            dirty: false,
          },
        );
      pipelineStore.getState().resetPipeline();
      conversationStore.getState().resetConversation();
      playStore
        .getState()
        .replaceSessions(deserializePlaySessions(metadata.play_sessions));
    } else {
      console.error("Load failed:", result.error);
    }
  } catch (err) {
    console.error("Load failed:", err);
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
