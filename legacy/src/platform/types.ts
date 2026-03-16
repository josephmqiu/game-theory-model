import type { CanonicalStore } from '../types'
import type { LoadResult, AnalysisFileMeta } from '../types/file'

export type { AnalysisFileMeta }

export interface Platform {
  readonly type: 'browser' | 'tauri'
  readonly capabilities: {
    readonly nativeDialogs: boolean
    readonly nativeFs: boolean
    readonly nativeWindowChrome: boolean
  }
}

export interface RecentFile {
  readonly path: string
  readonly name: string
  readonly lastOpened: number
}

export interface SaveResult {
  readonly success: boolean
  readonly path: string
  readonly error?: string
}

export interface FileService {
  openFile(): Promise<LoadResult>
  openFilePath(filepath: string): Promise<LoadResult>
  saveFile(filepath: string, store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult>
  saveFileAs(store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult>
  getRecentFiles(): Promise<RecentFile[]>
  loadFixture(name: string): Promise<LoadResult>
}

export interface ShellService {
  setTitle(title: string): void
  onBeforeClose(cb: () => Promise<boolean>): void
}
