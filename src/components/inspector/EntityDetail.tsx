import type { ReactNode } from 'react'

import type { EntityRef, CanonicalStore, EntityType } from '../../types/canonical'
import { Badge, ConfidenceBadge, StaleBadge, Card, EstimateValueDisplay } from '../design-system'

interface EntityDetailProps {
  entityRef: EntityRef
  canonical: CanonicalStore
}

function StaleSection({ staleMarkers }: { staleMarkers?: readonly { reason: string; stale_since: string; caused_by: EntityRef }[] }): ReactNode {
  if (!staleMarkers || staleMarkers.length === 0) return null

  return (
    <div className="mt-3">
      <StaleBadge />
      <ul className="mt-1 text-[11px] text-text-muted list-disc list-inside">
        {staleMarkers.map((marker, i) => (
          <li key={i}>{marker.reason}</li>
        ))}
      </ul>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-border last:border-b-0">
      <span className="text-[11px] font-mono text-text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm text-text-primary text-right max-w-[180px]">{children}</span>
    </div>
  )
}

function GameDetail({ id, canonical }: { id: string; canonical: CanonicalStore }): ReactNode {
  const game = canonical.games[id]
  if (!game) return <div className="text-text-muted text-sm">Game not found</div>

  const playerNames = game.players
    .map((pid) => canonical.players[pid]?.name ?? pid)
    .join(', ')

  return (
    <Card title={game.name}>
      <DetailRow label="Status">
        <Badge>{game.status}</Badge>
      </DetailRow>
      <DetailRow label="Players">
        {playerNames || 'None'}
      </DetailRow>
      <DetailRow label="Player count">{game.players.length}</DetailRow>
      <DetailRow label="Formalizations">{game.formalizations.length}</DetailRow>
      {game.description && (
        <div className="mt-3 text-xs text-text-muted">{game.description}</div>
      )}
      <StaleSection staleMarkers={game.stale_markers} />
    </Card>
  )
}

function PlayerDetail({ id, canonical }: { id: string; canonical: CanonicalStore }): ReactNode {
  const player = canonical.players[id]
  if (!player) return <div className="text-text-muted text-sm">Player not found</div>

  const gameNames = Object.values(canonical.games)
    .filter((g) => g.players.includes(id))
    .map((g) => g.name)

  return (
    <Card title={player.name}>
      <DetailRow label="Type">
        <Badge>{player.type}</Badge>
      </DetailRow>
      {player.metadata?.description && (
        <DetailRow label="Description">{player.metadata.description}</DetailRow>
      )}
      <DetailRow label="Games">{gameNames.length > 0 ? gameNames.join(', ') : 'None'}</DetailRow>
      <DetailRow label="Objectives">{player.objectives.length}</DetailRow>
      <DetailRow label="Constraints">{player.constraints.length}</DetailRow>
      <StaleSection staleMarkers={player.stale_markers} />
    </Card>
  )
}

function GameNodeDetail({ id, canonical }: { id: string; canonical: CanonicalStore }): ReactNode {
  const node = canonical.nodes[id]
  if (!node) return <div className="text-text-muted text-sm">Node not found</div>

  const playerName =
    node.actor.kind === 'player'
      ? canonical.players[node.actor.player_id]?.name ?? node.actor.player_id
      : node.actor.kind

  return (
    <Card title={node.label}>
      <DetailRow label="Type">
        <Badge>{node.type}</Badge>
      </DetailRow>
      <DetailRow label="Actor">{playerName}</DetailRow>
      {node.description && (
        <DetailRow label="Description">{node.description}</DetailRow>
      )}
      {node.terminal_payoffs && Object.keys(node.terminal_payoffs).length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-mono text-text-muted uppercase tracking-wide mb-2">
            Payoffs
          </div>
          {Object.entries(node.terminal_payoffs).map(([playerId, estimate]) => (
            <div key={playerId} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-text-muted font-mono truncate max-w-[80px]">
                {canonical.players[playerId]?.name ?? playerId}
              </span>
              <EstimateValueDisplay estimate={estimate} />
            </div>
          ))}
        </div>
      )}
      <StaleSection staleMarkers={node.stale_markers} />
    </Card>
  )
}

function GameEdgeDetail({ id, canonical }: { id: string; canonical: CanonicalStore }): ReactNode {
  const edge = canonical.edges[id]
  if (!edge) return <div className="text-text-muted text-sm">Edge not found</div>

  const sourceNode = canonical.nodes[edge.from]
  const targetNode = canonical.nodes[edge.to]

  return (
    <Card title={edge.label}>
      <DetailRow label="From">{sourceNode?.label ?? edge.from}</DetailRow>
      <DetailRow label="To">{targetNode?.label ?? edge.to}</DetailRow>
      <DetailRow label="Action">{edge.label}</DetailRow>
      <StaleSection staleMarkers={edge.stale_markers} />
    </Card>
  )
}

