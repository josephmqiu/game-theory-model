import { entityTypes, STORE_KEY } from '../types/canonical'
import type { RuntimeToolContext, McpServerLike } from './context'
import { getPipelineState } from '../store/pipeline'

export function registerResources(server: McpServerLike, context: RuntimeToolContext): void {
  server.registerResource({
    uri: 'analysis://model',
    name: 'Canonical Model',
    description: 'The full canonical analysis model (.gta.json contents)',
    mimeType: 'application/json',
    read: () => context.getModel(),
  })

  for (let phase = 1; phase <= 10; phase += 1) {
    server.registerResource({
      uri: `analysis://phase/${phase}`,
      name: `Phase ${phase} Results`,
      description: `Structured results from phase ${phase} of the analysis`,
      mimeType: 'application/json',
      read: () => getPipelineState().phase_results[phase] ?? null,
    })
  }

  for (const entityType of entityTypes) {
    server.registerResource({
      uri: `analysis://entities/${entityType}`,
      name: `${entityType} Entities`,
      description: `All entities of type ${entityType}`,
      mimeType: 'application/json',
      read: () => Object.values(context.getCanonicalStore()[STORE_KEY[entityType]]),
    })
  }
}
