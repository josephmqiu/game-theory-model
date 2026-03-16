import type { CanonicalStore } from '../types'
import type { LoadResult } from '../types/file'
import type { AnalysisFileMeta, FileService, RecentFile, SaveResult } from './types'

export class TauriFileService implements FileService {
  openFile(): Promise<LoadResult> {
    throw new Error('TauriFileService.openFile: not yet implemented')
  }

  openFilePath(_filepath: string): Promise<LoadResult> {
    throw new Error('TauriFileService.openFilePath: not yet implemented')
  }

  saveFile(_filepath: string, _store: CanonicalStore, _meta: AnalysisFileMeta): Promise<SaveResult> {
    throw new Error('TauriFileService.saveFile: not yet implemented')
  }

  saveFileAs(_store: CanonicalStore, _meta: AnalysisFileMeta): Promise<SaveResult> {
    throw new Error('TauriFileService.saveFileAs: not yet implemented')
  }

  getRecentFiles(): Promise<RecentFile[]> {
    throw new Error('TauriFileService.getRecentFiles: not yet implemented')
  }

  loadFixture(_name: string): Promise<LoadResult> {
    throw new Error('TauriFileService.loadFixture: not yet implemented')
  }
}
