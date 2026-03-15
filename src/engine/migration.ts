import type { ZodType } from 'zod'

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

function normalizeV1AnalysisFile(data: CurrentAnalysisFile): CurrentAnalysisFile {
  return data
}

const defaultSchemaRegistry: SchemaVersion[] = [
  {
    format: 1,
    schema: analysisFileSchema,
    normalize: normalizeV1AnalysisFile,
    released_at: '2026-03-14',
    breaking: false,
  },
]

const schemaRegistry: SchemaVersion[] = [...defaultSchemaRegistry]
const migrations: MigrationTransform[] = []

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
