/**
 * Top bar — app title, undo/redo, save, AI toggle.
 */

import {
  Undo2,
  Redo2,
  Save,
  MessageSquare,
  Settings,
  Target,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAnalysisStore, analysisStore } from "@/stores/analysis-store";
import { useUiStore } from "@/stores/ui-store";

export function TopBar() {
  const navigate = useNavigate();
  const fileMeta = useAnalysisStore((s) => s.fileMeta);
  const canUndo = useAnalysisStore((s) => s.eventLog.cursor > 0);
  const canRedo = useAnalysisStore(
    (s) => s.eventLog.cursor < s.eventLog.events.length,
  );
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
  const toggleAiPanel = useUiStore((s) => s.toggleAiPanel);

  function handleUndo() {
    analysisStore.getState().undo();
  }

  function handleRedo() {
    analysisStore.getState().redo();
  }

  function handleSave() {
    // File save handled by keyboard shortcuts / electron menu
    // This is a visual indicator + manual trigger
    const meta = analysisStore.getState().fileMeta;
    if (meta.filePath) {
      window.dispatchEvent(new CustomEvent("gta:save"));
    } else {
      window.dispatchEvent(new CustomEvent("gta:save-as"));
    }
  }

  return (
    <header className="h-10 flex items-center justify-between border-b border-border px-4 shrink-0 app-region-drag">
      <div className="flex items-center gap-2 app-region-no-drag">
        <Target size={16} className="text-primary" />
        <span className="text-sm font-medium">
          {fileMeta.name}
          {fileMeta.dirty ? " *" : ""}
        </span>
      </div>

      <div className="flex items-center gap-1 app-region-no-drag">
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-30"
          title="Undo (⌘Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-30"
          title="Redo (⌘⇧Z)"
        >
          <Redo2 size={14} />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          onClick={handleSave}
          disabled={!fileMeta.dirty}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-30"
          title="Save (⌘S)"
        >
          <Save size={14} />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          onClick={toggleAiPanel}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            aiPanelOpen
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <MessageSquare size={14} />
          AI
        </button>
        <button
          type="button"
          onClick={() => void navigate({ to: "/settings" })}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
}
