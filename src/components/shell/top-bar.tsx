/**
 * Top bar — app title, undo/redo, save, model selector.
 */

import { Undo2, Redo2, Save, Settings, Target } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAnalysisStore, analysisStore } from "@/stores/analysis-store";
import {
  PROVIDER_LABELS,
  useConnectedModels,
  useModelAutoFallback,
} from "@/hooks/use-model-auto-fallback";
import { aiStore, useAiStore } from "@/stores/ai-store";
import type { AIProviderType } from "@/types/agent-settings";

export function TopBar() {
  const navigate = useNavigate();
  const fileMeta = useAnalysisStore((s) => s.fileMeta);
  const canUndo = useAnalysisStore((s) => s.eventLog.cursor > 0);
  const canRedo = useAnalysisStore(
    (s) => s.eventLog.cursor < s.eventLog.events.length,
  );
  const provider = useAiStore((s) => s.provider);
  const connectedModels = useConnectedModels();
  useModelAutoFallback();

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
      <div className="flex items-center gap-2 app-region-no-drag electron-traffic-light-pad">
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

        {connectedModels.length > 0 ? (
          <select
            value={`${provider.provider}:${provider.modelId}`}
            onChange={(e) => {
              const [nextProvider, ...rest] = e.target.value.split(":");
              const nextModelId = rest.join(":");
              aiStore.getState().setProvider({
                provider: nextProvider as AIProviderType,
                modelId: nextModelId,
              });
            }}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            aria-label="AI model"
          >
            {connectedModels.map((model) => (
              <option
                key={`${model.provider}:${model.value}`}
                value={`${model.provider}:${model.value}`}
              >
                {PROVIDER_LABELS[model.provider]} / {model.displayName}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">No AI connected</span>
        )}
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
