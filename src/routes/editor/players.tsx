import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { analysisStore, useAnalysisStore } from "@/stores/analysis-store";
import { useUiStore } from "@/stores/ui-store";

export const Route = createFileRoute("/editor/players")({
  component: PlayersPage,
});

function PlayersPage() {
  const canonical = useAnalysisStore((s) => s.canonical);
  const manualMode = useUiStore((s) => s.manualMode);
  const setInspectedTarget = useUiStore((s) => s.setInspectedTarget);
  const players = Object.values(canonical.players);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState<
    "primary" | "involuntary" | "background" | "internal" | "gatekeeper"
  >("primary");
  const [draftDescription, setDraftDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function beginEdit(playerId: string): void {
    const player = canonical.players[playerId];
    if (!player) return;
    setEditingPlayerId(playerId);
    setDraftName(player.name);
    setDraftRole(player.role ?? "primary");
    setDraftDescription(player.metadata?.description ?? "");
    setError(null);
  }

  function saveEdit(): void {
    if (!editingPlayerId || !draftName.trim()) return;

    const result = analysisStore.getState().dispatch({
      kind: "update_player",
      payload: {
        id: editingPlayerId,
        name: draftName.trim(),
        role: draftRole,
        metadata: draftDescription.trim()
          ? { description: draftDescription.trim() }
          : undefined,
      },
    });

    if (result.status !== "committed") {
      setError(
        result.status === "rejected"
          ? result.errors.join(", ") || "Could not update player."
          : "Could not update player.",
      );
      return;
    }

    setEditingPlayerId(null);
    setError(null);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Players</h2>
      <p className="text-muted-foreground mb-6">
        Strategic actors identified in the analysis.
      </p>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {players.length === 0 ? (
        <p className="text-muted-foreground italic">
          No players identified yet. Run Phase 2 to identify players.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {players.map((player) => (
            <div
              key={player.id}
              role="button"
              tabIndex={0}
              className="rounded-lg border border-border bg-card p-4 cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() =>
                setInspectedTarget({ entityType: "player", entityId: player.id })
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }
                event.preventDefault();
                setInspectedTarget({ entityType: "player", entityId: player.id });
              }}
            >
              {editingPlayerId === player.id ? (
                <div className="space-y-3">
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <select
                    value={draftRole}
                    onChange={(event) =>
                      setDraftRole(event.target.value as typeof draftRole)
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="primary">Primary</option>
                    <option value="gatekeeper">Gatekeeper</option>
                    <option value="internal">Internal</option>
                    <option value="background">Background</option>
                    <option value="involuntary">Involuntary</option>
                  </select>
                  <textarea
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPlayerId(null)}
                      className="rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium mb-1">{player.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        {player.role ?? "unknown"} · {player.type}
                      </p>
                    </div>
                    {manualMode && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          beginEdit(player.id);
                        }}
                        className="rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {player.metadata?.description && (
                    <p className="text-sm text-muted-foreground">
                      {player.metadata.description}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
