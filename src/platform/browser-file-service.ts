import { createEventLog } from '../engine/events'
import { buildInverseIndex } from '../engine/inverse-index'
import { getCurrentSchemaVersion } from '../engine/migration'
import { createSampleAnalysisMeta, createSampleCanonicalStore } from '../test-support/sample-analysis'
import type { LoadResult } from '../types/file'
import { storeToAnalysisFile } from '../utils/serialization'
import type { CanonicalStore } from '../types'
import type { AnalysisFileMeta, FileService, RecentFile, SaveResult } from './types'

const RECENT_FILES_KEY = 'strategic-lens:recent-files'

export class BrowserFileService implements FileService {
  openFile(): Promise<LoadResult> {
    throw new Error('openFile: not yet implemented in browser')
  }

  openFilePath(_filepath: string): Promise<LoadResult> {
    throw new Error('openFilePath: not yet implemented in browser')
  }

  async saveFile(filepath: string, store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult> {
    try {
      const analysis = storeToAnalysisFile(store, meta)
      const json = JSON.stringify(analysis, null, 2)
      triggerDownload(json, filenameFromPath(filepath))
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
      return parsed as RecentFile[]
    } catch {
      return []
    }
  }

  async loadFixture(_name: string): Promise<LoadResult> {
    const store = createSampleCanonicalStore()
    const meta = createSampleAnalysisMeta()
    const analysis = storeToAnalysisFile(store, meta)
    const inverseIndex = buildInverseIndex(store)
    const eventLog = createEventLog(analysis.name)
    const currentVersion = getCurrentSchemaVersion()

    return {
      status: 'success',
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
