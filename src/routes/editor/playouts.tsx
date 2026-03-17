import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { executeAppCommand } from "@/services/app-command-runner";
import { useAnalysisStore } from "@/stores/analysis-store";
import { usePlayStore, type PlaySession, type PlaySessionTurn } from "@/stores/play-store";

export const Route = createFileRoute("/editor/playouts")({
  component: PlayoutsPage,
});

interface SessionTreeItem {
  session: PlaySession;
  depth: number;
}

interface SessionPlayerTotals {
  total: number;
  aiControlled: number;
  manual: number;
}

const SESSION_STATUS_STYLES: Record<PlaySession["status"], string> = {
  active: "bg-blue-500/10 text-blue-500",
  completed: "bg-secondary text-muted-foreground",
};

function buildSessionTree(sessions: PlaySession[]): SessionTreeItem[] {
  const byId = new Map<string, PlaySession>(
    sessions.map((session) => [session.id, session]),
  );

  const children = new Map<string, PlaySession[]>();
  const roots: PlaySession[] = [];

  for (const session of sessions) {
    if (session.sourceSessionId && byId.has(session.sourceSessionId)) {
      const bucket = children.get(session.sourceSessionId) ?? [];
      bucket.push(session);
      children.set(session.sourceSessionId, bucket);
    } else {
      roots.push(session);
    }
  }

  for (const bucket of children.values()) {
    bucket.sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
      return leftTime - rightTime;
    });
  }

  roots.sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
    return leftTime - rightTime;
  });

  const ordered: SessionTreeItem[] = [];
  const seen = new Set<string>();

  const walk = (session: PlaySession, depth: number): void => {
    if (seen.has(session.id)) {
      return;
    }
    seen.add(session.id);
    ordered.push({ session, depth });
    for (const child of children.get(session.id) ?? []) {
      walk(child, depth + 1);
    }
  };

  for (const root of roots) {
    walk(root, 0);
  }

  return ordered;
}

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function getSessionPlayerTotals(
  session: PlaySession,
  scenarioPlayers: string[],
): SessionPlayerTotals {
  const aiControlled = session.aiControlledPlayers.filter((id) =>
    scenarioPlayers.includes(id),
  ).length;
  const total = scenarioPlayers.length;
  return {
    total,
    aiControlled,
    manual: total - aiControlled,
  };
}

