import { z, type ZodType } from 'zod'

import { analysisFileSchema } from '../types/schemas'
import type { AnalysisFile, CurrentAnalysisFile } from '../types/file'
import { MigrationError } from './migration-error'

export interface SchemaVersion {
  format: number
  schema: ZodType<CurrentAnalysisFile>
  normalize: (data: CurrentAnalysisFile) => CurrentAnalysisFile
  released_at: string
  breaking: boolean
}

export interface MigrationTransform {
  from: number
  to: number
  description: string
  lossy: boolean
  discarded_fields?: string[]
  transform: (data: unknown) => { result: unknown; discarded?: Record<string, unknown> }
}

export interface StepResult {
  from: number
  to: number
  status: 'ok'
}

export type MigrationResult =
  | {
      status: 'success'
      data: AnalysisFile
      steps_applied: StepResult[]
      discarded_data?: Array<{
        step: { from: number; to: number }
        description: string
        fields: string[]
        values: Record<string, unknown>
      }>
    }
  | {
      status: 'migration_failed'
      failed_at_step: { from: number; to: number }
      description: string
      errors: unknown[]
      partial_data: unknown
    }
  | {
      status: 'unsupported_version'
      file_version: number
      app_version: number
      message: string
      recovery_available: true
    }

/**
 * The v1 schema accepts any object with schema_version: 1 plus the original 16
 * entity arrays. It uses passthrough() so that files round-trip without losing
 * unknown keys during the validation step that runs before migration.
 */
const v1AnalysisFileSchema = z
  .object({ schema_version: z.literal(1) })
  .passthrough() as unknown as ZodType<CurrentAnalysisFile>

function normalizeV1AnalysisFile(data: CurrentAnalysisFile): CurrentAnalysisFile {
  return data
}

function normalizeV2AnalysisFile(data: CurrentAnalysisFile): CurrentAnalysisFile {
  return data
}

const ASSUMPTION_TYPE_MAP: Record<string, string> = {
  payoff: 'capability',
  timing: 'institutional',
  belief: 'information',
  simplification: 'rationality',
}

const ABSTRACTION_LEVEL_MAP: Record<string, string> = {
  coarse: 'minimal',
  medium: 'moderate',
}

const NEW_ENTITY_ARRAYS = [
  'escalation_ladders',
  'trust_assessments',
  'eliminated_outcomes',
  'signal_classifications',
  'repeated_game_patterns',
  'revalidation_events',
  'dynamic_inconsistency_risks',
  'cross_game_constraint_tables',
  'central_theses',
  'tail_risks',
] as const

const v1ToV2Migration: MigrationTransform = {
  from: 1,
  to: 2,
  description: 'Add 10 new entity types, map legacy assumption types and abstraction levels.',
  lossy: false,
  transform(data: unknown): { result: unknown; discarded?: Record<string, unknown> } {
    const file = data as Record<string, unknown>

    const result: Record<string, unknown> = { ...file, schema_version: 2 }

    for (const key of NEW_ENTITY_ARRAYS) {
      if (!(key in result)) {
        result[key] = []
      }
    }

    const assumptions = result['assumptions']
    if (Array.isArray(assumptions)) {
      result['assumptions'] = assumptions.map(
        (assumption: Record<string, unknown>) => {
          const mapped = ASSUMPTION_TYPE_MAP[assumption['type'] as string]
          if (mapped) {
            return { ...assumption, type: mapped }
          }
          return assumption
        },
      )
    }

    const formalizations = result['formalizations']
    if (Array.isArray(formalizations)) {
      result['formalizations'] = formalizations.map(
        (formalization: Record<string, unknown>) => {
          const mapped = ABSTRACTION_LEVEL_MAP[formalization['abstraction_level'] as string]
          if (mapped) {
            return { ...formalization, abstraction_level: mapped }
          }
          return formalization
        },
      )
    }

    return { result }
  },
}

const defaultSchemaRegistry: SchemaVersion[] = [
  {
    format: 1,
    schema: v1AnalysisFileSchema,
    normalize: normalizeV1AnalysisFile,
    released_at: '2026-03-14',
    breaking: false,
  },
  {
    format: 2,
    schema: analysisFileSchema as unknown as ZodType<CurrentAnalysisFile>,
    normalize: normalizeV2AnalysisFile,
    released_at: '2026-03-15',
    breaking: true,
  },
]

