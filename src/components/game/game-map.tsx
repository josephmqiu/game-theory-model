/**
 * Game map — overview of all games, players, and their relationships.
 */

import { useAnalysisStore } from "@/stores/analysis-store";
import { Gamepad2, Users, ArrowRight } from "lucide-react";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function GameMap() {
  const canonical = useAnalysisStore((s) => s.canonical);
  const games = Object.values(canonical.games);
  const players = canonical.players;
  const crossGameLinks = Object.values(canonical.cross_game_links);
  const setInspectedTarget = useUiStore((s) => s.setInspectedTarget);

  if (games.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        No games in the model. Run Phase 3 to identify games.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {games.map((game) => {
          const gamePlayers = game.players
            .map((pid) => players[pid])
            .filter(Boolean);
          const formalizations = game.formalizations
            .map((fid) => canonical.formalizations[fid])
            .filter(Boolean);

          return (
            <div
              key={game.id}
              role="button"
              tabIndex={0}
              className={cn(
                "rounded-lg border border-border bg-card p-4 cursor-pointer",
                "hover:bg-accent/40 transition-colors",
              )}
              onClick={() =>
                setInspectedTarget({ entityType: "game", entityId: game.id })
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }
                event.preventDefault();
                setInspectedTarget({ entityType: "game", entityId: game.id });
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 size={16} className="text-primary" />
                <h3 className="text-sm font-medium">{game.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {game.description}
              </p>
              <div className="flex items-center gap-1 mb-2">
                <Users size={12} className="text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {gamePlayers.map((p) => (
                    <span
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      className="text-xs px-1.5 py-0.5 rounded bg-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        setInspectedTarget({
                          entityType: "player",
                          entityId: p.id,
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        setInspectedTarget({
                          entityType: "player",
                          entityId: p.id,
                        });
                      }}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                  {formalizations.map((f) => (
                    <span
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        setInspectedTarget({
                          entityType: "formalization",
                          entityId: f.id,
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        setInspectedTarget({
                          entityType: "formalization",
                          entityId: f.id,
                        });
                      }}
                    >
                      {f.kind}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {crossGameLinks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Cross-Game Links ({crossGameLinks.length})
          </h3>
          <div className="space-y-2">
            {crossGameLinks.map((link) => (
              <div
                key={link.id}
                role="button"
                tabIndex={0}
                className="flex items-center gap-2 rounded border border-border bg-card p-2 cursor-pointer"
                onClick={() =>
                  setInspectedTarget({
                    entityType: "cross_game_link",
                    entityId: link.id,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }
                  event.preventDefault();
                  setInspectedTarget({
                    entityType: "cross_game_link",
                    entityId: link.id,
                  });
                }}
              >
                <span className="text-xs font-mono">
                  {canonical.games[link.source_game_id]?.name ??
                    link.source_game_id}
                </span>
                <ArrowRight size={12} className="text-muted-foreground" />
                <span className="text-xs font-mono">
                  {canonical.games[link.target_game_id]?.name ??
                    link.target_game_id}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {link.effect_type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
