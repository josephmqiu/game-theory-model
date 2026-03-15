import { getCurrentSchemaVersion } from '../engine/migration'
import { emptyCanonicalStore } from '../types/canonical'
import type {
  CanonicalStore,
  CrossGameLink,
  Formalization,
  GameEdge,
  GameNode,
  Player,
  StrategicGame,
} from '../types/index'
import type { AnalysisFile, AnalysisFileMeta } from '../types/file'
import type {
  Assumption,
  Claim,
  Contradiction,
  DerivationEdge,
  Inference,
  LatentFactor,
  Observation,
  Playbook,
  Scenario,
  Source,
} from '../types/index'

type PersistedFormalization = Omit<Formalization, 'readiness_cache'>

export function arrayToMap<T extends { id: string }>(items: T[]): Record<string, T> {
  const record: Record<string, T> = {}

  for (const item of items) {
    if (item.id in record) {
      throw new Error(`Duplicate entity id "${item.id}" encountered during array-to-map conversion.`)
    }

    record[item.id] = item
  }

  return record
}

export function mapToArray<T extends { id: string }>(record: Record<string, T>): T[] {
  return Object.values(record).sort((left, right) => left.id.localeCompare(right.id))
}

function withoutReadinessCache(formalization: Formalization): PersistedFormalization {
  const { readiness_cache: _readinessCache, ...persisted } = formalization
  return persisted
}

export function storeToAnalysisFile(
  store: CanonicalStore,
  meta: AnalysisFileMeta,
): AnalysisFile {
  return {
    schema_version: getCurrentSchemaVersion() as AnalysisFile['schema_version'],
    name: meta.name,
    description: meta.description,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
    games: mapToArray(store.games),
    formalizations: mapToArray(store.formalizations).map(
      withoutReadinessCache,
    ) as AnalysisFile['formalizations'],
    players: mapToArray(store.players),
    nodes: mapToArray(store.nodes),
    edges: mapToArray(store.edges),
    sources: mapToArray(store.sources),
    observations: mapToArray(store.observations),
    claims: mapToArray(store.claims),
    inferences: mapToArray(store.inferences),
    assumptions: mapToArray(store.assumptions),
    contradictions: mapToArray(store.contradictions),
    derivations: mapToArray(store.derivations),
    latent_factors: mapToArray(store.latent_factors),
    cross_game_links: mapToArray(store.cross_game_links),
    scenarios: mapToArray(store.scenarios),
    playbooks: mapToArray(store.playbooks),
    escalation_ladders: mapToArray(store.escalation_ladders),
    trust_assessments: mapToArray(store.trust_assessments),
    eliminated_outcomes: mapToArray(store.eliminated_outcomes),
    signal_classifications: mapToArray(store.signal_classifications),
    repeated_game_patterns: mapToArray(store.repeated_game_patterns),
    revalidation_events: mapToArray(store.revalidation_events),
    dynamic_inconsistency_risks: mapToArray(store.dynamic_inconsistency_risks),
    cross_game_constraint_tables: mapToArray(store.cross_game_constraint_tables),
    central_theses: mapToArray(store.central_theses),
    tail_risks: mapToArray(store.tail_risks),
    metadata: meta.metadata,
  }
}

export function analysisFileToStore(file: AnalysisFile): CanonicalStore {
  return {
    ...emptyCanonicalStore(),
    games: arrayToMap(file.games),
    formalizations: arrayToMap(file.formalizations),
    players: arrayToMap(file.players),
    nodes: arrayToMap(file.nodes),
    edges: arrayToMap(file.edges),
    sources: arrayToMap(file.sources),
    observations: arrayToMap(file.observations),
    claims: arrayToMap(file.claims),
    inferences: arrayToMap(file.inferences),
    assumptions: arrayToMap(file.assumptions),
    contradictions: arrayToMap(file.contradictions),
    derivations: arrayToMap(file.derivations),
    latent_factors: arrayToMap(file.latent_factors),
    cross_game_links: arrayToMap(file.cross_game_links),
    scenarios: arrayToMap(file.scenarios),
    playbooks: arrayToMap(file.playbooks),
    escalation_ladders: arrayToMap(file.escalation_ladders),
    trust_assessments: arrayToMap(file.trust_assessments),
    eliminated_outcomes: arrayToMap(file.eliminated_outcomes),
    signal_classifications: arrayToMap(file.signal_classifications),
    repeated_game_patterns: arrayToMap(file.repeated_game_patterns),
    revalidation_events: arrayToMap(file.revalidation_events),
    dynamic_inconsistency_risks: arrayToMap(file.dynamic_inconsistency_risks),
    cross_game_constraint_tables: arrayToMap(file.cross_game_constraint_tables),
    central_theses: arrayToMap(file.central_theses),
    tail_risks: arrayToMap(file.tail_risks),
  }
}
