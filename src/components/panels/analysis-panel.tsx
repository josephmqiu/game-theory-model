import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAnalysisStore } from '@/stores/analysis-store'

function parsePayoffInput(value: string): number | null {
  if (value.trim().length === 0) {
    return null
  }

  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : null
}

function getValidationSummary(
  issueCount: number,
  incompleteCount: number,
): string {
  if (issueCount > 0) {
    return `${issueCount} issue${issueCount === 1 ? '' : 's'} to fix`
  }

  if (incompleteCount > 0) {
    return `${incompleteCount} payoff cell${incompleteCount === 1 ? '' : 's'} still incomplete`
  }

  return 'Analysis is complete'
}

export default function AnalysisPanel() {
  const analysis = useAnalysisStore((state) => state.analysis)
  const validation = useAnalysisStore((state) => state.validation)
  const renameAnalysis = useAnalysisStore((state) => state.renameAnalysis)
  const renamePlayer = useAnalysisStore((state) => state.renamePlayer)
  const addStrategy = useAnalysisStore((state) => state.addStrategy)
  const renameStrategy = useAnalysisStore((state) => state.renameStrategy)
  const removeStrategy = useAnalysisStore((state) => state.removeStrategy)
  const setPayoff = useAnalysisStore((state) => state.setPayoff)

  const [player1, player2] = analysis.players
  const issueCount = validation.issues.length
  const incompleteCount = validation.incompleteProfiles.length

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">
                Canonical Analysis
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Two-player normal-form game
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Phase 2 keeps this analysis in session memory only. Save, load,
                solver logic, and AI-assisted workflows are intentionally
                deferred to later phases.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Analysis title
              </span>
              <input
                aria-label="Analysis title"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                value={analysis.name}
                onChange={(event) => renameAnalysis(event.target.value)}
                placeholder="Untitled Analysis"
              />
            </label>
          </div>

          <div
            className={`min-w-[240px] rounded-2xl border px-4 py-4 ${
              validation.isValid
                ? validation.isComplete
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
                : 'border-rose-500/40 bg-rose-500/10'
            }`}
            data-testid="analysis-status"
          >
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Status
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {getValidationSummary(issueCount, incompleteCount)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {validation.isValid
                ? validation.isComplete
                  ? 'Every profile has a payoff pair.'
                  : 'Fill every payoff cell before moving on.'
                : 'Fix the naming issues below to keep the model canonical.'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {analysis.players.map((player, playerIndex) => (
            <section
              key={player.id}
              className="rounded-2xl border border-border/70 bg-background/60 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Player {playerIndex + 1}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ordered strategies define the payoff matrix axes.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addStrategy(player.id)}
                >
                  <Plus />
                  Add Strategy
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Player name
                  </span>
                  <input
                    aria-label={`Player ${playerIndex + 1} name`}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                    value={player.name}
                    onChange={(event) =>
                      renamePlayer(player.id, event.target.value)
                    }
                    placeholder={`Player ${playerIndex + 1}`}
                  />
                </label>

                <div className="space-y-3">
                  {player.strategies.map((strategy, strategyIndex) => (
                    <div
                      key={strategy.id}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-3"
                    >
                      <div className="w-8 shrink-0 text-center text-xs font-medium text-muted-foreground">
                        {strategyIndex + 1}
                      </div>
                      <input
                        aria-label={`Player ${playerIndex + 1} strategy ${strategyIndex + 1}`}
                        className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
                        value={strategy.name}
                        onChange={(event) =>
                          renameStrategy(
                            player.id,
                            strategy.id,
                            event.target.value,
                          )
                        }
                        placeholder={`Strategy ${strategyIndex + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove Player ${playerIndex + 1} strategy ${strategyIndex + 1}`}
                        onClick={() => removeStrategy(player.id, strategy.id)}
                        disabled={player.strategies.length <= 1}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Payoff matrix
            </p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">
              Profiles and payoffs
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Each cell stores a payoff pair in player order: ({player1.name || 'Player 1'}, {player2.name || 'Player 2'}).
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-2">
            <thead>
              <tr>
                <th className="min-w-[180px] rounded-xl bg-background px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {player1.name || 'Player 1'}
                </th>
                {player2.strategies.map((strategy, strategyIndex) => (
                  <th
                    key={strategy.id}
                    className="min-w-[220px] rounded-xl bg-background px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {strategy.name.trim() || `Strategy ${strategyIndex + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {player1.strategies.map((player1Strategy, rowIndex) => (
                <tr key={player1Strategy.id}>
                  <th className="rounded-xl bg-background px-4 py-4 text-left align-top">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {player1Strategy.name.trim() || `Strategy ${rowIndex + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {player1.name || 'Player 1'} strategy
                      </p>
                    </div>
                  </th>

                  {player2.strategies.map((player2Strategy, columnIndex) => {
                    const profile = analysis.profiles.find(
                      (candidate) =>
                        candidate.player1StrategyId === player1Strategy.id &&
                        candidate.player2StrategyId === player2Strategy.id,
                    )

                    return (
                      <td key={player2Strategy.id} className="align-top">
                        <div className="rounded-xl border border-border/70 bg-background p-4">
                          <div className="mb-3 text-xs text-muted-foreground">
                            {player1Strategy.name.trim() || `Strategy ${rowIndex + 1}`} vs{' '}
                            {player2Strategy.name.trim() || `Strategy ${columnIndex + 1}`}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-2">
                              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                {player1.name || 'Player 1'}
                              </span>
                              <input
                                aria-label={`${player1.name || 'Player 1'} payoff for ${player1Strategy.name || `Strategy ${rowIndex + 1}`} vs ${player2Strategy.name || `Strategy ${columnIndex + 1}`}`}
                                type="number"
                                inputMode="decimal"
                                step="any"
                                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                                value={profile?.payoffs[0] ?? ''}
                                onChange={(event) =>
                                  setPayoff(
                                    player1Strategy.id,
                                    player2Strategy.id,
                                    player1.id,
                                    parsePayoffInput(event.target.value),
                                  )
                                }
                                placeholder="Payoff"
                              />
                            </label>

                            <label className="space-y-2">
                              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                {player2.name || 'Player 2'}
                              </span>
                              <input
                                aria-label={`${player2.name || 'Player 2'} payoff for ${player1Strategy.name || `Strategy ${rowIndex + 1}`} vs ${player2Strategy.name || `Strategy ${columnIndex + 1}`}`}
                                type="number"
                                inputMode="decimal"
                                step="any"
                                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                                value={profile?.payoffs[1] ?? ''}
                                onChange={(event) =>
                                  setPayoff(
                                    player1Strategy.id,
                                    player2Strategy.id,
                                    player2.id,
                                    parsePayoffInput(event.target.value),
                                  )
                                }
                                placeholder="Payoff"
                              />
                            </label>
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(issueCount > 0 || incompleteCount > 0) && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
            {issueCount > 0 && (
              <div className="flex-1">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                  Model issues
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {validation.issues.map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {incompleteCount > 0 && (
              <div className="flex-1">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                  Remaining work
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {incompleteCount} payoff cell{incompleteCount === 1 ? '' : 's'} still
                  need both player values.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
