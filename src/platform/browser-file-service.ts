import { createEventLog } from '../engine/events'
import { buildInverseIndex } from '../engine/inverse-index'
import { getCurrentSchemaVersion } from '../engine/migration'
import { createSampleAnalysisMeta, createSampleCanonicalStore } from '../test-support/sample-analysis'
import type { LoadResult } from '../types/file'
import { loadAnalysisJson } from '../utils/file-io'
import { storeToAnalysisFile } from '../utils/serialization'
import type { CanonicalStore } from '../types'
import type { AnalysisFileMeta, FileService, RecentFile, SaveResult } from './types'

const RECENT_FILES_KEY = 'strategic-lens:recent-files'
const RECENT_FILE_CONTENTS_KEY = 'strategic-lens:recent-file-contents'

export class BrowserFileService implements FileService {
  async openFile(): Promise<LoadResult> {
    const file = await chooseJsonFile()
    if (!file) {
      return {
        status: 'recovery',
        stage: 'parse',
        raw_json: '',
        error: {
          message: 'Open file cancelled.',
        },
      }
    }

    const rawJson = await file.text()
    const result = await loadAnalysisJson(rawJson, file.name)
    if (result.status === 'success') {
      persistRecentFile(file.name, file.name, rawJson)
    }
    return result
  }

  async openFilePath(filepath: string): Promise<LoadResult> {
    const contents = getRecentFileContents()[filepath]
    if (!contents) {
      return {
        status: 'recovery',
        stage: 'parse',
        raw_json: '',
        error: {
          message: `Recent file "${filepath}" is no longer available in browser storage.`,
        },
      }
    }

    const result = await loadAnalysisJson(contents, filepath)
    if (result.status === 'success') {
      persistRecentFile(filepath, filenameFromPath(filepath), contents)
    }
    return result
  }

  async saveFile(filepath: string, store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult> {
    try {
      const analysis = storeToAnalysisFile(store, meta)
      const json = JSON.stringify(analysis, null, 2)
      triggerDownload(json, filenameFromPath(filepath))
      persistRecentFile(filepath, filenameFromPath(filepath), json)
      return { success: true, path: filepath }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, path: filepath, error: message }
    }
  }

  async saveFileAs(store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult> {
    const filename = `${sanitizeFilename(meta.name)}.gta.json`
    try {
      const analysis = storeToAnalysisFile(store, meta)
      const json = JSON.stringify(analysis, null, 2)
      triggerDownload(json, filename)
      persistRecentFile(filename, filename, json)
      return { success: true, path: filename }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, path: filename, error: message }
    }
  }

  async getRecentFiles(): Promise<RecentFile[]> {
    try {
      const raw = safeLocalStorageGet(RECENT_FILES_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const sanitized = sanitizeRecentFiles(parsed)
      safeLocalStorageSet(RECENT_FILES_KEY, JSON.stringify(sanitized))
      return sanitized
    } catch {
      return []
    }
  }

  async loadFixture(_name: string): Promise<LoadResult> {
    const store = createSampleCanonicalStore()
    const meta = createSampleAnalysisMeta()
    const analysis = storeToAnalysisFile(store, meta)
    const rawJson = JSON.stringify(analysis, null, 2)
    const fixturePath = `${sanitizeFilename(meta.name)}.gta.json`
    persistRecentFile(fixturePath, fixturePath, rawJson)
    const inverseIndex = buildInverseIndex(store)
    const eventLog = createEventLog(analysis.name)
    const currentVersion = getCurrentSchemaVersion()

    return {
      status: 'success',
      path: fixturePath,
      analysis,
      store,
      derived: {
        inverse_index: inverseIndex,
      },
      integrity: {
        ok: true,
      },
      event_log: eventLog,
      migration: {
        from: currentVersion,
        to: currentVersion,
        steps_applied: [],
      },
    }
  }
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function filenameFromPath(filepath: string): string {
  const parts = filepath.split(/[/\\]/)
  return parts[parts.length - 1] ?? filepath
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
}

function sanitizeRecentFiles(value: unknown[]): RecentFile[] {
  return value
    .flatMap((entry): RecentFile[] => {
      if (typeof entry !== 'object' || entry === null) return []
      const candidate = entry as Record<string, unknown>
      if (
        typeof candidate.path !== 'string' ||
        typeof candidate.name !== 'string' ||
        typeof candidate.lastOpened !== 'number' ||
        Number.isNaN(candidate.lastOpened)
      ) {
        return []
      }
      return [{
        path: candidate.path,
        name: candidate.name,
        lastOpened: candidate.lastOpened,
      }]
    })
    .sort((left, right) => right.lastOpened - left.lastOpened)
}

function getRecentFileContents(): Record<string, string> {
  try {
    const raw = safeLocalStorageGet(RECENT_FILE_CONTENTS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
      ),
    )
  } catch {
    return {}
  }
}

function persistRecentFile(path: string, name: string, contents: string): void {
  const current = sanitizeRecentFilesFromStorage()
  const next = [
    { path, name, lastOpened: Date.now() },
    ...current.filter((entry) => entry.path !== path),
  ].slice(0, 20)

  safeLocalStorageSet(RECENT_FILES_KEY, JSON.stringify(next))

  const contentMap = getRecentFileContents()
  contentMap[path] = contents
  safeLocalStorageSet(RECENT_FILE_CONTENTS_KEY, JSON.stringify(contentMap))
}

function sanitizeRecentFilesFromStorage(): RecentFile[] {
  try {
    const raw = safeLocalStorageGet(RECENT_FILES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? sanitizeRecentFiles(parsed) : []
  } catch {
    return []
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    if (typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value)
      return
    }
    ;(localStorage as Record<string, unknown>)[key] = value
  } catch {
    // Ignore browser storage failures and continue with the current session.
  }
}

/**
 * Safe localStorage.getItem wrapper — handles environments (e.g. jsdom v28+)
 * where localStorage is a plain object without the Storage API.
 */
function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key)
    }
    const value = (localStorage as Record<string, unknown>)[key]
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

async function chooseJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.gta.json,application/json'
    input.onchange = () => {
      resolve(input.files?.[0] ?? null)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
