import { createFileRoute } from "@tanstack/react-router";
import { GameMap } from "@/components/game/game-map";

export const Route = createFileRoute("/editor/game-map")({
  component: GameMapPage,
});

function GameMapPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Game Map</h2>
        <p className="text-muted-foreground">
          Cross-game structure, attached players, and formalization coverage.
        </p>
      </div>
      <GameMap />
    </div>
  );
}
