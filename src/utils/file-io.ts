import { access, copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'

import { getCanonicalRevision } from '../engine/event-persistence'
import { createEventLog } from '../engine/events'
import { validateStoreInvariants } from '../engine/integrity'
import { buildInverseIndex } from '../engine/inverse-index'
import { getCurrentSchemaVersion, migrateFile } from '../engine/migration'
import { analysisFileSchema } from '../types/schemas'
import {
  analysisEntityKeys,
  type AnalysisEntityKey,
  type AnalysisFile,
  type LoadResult,
  type StructuralIssue,
} from '../types/file'
import { analysisFileToStore } from './serialization'

interface FileSystemOps {
  readFile(path: string): Promise<string>
  writeFile(path: string, contents: string): Promise<void>
  copyFile(source: string, destination: string): Promise<void>
  rename(source: string, destination: string): Promise<void>
  removeFile(path: string): Promise<void>
  fileExists(path: string): Promise<boolean>
}

const nodeFileSystem: FileSystemOps = {
  async readFile(path) {
    return readFile(path, 'utf8')
  },
  async writeFile(path, contents) {
    await writeFile(path, contents, 'utf8')
  },
  async copyFile(source, destination) {
    await copyFile(source, destination)
  },
  async rename(source, destination) {
    await rename(source, destination)
  },
  async removeFile(path) {
    await rm(path, { force: true })
  },
  async fileExists(path) {
    try {
      await access(path, constants.F_OK)
      return true
    } catch {
      return false
    }
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function structuralChecks(file: AnalysisFile): StructuralIssue[] {
  const issues: StructuralIssue[] = []
  const seenIds = new Map<string, AnalysisEntityKey>()

  for (const collection of analysisEntityKeys) {
    const localIds = new Set<string>()

    for (const entity of file[collection]) {
      if (!entity.id) {
        issues.push({
          kind: 'missing_id',
          message: `Entity in ${collection} is missing an id.`,
          entity_collection: collection,
        })
        continue
      }

      if (localIds.has(entity.id)) {
        issues.push({
          kind: 'duplicate_id',
          message: `Duplicate id "${entity.id}" found in ${collection}.`,
          entity_collection: collection,
          id: entity.id,
        })
      } else {
        localIds.add(entity.id)
      }

      const existingCollection = seenIds.get(entity.id)
      if (existingCollection && existingCollection !== collection) {
        issues.push({
          kind: 'cross_type_collision',
          message: `Id "${entity.id}" collides across ${existingCollection} and ${collection}.`,
          id: entity.id,
          colliding_collections: [existingCollection, collection],
        })
      } else if (!existingCollection) {
        seenIds.set(entity.id, collection)
      }
    }
  }

  return issues
}

export async function loadAnalysisFile(filepath: string): Promise<LoadResult> {
  return loadAnalysisFileWithIo(filepath, nodeFileSystem)
}

export async function loadAnalysisFileWithIo(
  filepath: string,
  io: FileSystemOps,
): Promise<LoadResult> {
  let rawJson: string
  try {
    rawJson = await io.readFile(filepath)
  } catch (error) {
    return {
      status: 'recovery',
      stage: 'parse',
      raw_json: '',
      error: {
        message: error instanceof Error ? error.message : 'Unable to read analysis file.',
      },
    }
  }
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(rawJson)
  } catch (error) {
    return {
      status: 'recovery',
      stage: 'parse',
      raw_json: rawJson,
      error: {
        message:
          error instanceof Error ? error.message : 'Unable to parse analysis file as JSON.',
      },
    }
  }

  if (!isRecord(parsedJson) || !('schema_version' in parsedJson)) {
    return {
      status: 'recovery',
      stage: 'parse',
      raw_json: rawJson,
      parsed_json: parsedJson,
      error: {
        message: 'Analysis file must be a JSON object with a schema_version field.',
      },
    }
  }

  const schemaVersion = parsedJson.schema_version
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    return {
      status: 'recovery',
      stage: 'parse',
      raw_json: rawJson,
      parsed_json: parsedJson,
      error: {
        message: 'schema_version must be an integer.',
      },
    }
  }

  const migration = await migrateFile(parsedJson, schemaVersion, getCurrentSchemaVersion())
  if (migration.status !== 'success') {
    return {
      status: 'recovery',
      stage: 'migration',
      raw_json: rawJson,
      parsed_json: migration.status === 'migration_failed' ? migration.partial_data : parsedJson,
      error: {
        message:
          migration.status === 'unsupported_version'
            ? migration.message
            : `Migration failed at step ${migration.failed_at_step.from}->${migration.failed_at_step.to}.`,
        issues: migration.status === 'migration_failed' ? migration.errors : undefined,
      },
    }
  }

  const validation = analysisFileSchema.safeParse(migration.data)
  if (!validation.success) {
    return {
      status: 'recovery',
      stage: 'validation',
      raw_json: rawJson,
      parsed_json: migration.data,
      error: {
        message: 'Analysis file failed validation against the current schema.',
        issues: validation.error.issues,
      },
    }
  }

  const structuralIssues = structuralChecks(validation.data)
  if (structuralIssues.length > 0) {
    return {
      status: 'recovery',
      stage: 'structural',
      raw_json: rawJson,
      parsed_json: validation.data,
      error: {
        message: 'Analysis file failed structural integrity checks.',
        structural_issues: structuralIssues,
      },
    }
  }

  const store = analysisFileToStore(validation.data)
  const inverseIndex = buildInverseIndex(store)
  const integrity = validateStoreInvariants(store)
  if (integrity.errors.length > 0) {
    return {
      status: 'recovery',
      stage: 'structural',
      raw_json: rawJson,
      parsed_json: validation.data,
      error: {
        message: 'Analysis file failed integrity checks.',
        issues: integrity.errors,
      },
    }
  }

  let persistedRevision = 0
  const warnings = [...integrity.warnings]
  try {
    persistedRevision = await getCanonicalRevision(filepath)
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Unable to load persisted revision history; defaulted to revision 0. ${error.message}`
        : 'Unable to load persisted revision history; defaulted to revision 0.',
    )
  }

  return {
    status: 'success',
    analysis: validation.data,
    store,
    derived: {
      inverse_index: inverseIndex,
    },
    integrity: {
      ok: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
    event_log: createEventLog(filepath, persistedRevision),
    migration: {
      from: schemaVersion,
      to: validation.data.schema_version,
      steps_applied: migration.steps_applied,
      discarded_data: migration.discarded_data,
    },
  }
}

export async function saveAnalysis(filepath: string, data: AnalysisFile): Promise<void> {
  await saveAnalysisWithIo(filepath, data, nodeFileSystem)
}

export async function saveAnalysisWithIo(
  filepath: string,
  data: AnalysisFile,
  io: FileSystemOps,
): Promise<void> {
  const tempPath = `${filepath}.tmp.${Date.now()}`
  const backupPath = `${filepath}.backup`

  await io.writeFile(tempPath, JSON.stringify(data, null, 2))

  try {
    const verificationJson = JSON.parse(await io.readFile(tempPath))
    const verification = analysisFileSchema.safeParse(verificationJson)

    if (!verification.success) {
      throw new Error('Written file failed verification against the current schema.')
    }

    const structuralIssues = structuralChecks(verification.data)
    if (structuralIssues.length > 0) {
      throw new Error(
        `Written file failed structural checks: ${structuralIssues
          .map((issue) => issue.message)
          .join('; ')}`,
      )
    }

    const integrity = validateStoreInvariants(analysisFileToStore(verification.data))
    if (integrity.errors.length > 0) {
      throw new Error(
        `Written file failed integrity checks: ${integrity.errors.join('; ')}`,
      )
    }

    if (await io.fileExists(filepath)) {
      await io.copyFile(filepath, backupPath)
    }

    await io.rename(tempPath, filepath)
  } catch (error) {
    await io.removeFile(tempPath)
    throw error
  }
}