export function PlayoutsPage() {
  const canonical = useAnalysisStore((state) => state.canonical);
  const scenarios = useAnalysisStore((s) => Object.values(s.canonical.scenarios));
  const players = useAnalysisStore((s) => s.canonical.players);
  const sessions = usePlayStore((s) => Object.values(s.sessions));
  const activeSessionId = usePlayStore((s) => s.activeSessionId);
  const setActiveSession = usePlayStore((s) => s.setActiveSession);
  const setSessionStatus = usePlayStore((s) => s.setSessionStatus);
  const setSessionBranchLabel = usePlayStore((s) => s.setSessionBranchLabel);
  const setSessionAiPlayers = usePlayStore((s) => s.setAiControlledPlayers);
  const deleteSession = usePlayStore((s) => s.deleteSession);
  const activeSession = usePlayStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null,
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [newSessionBranchLabel, setNewSessionBranchLabel] = useState("main");
  const [selectedAiPlayers, setSelectedAiPlayers] = useState<string[]>([]);
  const [turnPlayerId, setTurnPlayerId] = useState<string>("");
  const [turnAction, setTurnAction] = useState("");
  const [turnReasoning, setTurnReasoning] = useState("");
  const [branchLabel, setBranchLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scenarioById = useMemo(
    () => new Map(scenarios.map((scenario) => [scenario.id, scenario])),
    [scenarios],
  );
  const scenarioTree = useMemo(() => buildSessionTree(sessions), [sessions]);

  const selectedScenario = scenarioById.get(selectedScenarioId) ?? null;
  const selectedScenarioPlayers = useMemo(() => {
    if (!selectedScenario) return [];
    const formalization = canonical.formalizations[selectedScenario.formalization_id];
    if (!formalization) return [];
    const game = canonical.games[formalization.game_id];
    return (game?.players ?? []).map((id) => players[id]).filter(Boolean);
  }, [canonical.formalizations, canonical.games, players, selectedScenario]);

  const activeScenario = activeSession ? scenarioById.get(activeSession.scenarioId) : null;
  const activeScenarioPlayers = useMemo(() => {
    if (!activeScenario) return [];
    const formalization = canonical.formalizations[activeScenario.formalization_id];
    if (!formalization) return [];
    const game = canonical.games[formalization.game_id];
    return (game?.players ?? []).map((id) => players[id]).filter(Boolean);
  }, [activeScenario, canonical.formalizations, canonical.games, players]);

  const availableManualPlayers = useMemo(() => {
    if (!activeSession) return [];
    return activeScenarioPlayers.filter(
      (player) => !activeSession.aiControlledPlayers.includes(player.id),
    );
  }, [activeScenarioPlayers, activeSession]);

  useEffect(() => {
    if (!activeSession) {
      setTurnPlayerId("");
      return;
    }
    if (!availableManualPlayers.some((player) => player.id === turnPlayerId)) {
      setTurnPlayerId(availableManualPlayers[0]?.id ?? "");
    }
  }, [activeSession, availableManualPlayers, turnPlayerId]);

  useEffect(() => {
    setSelectedAiPlayers([]);
  }, [selectedScenarioId]);

  useEffect(() => {
    if (!activeSession) {
      setTurnPlayerId("");
    }
  }, [activeSession]);

  function toggleListValue(list: string[], value: string, checked: boolean): string[] {
    const next = checked ? uniqueStrings([...list, value]) : list.filter((item) => item !== value);
    return next;
  }

  function clearError(): void {
    setError(null);
  }

  async function handleStartSession(): Promise<void> {
    if (!selectedScenarioId) return;
    clearError();

    try {
      const aiControlledPlayers = uniqueStrings(selectedAiPlayers);
      const result = (await executeAppCommand({
        type: "start_play_session",
        payload: {
          scenarioId: selectedScenarioId,
          aiControlledPlayers,
        },
      })) as PlaySession | null;

      if (result?.id) {
        setSessionBranchLabel({
          sessionId: result.id,
          branchLabel: newSessionBranchLabel.trim() || "main",
        });
      }
      setBranchLabel("");
      setNewSessionBranchLabel("main");
      setSelectedAiPlayers([]);
      setTurnPlayerId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start play session.");
    }
  }

  async function handlePlayTurn(): Promise<void> {
    if (!activeSessionId || !turnPlayerId || !turnAction.trim()) return;
    clearError();

    if (activeSession?.status !== "active") {
      setError("A session must be active to record turns.");
      return;
    }

    if (activeSession.aiControlledPlayers.includes(turnPlayerId)) {
      setError("That player is marked AI-controlled for this session.");
      return;
    }

    try {
      await executeAppCommand({
        type: "play_turn",
        payload: {
          sessionId: activeSessionId,
          playerId: turnPlayerId,
          action: turnAction.trim(),
          reasoning: turnReasoning.trim() || undefined,
        },
      });
      setTurnAction("");
      setTurnReasoning("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record play turn.");
    }
  }

  async function handleBranchSession(): Promise<void> {
    if (!activeSessionId || !branchLabel.trim()) return;
    clearError();
    try {
      await executeAppCommand({
        type: "branch_play_session",
        payload: {
          sessionId: activeSessionId,
          branchLabel: branchLabel.trim(),
        },
      });
      setBranchLabel("");
      setTurnPlayerId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not branch session.");
    }
  }

  function handleToggleSessionStatus(
    sessionId: string,
    status: PlaySession["status"],
  ): void {
    setSessionStatus({
      sessionId,
      status,
    });
  }

  function handleDeleteSession(sessionId: string): void {
    if (!window.confirm("Delete this play session?")) return;
    deleteSession(sessionId);
    if (activeSessionId === sessionId) {
      setTurnPlayerId("");
    }
  }

  function handleActiveSessionAiToggle(playerId: string, checked: boolean): void {
    if (!activeSession) return;
    setSessionAiPlayers({
      sessionId: activeSession.id,
      aiControlledPlayers: toggleListValue(activeSession.aiControlledPlayers, playerId, checked),
    });
  }

  const activeSessionTurnPlayerName = useMemo(() => {
    if (!activeSession) return "—";
    const player = players[turnPlayerId];
    if (player) return player.name;
    return "Select player";
  }, [activeSession, players, turnPlayerId]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Play-outs</h2>
        <p className="text-muted-foreground">
          Start scenario sessions, choose AI/manual player control, and run turn-by-turn
          play-outs with branch and review paths.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-2 block font-medium">Scenario</span>
            <select
              value={selectedScenarioId}
              onChange={(event) => setSelectedScenarioId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">Select a scenario</option>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:w-52">
            <span className="mb-2 block font-medium">Branch label</span>
            <input
              value={newSessionBranchLabel}
              onChange={(event) => setNewSessionBranchLabel(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="main"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleStartSession()}
            disabled={!selectedScenarioId}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Start session
          </button>
        </div>

        <div className="mt-4 rounded-md border border-border/80 bg-background p-3">
          <h4 className="mb-2 text-sm font-medium">AI-controlled players</h4>
          {selectedScenarioPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This scenario has no mapped game players yet.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {selectedScenarioPlayers.map((player) => {
                const checked = selectedAiPlayers.includes(player.id);
                return (
                  <label
                    key={player.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setSelectedAiPlayers((current) =>
                          toggleListValue(current, player.id, event.target.checked),
                        )
                      }
                    />
                    <span>{player.name}</span>
                  </label>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Checked players will be marked as AI-controlled. Others will be manual.
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Sessions
          </h3>
          {sessions.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No play sessions yet.</p>
          ) : (
            scenarioTree.map(({ session, depth }) => {
              const scenario = scenarioById.get(session.scenarioId);
              const formalization = scenario
                ? canonical.formalizations[scenario.formalization_id]
                : null;
              const game = formalization ? canonical.games[formalization.game_id] : null;
              const gamePlayers = game?.players ?? [];
              const totals = getSessionPlayerTotals(session, gamePlayers);

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveSession(session.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    activeSessionId === session.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                  style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {session.branchLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scenario?.name ?? session.scenarioId}
                      {session.sourceSessionId ? ` · branch of ${session.sourceSessionId}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {game?.name ?? game?.id ?? "Unlinked scenario"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {totals.total} players · {totals.aiControlled} AI / {totals.manual} manual
                    </p>
                  </div>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] ${SESSION_STATUS_STYLES[session.status]}`}
                  >
                    {session.status}
                  </span>
                </button>
              );
            })
          )}
        </aside>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          {!activeSession ? (
            <p className="text-sm italic text-muted-foreground">
              Choose a session to inspect controls and record turns.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {scenarioById.get(activeSession.scenarioId)?.name ??
                    activeSession.scenarioId}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    Branch: {activeSession.branchLabel}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                      SESSION_STATUS_STYLES[activeSession.status]
                    }`}
                  >
                    {activeSession.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {activeSession.turns.length} recorded turn
                    {activeSession.turns.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="text-sm">
                  <span className="mb-2 block font-medium">Create branch</span>
                  <input
                    value={branchLabel}
                    onChange={(event) => setBranchLabel(event.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                    placeholder="Escalation branch"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleBranchSession()}
                  disabled={!branchLabel.trim()}
                  className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
                >
                  Branch session
                </button>
              </div>

              <div className="grid gap-3">
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="mb-2 text-sm font-medium">Player control</p>
                  <p className="text-xs text-muted-foreground">
                    Checked players are AI-driven; unchecked are available for manual turns.
                  </p>
                  {activeScenarioPlayers.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No players available for this scenario.
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {activeScenarioPlayers.map((player) => (
                        <label
                          key={player.id}
                          className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={activeSession.aiControlledPlayers.includes(player.id)}
                            onChange={(event) =>
                              handleActiveSessionAiToggle(player.id, event.target.checked)
                            }
                          />
                          <span>{player.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleSessionStatus(
                        activeSession.id,
                        activeSession.status === "active" ? "completed" : "active",
                      )
                    }
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    {activeSession.status === "active" ? "Mark completed" : "Reopen session"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(activeSession.id)}
                    className="rounded-md border border-border px-4 py-2 text-sm"
                  >
                    Delete session
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
                <label className="text-sm">
                  <span className="mb-2 block font-medium">Player (manual)</span>
                  <select
                    value={turnPlayerId}
                    onChange={(event) => setTurnPlayerId(event.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                    disabled={activeScenarioPlayers.length === 0 || availableManualPlayers.length === 0}
                  >
                    <option value="">Select player</option>
                    {availableManualPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-2 block font-medium">Action</span>
                  <input
                    value={turnAction}
                    onChange={(event) => setTurnAction(event.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                    placeholder="Describe the move or decision"
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-2 block font-medium">Reasoning</span>
                <textarea
                  value={turnReasoning}
                  onChange={(event) => setTurnReasoning(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="Optional explanation or branch note"
                />
              </label>

              <button
                type="button"
                onClick={() => void handlePlayTurn()}
                disabled={
                  activeSession.status !== "active" ||
                  !turnPlayerId ||
                  !turnAction.trim() ||
                  availableManualPlayers.length === 0
                }
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                Record turn
              </button>
              {activeScenarioPlayers.length > 0 &&
                availableManualPlayers.length === 0 &&
                activeSession.status === "active" && (
                  <p className="text-xs text-amber-500">
                    All scenario players are marked AI-controlled. Unmark at least one player
                    above to record manual turns.
                  </p>
                )}
              <p className="text-xs text-muted-foreground">
                Turn target:&nbsp;
                <span className="font-medium text-foreground">{activeSessionTurnPlayerName}</span>
              </p>

              <div className="space-y-3">
                {activeSession.turns.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">No turns recorded yet.</p>
                ) : (
                  activeSession.turns.map((turn: PlaySessionTurn, index: number) => (
                    <article
                      key={turn.id}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          Turn {index + 1}: {players[turn.playerId]?.name ?? turn.playerId}
                          {turn.controlMode === "ai" ? " (AI)" : " (manual)"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTime(turn.timestamp)}</p>
                      </div>
                      <p className="mt-2 text-sm">{turn.action}</p>
                      {turn.reasoning && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {turn.reasoning}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