const schemaRegistry: SchemaVersion[] = [...defaultSchemaRegistry]
const migrations: MigrationTransform[] = [v1ToV2Migration]

export function resetSchemaRegistryForTests(
  schemas: ReadonlyArray<SchemaVersion> = defaultSchemaRegistry,
): void {
  schemaRegistry.length = 0
  schemaRegistry.push(...schemas)
}

export function registerSchemaVersionForTests(...schemas: SchemaVersion[]): void {
  schemaRegistry.push(...schemas)
}

export function resetMigrationsForTests(
  nextMigrations: ReadonlyArray<MigrationTransform> = [],
): void {
  migrations.length = 0
  migrations.push(...nextMigrations)
}

export function registerMigrationForTests(...nextMigrations: MigrationTransform[]): void {
  migrations.push(...nextMigrations)
}

export function getSchema(format: number): SchemaVersion {
  const entry = schemaRegistry.find((schemaVersion) => schemaVersion.format === format)
  if (!entry) {
    throw new MigrationError(`No schema registered for format ${format}.`, { format })
  }
  return entry
}

export function getCurrentSchemaVersion(): number {
  if (schemaRegistry.length === 0) {
    throw new MigrationError('No schema versions have been registered.')
  }

  return Math.max(...schemaRegistry.map((schemaVersion) => schemaVersion.format))
}

export function buildMigrationPath(from: number, to: number): MigrationTransform[] {
  if (from === to) {
    return []
  }

  if (from > to) {
    throw new MigrationError('Backward migrations are not supported.', { from, to })
  }

  const path: MigrationTransform[] = []

  for (let version = from; version < to; version += 1) {
    const step = migrations.find(
      (migration) => migration.from === version && migration.to === version + 1,
    )

    if (!step) {
      throw new MigrationError(`Missing migration from schema ${version} to ${version + 1}.`, {
        from: version,
        to: version + 1,
      })
    }

    path.push(step)
  }

  return path
}

export async function migrateFile(
  raw: unknown,
  from: number,
  to: number,
): Promise<MigrationResult> {
  const currentVersion = getCurrentSchemaVersion()

  if (from > currentVersion) {
    return {
      status: 'unsupported_version',
      file_version: from,
      app_version: currentVersion,
      message: 'This file requires a newer app version. Update or open in recovery mode.',
      recovery_available: true,
    }
  }

  if (from === to) {
    const validation = getSchema(to).schema.safeParse(raw)

    if (!validation.success) {
      return {
        status: 'migration_failed',
        failed_at_step: { from, to },
        description: `Validation against schema version ${to} failed.`,
        errors: validation.error.issues,
        partial_data: raw,
      }
    }

    return {
      status: 'success',
      data: getSchema(to).normalize(validation.data),
      steps_applied: [],
    }
  }

  let path: MigrationTransform[]
  try {
    path = buildMigrationPath(from, to)
  } catch (error) {
    return {
      status: 'migration_failed',
      failed_at_step: { from, to },
      description:
        error instanceof Error ? error.message : 'Unable to build the migration path.',
      errors:
        error instanceof MigrationError
          ? [error.details ?? { message: error.message }]
          : [{ message: 'Unknown migration path error.' }],
      partial_data: raw,
    }
  }
  let data = raw
  const stepResults: StepResult[] = []
  const discardedData: NonNullable<
    Extract<MigrationResult, { status: 'success' }>['discarded_data']
  > = []

  for (const step of path) {
    const { result, discarded } = step.transform(data)
    data = result

    if (step.lossy && discarded) {
      discardedData.push({
        step: { from: step.from, to: step.to },
        description: step.description,
        fields: step.discarded_fields ?? [],
        values: discarded,
      })
    }

    const validation = getSchema(step.to).schema.safeParse(data)

    if (!validation.success) {
      return {
        status: 'migration_failed',
        failed_at_step: { from: step.from, to: step.to },
        description: step.description,
        errors: validation.error.issues,
        partial_data: data,
      }
    }

    data = getSchema(step.to).normalize(validation.data)
    stepResults.push({ from: step.from, to: step.to, status: 'ok' })
  }

  return {
    status: 'success',
    data: data as AnalysisFile,
    steps_applied: stepResults,
    discarded_data: discardedData.length > 0 ? discardedData : undefined,
  }
}
