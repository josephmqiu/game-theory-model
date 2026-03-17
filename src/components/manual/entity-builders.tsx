import { useState } from "react";
import { generateEntityId } from "shared/game-theory/engine/id-generator";
import type { NormalFormModel } from "shared/game-theory/types/formalizations";
import {
  assertCommitted,
  isoNow,
  type BuilderProps,
  type BuilderWithCanonicalProps,
  type SourceKind,
  type SourceQuality,
} from "./workbench-utils";

// ---------------------------------------------------------------------------
// GameBuilder
// ---------------------------------------------------------------------------

export function GameBuilder({ run }: BuilderProps) {
  const [gameName, setGameName] = useState("");
  const [gameDescription, setGameDescription] = useState("");

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="text-sm">
        <span className="mb-2 block font-medium">Game name</span>
        <input
          value={gameName}
          onChange={(event) => setGameName(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="US-China tariff bargaining"
        />
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Description</span>
        <input
          value={gameDescription}
          onChange={(event) => setGameDescription(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="Core strategic interaction and stakes"
        />
      </label>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={!gameName.trim() || !gameDescription.trim()}
        onClick={() =>
          run(() => {
            assertCommitted({
              kind: "add_game",
              id: generateEntityId("game"),
              payload: {
                name: gameName.trim(),
                description: gameDescription.trim(),
                semantic_labels: ["custom"],
                players: [],
                status: "active",
                formalizations: [],
                coupling_links: [],
                key_assumptions: [],
                created_at: isoNow(),
                updated_at: isoNow(),
              },
            });
            setGameName("");
            setGameDescription("");
          }, "Game created.")
        }
      >
        Add game
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormalizationBuilder
// ---------------------------------------------------------------------------

interface FormalizationBuilderProps extends BuilderWithCanonicalProps {
  readonly onFormalizationCreated: (id: string) => void;
}

export function FormalizationBuilder({
  run,
  canonical,
  onFormalizationCreated,
}: FormalizationBuilderProps) {
  const [formalizationGameId, setFormalizationGameId] = useState("");
  const games = Object.values(canonical.games);

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <label className="text-sm">
        <span className="mb-2 block font-medium">Attach to game</span>
        <select
          value={formalizationGameId}
          onChange={(event) => setFormalizationGameId(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">Select game</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={!formalizationGameId}
        onClick={() =>
          run(() => {
            const formalizationId = generateEntityId("formalization");
            const formalizationPayload: Omit<NormalFormModel, "id"> = {
              game_id: formalizationGameId,
              kind: "normal_form",
              purpose: "computational",
              abstraction_level: "minimal",
              assumptions: [],
              strategies: {},
              payoff_cells: [],
            };
            assertCommitted({
              kind: "add_formalization",
              id: formalizationId,
              payload: formalizationPayload,
            });
            assertCommitted({
              kind: "attach_formalization_to_game",
              payload: {
                game_id: formalizationGameId,
                formalization_id: formalizationId,
              },
            });
            onFormalizationCreated(formalizationId);
          }, "Normal-form formalization created.")
        }
      >
        Add formalization
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerBuilder
// ---------------------------------------------------------------------------

export function PlayerBuilder({ run, canonical }: BuilderWithCanonicalProps) {
  const [playerName, setPlayerName] = useState("");
  const [playerDescription, setPlayerDescription] = useState("");
  const [playerType, setPlayerType] = useState<
    "state" | "organization" | "individual" | "coalition" | "market" | "public"
  >("state");
  const [playerRole, setPlayerRole] = useState<
    "primary" | "involuntary" | "background" | "internal" | "gatekeeper"
  >("primary");
  const [playerGameId, setPlayerGameId] = useState("");

  const games = Object.values(canonical.games);

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm">
        <span className="mb-2 block font-medium">Player name</span>
        <input
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="Treasury Department"
        />
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Player type</span>
        <select
          value={playerType}
          onChange={(event) =>
            setPlayerType(event.target.value as typeof playerType)
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="state">State</option>
          <option value="organization">Organization</option>
          <option value="individual">Individual</option>
          <option value="coalition">Coalition</option>
          <option value="market">Market</option>
          <option value="public">Public</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Role</span>
        <select
          value={playerRole}
          onChange={(event) =>
            setPlayerRole(event.target.value as typeof playerRole)
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="primary">Primary</option>
          <option value="gatekeeper">Gatekeeper</option>
          <option value="internal">Internal</option>
          <option value="background">Background</option>
          <option value="involuntary">Involuntary</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Attach to game</span>
        <select
          value={playerGameId}
          onChange={(event) => setPlayerGameId(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">Optional</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm md:col-span-2">
        <span className="mb-2 block font-medium">Description</span>
        <textarea
          value={playerDescription}
          onChange={(event) => setPlayerDescription(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="What this player wants, fears, or controls"
        />
      </label>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 md:col-span-2"
        disabled={!playerName.trim()}
        onClick={() =>
          run(() => {
            const playerId = generateEntityId("player");
            assertCommitted({
              kind: "add_player",
              id: playerId,
              payload: {
                name: playerName.trim(),
                type: playerType,
                objectives: [],
                constraints: [],
                role: playerRole,
                metadata: playerDescription.trim()
                  ? { description: playerDescription.trim() }
                  : undefined,
              },
            });
            if (playerGameId) {
              assertCommitted({
                kind: "attach_player_to_game",
                payload: {
                  game_id: playerGameId,
                  player_id: playerId,
                },
              });
            }
            setPlayerName("");
            setPlayerDescription("");
          }, "Player created.")
        }
      >
        Add player
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceBuilder
// ---------------------------------------------------------------------------

export function SourceBuilder({ run }: BuilderProps) {
  const [sourceKind, setSourceKind] = useState<SourceKind>("article");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePublisher, setSourcePublisher] = useState("");
  const [sourceQualityRating, setSourceQualityRating] =
    useState<SourceQuality>("medium");
  const [sourceNotes, setSourceNotes] = useState("");

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm">
        <span className="mb-2 block font-medium">Source kind</span>
        <select
          value={sourceKind}
          onChange={(event) => setSourceKind(event.target.value as SourceKind)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="article">Article</option>
          <option value="report">Report</option>
          <option value="web">Web</option>
          <option value="pdf">PDF</option>
          <option value="transcript">Transcript</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Quality</span>
        <select
          value={sourceQualityRating}
          onChange={(event) =>
            setSourceQualityRating(event.target.value as SourceQuality)
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Title</span>
        <input
          value={sourceTitle}
          onChange={(event) => setSourceTitle(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="IMF country risk update"
        />
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Publisher</span>
        <input
          value={sourcePublisher}
          onChange={(event) => setSourcePublisher(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="IMF"
        />
      </label>
      <label className="text-sm md:col-span-2">
        <span className="mb-2 block font-medium">URL</span>
        <input
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="https://example.com/report"
        />
      </label>
      <label className="text-sm md:col-span-2">
        <span className="mb-2 block font-medium">Notes</span>
        <textarea
          value={sourceNotes}
          onChange={(event) => setSourceNotes(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="Why this source matters or what it covers"
        />
      </label>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 md:col-span-2"
        disabled={!sourceTitle.trim()}
        onClick={() =>
          run(() => {
            assertCommitted({
              kind: "add_source",
              id: generateEntityId("source"),
              payload: {
                kind: sourceKind,
                title: sourceTitle.trim(),
                url: sourceUrl.trim() || undefined,
                publisher: sourcePublisher.trim() || undefined,
                captured_at: isoNow(),
                quality_rating: sourceQualityRating,
                notes: sourceNotes.trim() || undefined,
              },
            });
            setSourceTitle("");
            setSourceUrl("");
            setSourcePublisher("");
            setSourceNotes("");
          }, "Source created.")
        }
      >
        Add source
      </button>
    </div>
  );
}
