import type { ReactNode } from 'react'

import type {
  Phase6ExtensiveFormWorkspacePreview,
  Phase6NormalFormWorkspacePreview,
  Phase6WorkspacePreview,
} from '../../../types/analysis-pipeline'
import type { CanonicalStore } from '../../../types/canonical'

function estimateLabel(value: Phase6NormalFormWorkspacePreview['cells'][number]['payoffs'][string] | undefined): string {
  if (!value) {
    return 'n/a'
  }
  if (value.representation === 'interval_estimate' && typeof value.min === 'number' && typeof value.max === 'number') {
    return `${value.min} to ${value.max}`
  }
  if (typeof value.value === 'number') {
    return `${value.value}`
  }
  if (typeof value.ordinal_rank === 'number') {
    return `rank ${value.ordinal_rank}`
  }
  return value.representation.replace(/_/g, ' ')
}

function playerLabel(canonical: CanonicalStore, playerId: string | null): string {
  if (!playerId) {
    return 'Unknown player'
  }
  return canonical.players[playerId]?.name ?? playerId
}

function renderNormalFormPreview(
  preview: Phase6NormalFormWorkspacePreview,
  canonical: CanonicalStore,
): ReactNode {
  const cellLookup = new Map(
    preview.cells.map((cell) => [`${cell.row_strategy}__${cell.col_strategy}`, cell]),
  )

  return (
    <div className="space-y-3" data-testid="phase6-preview-normal-form">
      <div className="text-xs font-mono uppercase tracking-wide text-text-muted">
        Read-only preview of proposed matrix
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border bg-bg-card px-3 py-2 text-left text-xs text-text-muted">
                {playerLabel(canonical, preview.row_player_id)} \ {playerLabel(canonical, preview.col_player_id)}
              </th>
              {preview.col_strategies.map((strategy) => (
                <th key={strategy} className="border border-border bg-bg-card px-3 py-2 text-left text-xs text-text-primary">
                  {strategy}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.row_strategies.map((rowStrategy) => (
              <tr key={rowStrategy}>
                <th className="border border-border bg-bg-card px-3 py-2 text-left text-xs text-text-primary">
                  {rowStrategy}
                </th>
                {preview.col_strategies.map((colStrategy) => {
                  const cell = cellLookup.get(`${rowStrategy}__${colStrategy}`)
                  return (
                    <td key={`${rowStrategy}:${colStrategy}`} className="border border-border px-3 py-2 align-top text-xs text-text-primary">
                      {preview.player_ids.length > 0 ? (
                        <div className="space-y-1">
                          {preview.player_ids.map((playerId) => (
                            <div key={playerId}>
                              <span className="text-text-muted">{playerLabel(canonical, playerId)}:</span>{' '}
                              {estimateLabel(cell?.payoffs[playerId])}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-text-muted">No payoff data</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function renderExtensiveFormPreview(
  preview: Phase6ExtensiveFormWorkspacePreview,
  canonical: CanonicalStore,
): ReactNode {
  const nodeLookup = new Map(preview.nodes.map((node) => [node.id, node]))
  const edgesBySource = new Map<string, Phase6ExtensiveFormWorkspacePreview['edges']>()
  for (const edge of preview.edges) {
    const existing = edgesBySource.get(edge.from) ?? []
    edgesBySource.set(edge.from, [...existing, edge])
  }

  return (
    <div className="space-y-3" data-testid="phase6-preview-extensive-form">
      <div className="text-xs font-mono uppercase tracking-wide text-text-muted">
        Read-only preview of proposed game tree
      </div>
      <div className="space-y-3">
        {preview.nodes.map((node) => (
          <div key={node.id} className="rounded border border-border bg-bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-text-primary">{node.label}</div>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">{node.type}</div>
            </div>
            <div className="mt-1 text-xs text-text-muted">
              {node.actor_label ? `Actor: ${node.actor_label}` : 'Actor unspecified'}
            </div>
            {node.terminal_payoffs ? (
              <div className="mt-2 text-xs text-text-primary">
                {Object.entries(node.terminal_payoffs).map(([playerId, payoff]) => (
                  <div key={`${node.id}:${playerId}`}>
                    {playerLabel(canonical, playerId)}: {estimateLabel(payoff)}
                  </div>
                ))}
              </div>
            ) : null}
            {(edgesBySource.get(node.id) ?? []).length > 0 ? (
              <div className="mt-2 text-xs text-text-muted">
                {(edgesBySource.get(node.id) ?? []).map((edge) => (
                  <div key={edge.id}>
                    {edge.label} {'->'} {nodeLookup.get(edge.to)?.label ?? edge.to}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Phase6WorkspacePreview({
  canonical,
  preview,
}: {
  canonical: CanonicalStore
  preview: Phase6WorkspacePreview
}): ReactNode {
  if (preview.kind === 'normal_form') {
    return renderNormalFormPreview(preview, canonical)
  }

  return renderExtensiveFormPreview(preview, canonical)
}