function FormalizationDetail({ id, canonical }: { id: string; canonical: CanonicalStore }): ReactNode {
  const formalization = canonical.formalizations[id]
  if (!formalization) return <div className="text-text-muted text-sm">Formalization not found</div>

  const game = canonical.games[formalization.game_id]

  return (
    <Card title={`${formalization.kind} formalization`}>
      <DetailRow label="Kind">
        <Badge>{formalization.kind}</Badge>
      </DetailRow>
      <DetailRow label="Game">{game?.name ?? formalization.game_id}</DetailRow>
      <DetailRow label="Purpose">
        <Badge>{formalization.purpose}</Badge>
      </DetailRow>
      <DetailRow label="Abstraction">
        <Badge>{formalization.abstraction_level}</Badge>
      </DetailRow>
      <StaleSection staleMarkers={formalization.stale_markers} />
    </Card>
  )
}

function EvidenceDetail({ id, entityType, canonical }: { id: string; entityType: EntityType; canonical: CanonicalStore }): ReactNode {
  switch (entityType) {
    case 'source': {
      const source = canonical.sources[id]
      if (!source) return <div className="text-text-muted text-sm">Source not found</div>
      return (
        <Card title={source.title ?? 'Untitled Source'}>
          <DetailRow label="Kind"><Badge>{source.kind}</Badge></DetailRow>
          {source.publisher && <DetailRow label="Publisher">{source.publisher}</DetailRow>}
          {source.url && <DetailRow label="URL">{source.url}</DetailRow>}
          {source.quality_rating && (
            <DetailRow label="Quality"><Badge>{source.quality_rating}</Badge></DetailRow>
          )}
          <StaleSection staleMarkers={source.stale_markers} />
        </Card>
      )
    }
    case 'claim': {
      const claim = canonical.claims[id]
      if (!claim) return <div className="text-text-muted text-sm">Claim not found</div>
      return (
        <Card title="Claim">
          <div className="text-sm text-text-primary mb-2">{claim.statement}</div>
          <DetailRow label="Confidence"><ConfidenceBadge value={claim.confidence} /></DetailRow>
          <DetailRow label="Based on">{claim.based_on.length} observation(s)</DetailRow>
          <StaleSection staleMarkers={claim.stale_markers} />
        </Card>
      )
    }
    case 'assumption': {
      const assumption = canonical.assumptions[id]
      if (!assumption) return <div className="text-text-muted text-sm">Assumption not found</div>
      return (
        <Card title="Assumption">
          <div className="text-sm text-text-primary mb-2">{assumption.statement}</div>
          <DetailRow label="Type"><Badge>{assumption.type}</Badge></DetailRow>
          <DetailRow label="Sensitivity"><Badge>{assumption.sensitivity}</Badge></DetailRow>
          <DetailRow label="Confidence"><ConfidenceBadge value={assumption.confidence} /></DetailRow>
          <StaleSection staleMarkers={assumption.stale_markers} />
        </Card>
      )
    }
    case 'inference': {
      const inference = canonical.inferences[id]
      if (!inference) return <div className="text-text-muted text-sm">Inference not found</div>
      return (
        <Card title="Inference">
          <div className="text-sm text-text-primary mb-2">{inference.statement}</div>
          <DetailRow label="Confidence"><ConfidenceBadge value={inference.confidence} /></DetailRow>
          <DetailRow label="Derived from">{inference.derived_from.length} item(s)</DetailRow>
          <StaleSection staleMarkers={inference.stale_markers} />
        </Card>
      )
    }
    case 'contradiction': {
      const contradiction = canonical.contradictions[id]
      if (!contradiction) return <div className="text-text-muted text-sm">Contradiction not found</div>
      return (
        <Card title="Contradiction">
          <div className="text-sm text-text-primary mb-2">{contradiction.description}</div>
          <DetailRow label="Status"><Badge>{contradiction.resolution_status}</Badge></DetailRow>
          <StaleSection staleMarkers={contradiction.stale_markers} />
        </Card>
      )
    }
    case 'observation': {
      const observation = canonical.observations[id]
      if (!observation) return <div className="text-text-muted text-sm">Observation not found</div>
      return (
        <Card title="Observation">
          <div className="text-sm text-text-primary mb-2">{observation.text}</div>
          <DetailRow label="Source">{observation.source_id}</DetailRow>
          <StaleSection staleMarkers={observation.stale_markers} />
        </Card>
      )
    }
    default:
      return (
        <Card title={entityType}>
          <div className="text-sm text-text-muted">Detail view not yet implemented for {entityType}</div>
        </Card>
      )
  }
}

export function EntityDetail({ entityRef, canonical }: EntityDetailProps): ReactNode {
  switch (entityRef.type) {
    case 'game':
      return <GameDetail id={entityRef.id} canonical={canonical} />
    case 'player':
      return <PlayerDetail id={entityRef.id} canonical={canonical} />
    case 'game_node':
      return <GameNodeDetail id={entityRef.id} canonical={canonical} />
    case 'game_edge':
      return <GameEdgeDetail id={entityRef.id} canonical={canonical} />
    case 'formalization':
      return <FormalizationDetail id={entityRef.id} canonical={canonical} />
    default:
      return <EvidenceDetail id={entityRef.id} entityType={entityRef.type} canonical={canonical} />
  }
}
