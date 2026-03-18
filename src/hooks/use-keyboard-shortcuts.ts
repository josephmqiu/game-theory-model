import { useEffect } from "react";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import {
  saveEntityAnalysis,
  openEntityAnalysis,
} from "@/services/analysis/analysis-persistence";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;

      if (isMod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        const state = useEntityGraphStore.getState();
        if (state.isDirty) {
          const confirmed = window.confirm(
            "You have unsaved analysis changes. Discard them and start a new analysis?",
          );
          if (!confirmed) return;
        }
        useEntityGraphStore.getState().newAnalysis("");
        return;
      }

      if (isMod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveEntityAnalysis();
        return;
      }

      if (isMod && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openEntityAnalysis();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
