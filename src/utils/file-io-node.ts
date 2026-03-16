import { access, copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'

import type { AnalysisFile } from '../types/file'
import type { LoadResult } from '../types/file'
import type { FileSystemOps } from './file-io'
import { loadAnalysisFileWithIo, saveAnalysisWithIo } from './file-io'

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

export async function loadAnalysisFile(filepath: string): Promise<LoadResult> {
  return loadAnalysisFileWithIo(filepath, nodeFileSystem)
}

export async function saveAnalysis(filepath: string, data: AnalysisFile): Promise<void> {
  await saveAnalysisWithIo(filepath, data, nodeFileSystem)
}
