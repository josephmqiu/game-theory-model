/**
 * Electron native menu listener — dispatches menu actions to stores.
 * Adapted from OpenPencil's use-electron-menu.ts for .gta.json files.
 */

import { useEffect } from "react";
import { analysisStore } from "@/stores/analysis-store";
import { pipelineStore } from "@/stores/pipeline-store";
import { conversationStore } from "@/stores/conversation-store";
import { playStore } from "@/stores/play-store";
import {
  saveFile,
  loadFile,
  loadFileFromContent,
} from "@/hooks/file-operations";

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
          playStore.getState().reset();
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
        const file = await api.readFile?.(filePath);
        if (file) {
          await loadFileFromContent(file.filePath, file.content);
        }
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    });

    // Check for pending file (cold start)
    api.getPendingFile?.().then(async (filePath: string | null) => {
      if (filePath) {
        try {
          const file = await api.readFile?.(filePath);
          if (file) {
            await loadFileFromContent(file.filePath, file.content);
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
