import { createFileRoute } from "@tanstack/react-router";
import { useAnalysisStore } from "@/stores/analysis-store";

export const Route = createFileRoute("/editor/players")({
  component: PlayersPage,
});

function PlayersPage() {
  const canonical = useAnalysisStore((s) => s.canonical);
  const players = Object.values(canonical.players);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Players</h2>
      <p className="text-muted-foreground mb-6">
        Strategic actors identified in the analysis.
      </p>

      {players.length === 0 ? (
        <p className="text-muted-foreground italic">
          No players identified yet. Run Phase 2 to identify players.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {players.map((player) => (
            <div
              key={player.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <h3 className="font-medium mb-1">{player.name}</h3>
              <p className="text-xs text-muted-foreground mb-2">
                {player.role ?? "unknown"} · {player.type}
              </p>
              {player.metadata?.description && (
                <p className="text-sm text-muted-foreground">
                  {player.metadata.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
