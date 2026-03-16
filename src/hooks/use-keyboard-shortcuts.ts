/**
 * Global keyboard shortcuts — undo, redo, save.
 * Adapted from OpenPencil's use-keyboard-shortcuts.ts, stripped to game theory essentials.
 */

import { useEffect } from "react";
import { analysisStore } from "@/stores/analysis-store";

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Cmd+S even in inputs
        if (!(isMod && e.key === "s")) return;
      }

      // Cmd+Z — Undo
      if (isMod && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        analysisStore.getState().undo();
        return;
      }

      // Cmd+Shift+Z — Redo
      if (isMod && e.shiftKey && e.key === "z") {
        e.preventDefault();
        analysisStore.getState().redo();
        return;
      }

      // Cmd+S — Save
      if (isMod && e.key === "s") {
        e.preventDefault();
        const meta = analysisStore.getState().fileMeta;
        if (meta.filePath) {
          window.dispatchEvent(new CustomEvent("gta:save"));
        } else {
          window.dispatchEvent(new CustomEvent("gta:save-as"));
        }
        return;
      }

      // Cmd+O — Open
      if (isMod && e.key === "o") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("gta:open"));
        return;
      }

      // Cmd+N — New
      if (isMod && e.key === "n") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("gta:new"));
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
