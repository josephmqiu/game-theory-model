import { createFileRoute } from "@tanstack/react-router";
import { useAnalysisStore } from "@/stores/analysis-store";

export const Route = createFileRoute("/editor/game/$gameId")({
  component: GameDetailPage,
});

function GameDetailPage() {
  const { gameId } = Route.useParams();
  const canonical = useAnalysisStore((s) => s.canonical);
  const game = canonical.games[gameId];

  if (!game) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Game Not Found</h2>
        <p className="text-muted-foreground">
          No game with ID &quot;{gameId}&quot; exists in the canonical model.
        </p>
      </div>
    );
  }

  const players = game.players
    .map((pid) => canonical.players[pid])
    .filter(Boolean);
  const formalizations = game.formalizations
    .map((fid) => canonical.formalizations[fid])
    .filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">{game.name}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {game.canonical_game_type ?? game.status} · {game.description}
      </p>

      {/* Players */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Players ({players.length})
        </h3>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No players attached
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <span
                key={p.id}
                className="text-xs px-2 py-1 rounded-full bg-secondary"
              >
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Formalizations */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Formalizations ({formalizations.length})
        </h3>
        {formalizations.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No formalizations attached
          </p>
        ) : (
          <div className="space-y-3">
            {formalizations.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                    {f.kind}
                  </span>
                </div>
                <p className="text-sm">{f.notes ?? ""}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
