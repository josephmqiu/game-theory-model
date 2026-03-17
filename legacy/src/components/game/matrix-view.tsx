/**
 * Normal-form payoff matrix view.
 * Renders a table grid: row headers = player 1 strategies, column headers = player 2 strategies.
 * Cells show payoff pairs (p1, p2). Nash equilibria highlighted with primary color.
 */

import { useMemo } from "react";
import { Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/stores/analysis-store";
import type {
  NormalFormModel,
  Formalization,
} from "shared/game-theory/types/formalizations";
import type { NormalFormCell, EstimateValue } from "shared/game-theory/types";

interface MatrixViewProps {
  gameId: string;
  formalizationId: string;
}

function isNormalForm(f: Formalization): f is NormalFormModel {
  return f.kind === "normal_form";
}

function formatPayoff(estimate: EstimateValue): string {
  if (estimate.value != null) {
    return estimate.value.toFixed(1);
  }
  if (estimate.ordinal_rank != null) {
    return `#${estimate.ordinal_rank}`;
  }
  return "?";
}

function buildNashSet(
  cells: ReadonlyArray<NormalFormCell>,
  playerIds: [string, string],
  p1Strategies: ReadonlyArray<string>,
  p2Strategies: ReadonlyArray<string>,
): Set<string> {
  const nashKeys = new Set<string>();

  for (const cell of cells) {
    const s1 = cell.strategy_profile[playerIds[0]];
    const s2 = cell.strategy_profile[playerIds[1]];
    if (!s1 || !s2) continue;

    const p1Payoff = cell.payoffs[playerIds[0]]?.value ?? 0;
    const p2Payoff = cell.payoffs[playerIds[1]]?.value ?? 0;

    // P1 best response: hold s1 fixed, vary s2 — check P2 can't improve
    const p1BestResponse = p1Strategies.every((altS1) => {
      if (altS1 === s1) return true;
      const alt = cells.find(
        (c) =>
          c.strategy_profile[playerIds[0]] === altS1 &&
          c.strategy_profile[playerIds[1]] === s2,
      );
      return !alt || (alt.payoffs[playerIds[0]]?.value ?? 0) <= p1Payoff;
    });

    // P2 best response: hold s2 fixed, vary s1 — check P1 can't improve
    const p2BestResponse = p2Strategies.every((altS2) => {
      if (altS2 === s2) return true;
      const alt = cells.find(
        (c) =>
          c.strategy_profile[playerIds[0]] === s1 &&
          c.strategy_profile[playerIds[1]] === altS2,
      );
      return !alt || (alt.payoffs[playerIds[1]]?.value ?? 0) <= p2Payoff;
    });

    if (p1BestResponse && p2BestResponse) {
      nashKeys.add(`${s1}::${s2}`);
    }
  }

  return nashKeys;
}

export function MatrixView({ gameId, formalizationId }: MatrixViewProps) {
  const game = useAnalysisStore((s) => s.canonical.games[gameId]);
  const formalization = useAnalysisStore(
    (s) => s.canonical.formalizations[formalizationId],
  );
  const players = useAnalysisStore((s) => s.canonical.players);

  const matrix = useMemo(() => {
    if (!game || !formalization || !isNormalForm(formalization)) return null;

    const playerIds = game.players.slice(0, 2);
    if (playerIds.length < 2) return null;

    const [p1Id, p2Id] = playerIds as [string, string];
    const p1Strategies = formalization.strategies[p1Id] ?? [];
    const p2Strategies = formalization.strategies[p2Id] ?? [];

    const nashSet = buildNashSet(
      formalization.payoff_cells,
      [p1Id, p2Id],
      p1Strategies,
      p2Strategies,
    );

    const cellMap = new Map<string, NormalFormCell>();
    for (const cell of formalization.payoff_cells) {
      const key = `${cell.strategy_profile[p1Id]}::${cell.strategy_profile[p2Id]}`;
      cellMap.set(key, cell);
    }

    return {
      p1Id,
      p2Id,
      p1Name: players[p1Id]?.name ?? p1Id,
      p2Name: players[p2Id]?.name ?? p2Id,
      p1Strategies,
      p2Strategies,
      cellMap,
      nashSet,
    };
  }, [game, formalization, players]);

  if (!game) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Game not found
      </div>
    );
  }

  if (!formalization || !isNormalForm(formalization)) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        No normal-form formalization available
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Insufficient data to render matrix
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Grid3X3 className="h-4 w-4" />
        <span>{game.name}</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-muted/50 p-2 text-left text-xs font-medium text-muted-foreground">
                {matrix.p1Name} \ {matrix.p2Name}
              </th>
              {matrix.p2Strategies.map((s2) => (
                <th
                  key={s2}
                  className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {s2}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.p1Strategies.map((s1) => (
              <tr key={s1} className="border-t border-border">
                <td className="bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                  {s1}
                </td>
                {matrix.p2Strategies.map((s2) => {
                  const key = `${s1}::${s2}`;
                  const cell = matrix.cellMap.get(key);
                  const isNash = matrix.nashSet.has(key);

                  const p1Pay = cell?.payoffs[matrix.p1Id];
                  const p2Pay = cell?.payoffs[matrix.p2Id];

                  return (
                    <td
                      key={key}
                      className={cn(
                        "p-2 text-center font-mono text-xs",
                        isNash
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground",
                      )}
                    >
                      {cell ? (
                        <span>
                          {p1Pay ? formatPayoff(p1Pay) : "?"},{" "}
                          {p2Pay ? formatPayoff(p2Pay) : "?"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matrix.nashSet.size > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-primary">Highlighted cells</span>{" "}
          indicate Nash equilibria ({matrix.nashSet.size} found)
        </p>
      )}
    </div>
  );
}
