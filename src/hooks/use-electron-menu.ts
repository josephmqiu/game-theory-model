/**
 * Electron native menu listener — dispatches menu actions to stores.
 * Adapted from OpenPencil's use-electron-menu.ts for .gta.json files.
 */

import { useEffect } from "react";
import { analysisStore } from "@/stores/analysis-store";
import { pipelineStore } from "@/stores/pipeline-store";
import { conversationStore } from "@/stores/conversation-store";
import { saveFile, loadFile } from "@/hooks/file-operations";

function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

export function useElectronMenu(): void {
  useEffect(() => {
    if (!isElectron()) return;

    const api = window.electronAPI!;

    function handleMenuAction(action: string) {
      switch (action) {
        case "new":
          analysisStore.getState().newAnalysis();
          pipelineStore.getState().resetPipeline();
          conversationStore.getState().resetConversation();
          break;
        case "open":
          loadFile();
          break;
        case "save":
          saveFile();
          break;
        case "save-as":
          saveFile(true);
          break;
        case "undo":
          analysisStore.getState().undo();
          break;
        case "redo":
          analysisStore.getState().redo();
          break;
      }
    }

    // Listen for menu actions from main process
    const cleanup = api.onMenuAction?.(handleMenuAction);

    // Handle file open from OS file association
    const cleanupOpen = api.onOpenFile?.(async (filePath: string) => {
      try {
        const content = await api.readFile?.(filePath);
        if (content) {
          await loadFileFromContent(filePath, content);
        }
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    });

    // Check for pending file (cold start)
    api.getPendingFile?.().then(async (filePath: string | null) => {
      if (filePath) {
        try {
          const content = await api.readFile?.(filePath);
          if (content) {
            await loadFileFromContent(filePath, content);
          }
        } catch (err) {
          console.error("Failed to open pending file:", err);
        }
      }
    });

    return () => {
      if (typeof cleanup === "function") cleanup();
      if (typeof cleanupOpen === "function") cleanupOpen();
    };
  }, []);
}

async function loadFileFromContent(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    const response = await fetch("/api/files/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    const result = (await response.json()) as {
      success: boolean;
      store?: unknown;
      meta?: { name: string };
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
            dirty: false,
          },
        );
    }
  } catch (err) {
    console.error("Failed to parse analysis file:", err);
  }
}

// Extend window for Electron IPC
declare global {
  interface Window {
    electronAPI?: {
      onMenuAction?: (callback: (action: string) => void) => () => void;
      onOpenFile?: (callback: (path: string) => void) => () => void;
      getPendingFile?: () => Promise<string | null>;
      readFile?: (path: string) => Promise<string>;
      showSaveDialog?: (options: {
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<string | null>;
      showOpenDialog?: (options: {
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<string | null>;
    };
  }
}
