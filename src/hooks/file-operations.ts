/**
 * File operations — save/load .gta.json files.
 * All reads go through the /api/files/load endpoint (migration + Zod validation).
 * All writes go through the /api/files/save endpoint (storeToAnalysisFile).
 * Adapted from OpenPencil's file-operations.ts for .gta.json files.
 */

import { analysisStore } from "@/stores/analysis-store";
import { pipelineStore } from "@/stores/pipeline-store";
import { conversationStore } from "@/stores/conversation-store";

function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

// ── Save ──

export async function saveFile(saveAs = false): Promise<void> {
  const state = analysisStore.getState();
  const meta = state.fileMeta;

  let filePath = meta.filePath;

  if (!filePath || saveAs) {
    if (isElectron()) {
      filePath =
        (await window.electronAPI!.showSaveDialog?.({
          defaultPath: `${meta.name}.gta.json`,
          filters: [{ name: "Game Theory Analysis", extensions: ["gta.json"] }],
        })) ?? null;
    } else {
      // Browser fallback — download
      const json = JSON.stringify(state.canonical, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meta.name}.gta.json`;
      a.click();
      URL.revokeObjectURL(url);
      analysisStore.getState().setFileMeta({ dirty: false });
      return;
    }

    if (!filePath) return; // User cancelled
  }

  try {
    const response = await fetch("/api/files/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath,
        store: state.canonical,
        meta: {
          name: meta.name,
          description: meta.description ?? "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    });

    const result = (await response.json()) as {
      success: boolean;
      error?: string;
    };

    if (result.success) {
      analysisStore.getState().setFileMeta({
        filePath,
        dirty: false,
      });
    } else {
      console.error("Save failed:", result.error);
    }
  } catch (err) {
    console.error("Save failed:", err);
  }
}

// ── Load ──

export async function loadFile(): Promise<void> {
  let filePath: string | null = null;
  let content: string | null = null;

  if (isElectron()) {
    filePath =
      (await window.electronAPI!.showOpenDialog?.({
        filters: [{ name: "Game Theory Analysis", extensions: ["gta.json"] }],
      })) ?? null;

    if (!filePath) return;

    content = (await window.electronAPI!.readFile?.(filePath)) ?? null;
    if (!content) return;
  } else {
    // Browser fallback — file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".gta.json";

    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });

    if (!file) return;

    content = await file.text();
    filePath = file.name;
  }

  try {
    const response = await fetch("/api/files/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    const result = (await response.json()) as {
      success: boolean;
      store?: unknown;
      meta?: { name: string; description?: string };
      error?: string;
    };

    if (result.success && result.store) {
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
            dirty: false,
          },
        );
      pipelineStore.getState().resetPipeline();
      conversationStore.getState().resetConversation();
    } else {
      console.error("Load failed:", result.error);
    }
  } catch (err) {
    console.error("Load failed:", err);
  }
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
    pipelineStore.getState().resetPipeline();
    conversationStore.getState().resetConversation();
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
