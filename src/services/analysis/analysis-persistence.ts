import { useAnalysisStore } from '@/stores/analysis-store'
import type { Analysis, AnalysisFileReference } from '@/types/analysis'
import {
  AnalysisFileError,
  createAnalysisFile,
  createDefaultAnalysisFileName,
  parseAnalysisFileText,
  serializeAnalysisFile,
} from './analysis-file'

export type AnalysisPersistenceSource = Partial<AnalysisFileReference>

export interface AnalysisDiscardPrompt {
  confirm: (message: string) => boolean | Promise<boolean>
  message?: string
}

interface AnalysisFileOpenResult {
  analysis: Analysis
  source: AnalysisFileReference
}

interface PickerWindow extends Window {
  showOpenFilePicker: (options: unknown) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>
}

const ANALYSIS_FILE_EXTENSION = '.gta'
const ANALYSIS_FILE_DESCRIPTION = 'Game Theory Analyzer Files'

function isPickerWindow(windowValue: Window): windowValue is PickerWindow {
  return (
    'showOpenFilePicker' in windowValue &&
    'showSaveFilePicker' in windowValue
  )
}

function supportsFileSystemAccess(): boolean {
  return isPickerWindow(window)
}

function getNativeConfirm(): AnalysisDiscardPrompt['confirm'] {
  return (message) => window.confirm(message)
}

function showNativeAlert(message: string): void {
  window.alert(message)
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AnalysisFileError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

function getFileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.split('/').pop() || filePath
}

function ensureAnalysisFileName(fileName: string): string {
  return fileName.toLowerCase().endsWith(ANALYSIS_FILE_EXTENSION)
    ? fileName
    : `${fileName}${ANALYSIS_FILE_EXTENSION}`
}

function isUserAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getPickerAccept(): Record<string, string[]> {
  return {
    'application/json': [ANALYSIS_FILE_EXTENSION],
  }
}

async function writeTextToFileHandle(
  handle: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

async function openAnalysisFromHandle(
  handle: FileSystemFileHandle,
): Promise<AnalysisFileOpenResult> {
  const file = await handle.getFile()
  const text = await file.text()
  const analysis = loadAnalysisFromText(text, {
    fileName: file.name,
    fileHandle: handle,
    filePath: null,
  })

  return {
    analysis,
    source: {
      fileName: file.name,
      fileHandle: handle,
      filePath: null,
    },
  }
}

async function openAnalysisWithElectronDialog(): Promise<AnalysisFileOpenResult | null> {
  const result = await window.electronAPI?.openFile?.()
  if (!result) {
    return null
  }

  const analysis = loadAnalysisFromText(result.content, {
    fileName: getFileNameFromPath(result.filePath),
    filePath: result.filePath,
    fileHandle: null,
  })

  return {
    analysis,
    source: {
      fileName: getFileNameFromPath(result.filePath),
      filePath: result.filePath,
      fileHandle: null,
    },
  }
}

async function openAnalysisWithPicker(): Promise<AnalysisFileOpenResult | null> {
  const pickerWindow = window as unknown as PickerWindow
  const [handle] = await pickerWindow.showOpenFilePicker({
    types: [
      {
        description: ANALYSIS_FILE_DESCRIPTION,
        accept: getPickerAccept(),
      },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
  })

  if (!handle) {
    return null
  }

  return openAnalysisFromHandle(handle)
}

async function openAnalysisWithFileInput(): Promise<AnalysisFileOpenResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ANALYSIS_FILE_EXTENSION
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      try {
        const text = await file.text()
        const analysis = loadAnalysisFromText(text, {
          fileName: file.name,
          filePath: null,
          fileHandle: null,
        })

        resolve({
          analysis,
          source: {
            fileName: file.name,
            filePath: null,
            fileHandle: null,
          },
        })
      } catch (error) {
        reject(error)
      }
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

async function openAnalysisWithPromptlessPicker(): Promise<boolean> {
  if (window.electronAPI?.isElectron) {
    const result = await openAnalysisWithElectronDialog()
    return result !== null
  }

  if (supportsFileSystemAccess()) {
    const result = await openAnalysisWithPicker()
    return result !== null
  }

  const result = await openAnalysisWithFileInput()
  return result !== null
}

function downloadAnalysisText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

async function saveAnalysisAsWithElectron(
  fileName: string,
  text: string,
  defaultPath?: string | null,
): Promise<AnalysisPersistenceSource | null> {
  const filePath = await window.electronAPI?.saveFile?.(text, defaultPath ?? fileName)
  if (!filePath) {
    return null
  }

  return {
    fileName: getFileNameFromPath(filePath),
    filePath,
    fileHandle: null,
  }
}

async function saveAnalysisAsWithPicker(
  fileName: string,
  text: string,
): Promise<AnalysisPersistenceSource | null> {
  const pickerWindow = window as unknown as PickerWindow
  const handle = await pickerWindow.showSaveFilePicker({
    suggestedName: ensureAnalysisFileName(fileName),
    types: [
      {
        description: ANALYSIS_FILE_DESCRIPTION,
        accept: getPickerAccept(),
      },
    ],
    excludeAcceptAllOption: true,
  })

  if (!handle) {
    return null
  }

  await writeTextToFileHandle(handle, text)

  return {
    fileName: handle.name,
    fileHandle: handle,
    filePath: null,
  }
}

function saveAnalysisAsWithDownload(
  fileName: string,
  text: string,
): AnalysisPersistenceSource {
  const nextFileName = ensureAnalysisFileName(fileName)
  downloadAnalysisText(text, nextFileName)

  return {
    fileName: nextFileName,
    filePath: null,
    fileHandle: null,
  }
}

export function hasUnsavedAnalysisChanges(
  state = useAnalysisStore.getState(),
): boolean {
  return state.isDirty
}

export async function confirmDiscardAnalysisChanges(
  prompt: AnalysisDiscardPrompt,
  state = useAnalysisStore.getState(),
): Promise<boolean> {
  if (!hasUnsavedAnalysisChanges(state)) {
    return true
  }

  const confirmed = await prompt.confirm(
    prompt.message ?? 'You have unsaved analysis changes. Discard them?',
  )

  return Boolean(confirmed)
}

export function loadAnalysisFromText(
  text: string,
  source?: AnalysisPersistenceSource,
): Analysis {
  const file = parseAnalysisFileText(text)
  useAnalysisStore.getState().loadAnalysis(file.analysis, source)
  return file.analysis
}

export function createAnalysisSavePayload(state = useAnalysisStore.getState()): {
  file: ReturnType<typeof createAnalysisFile>
  text: string
  fileName: string
  source: AnalysisFileReference
} {
  const file = createAnalysisFile(state.analysis)
  return {
    file,
    text: serializeAnalysisFile(state.analysis),
    fileName: state.fileName ?? createDefaultAnalysisFileName(state.analysis),
    source: {
      fileName: state.fileName,
      filePath: state.filePath,
      fileHandle: state.fileHandle,
    },
  }
}

export function commitAnalysisSave(source: AnalysisPersistenceSource = {}): void {
  useAnalysisStore.getState().setAnalysisFileReference(source)
  useAnalysisStore.getState().markClean()
}

export function clearAnalysisFileReference(): void {
  useAnalysisStore.getState().clearAnalysisFileReference()
}

export function resetAnalysisForNewDocument(): void {
  useAnalysisStore.getState().newAnalysis()
}

export function getAnalysisFileStatus(state = useAnalysisStore.getState()): {
  fileName: string | null
  isDirty: boolean
  hasSavedLocation: boolean
} {
  return {
    fileName: state.fileName,
    isDirty: state.isDirty,
    hasSavedLocation: Boolean(state.filePath || state.fileHandle),
  }
}

export async function openAnalysisFromFilePath(filePath: string): Promise<boolean> {
  const confirmed = await confirmDiscardAnalysisChanges({
    confirm: getNativeConfirm(),
    message:
      'You have unsaved analysis changes. Discard them and open another analysis?',
  })

  if (!confirmed) {
    return false
  }

  try {
    const readResult = await window.electronAPI?.readFile?.(filePath)
    if (!readResult) {
      throw new Error('Could not read the selected analysis file.')
    }

    loadAnalysisFromText(readResult.content, {
      fileName: getFileNameFromPath(readResult.filePath),
      filePath: readResult.filePath,
      fileHandle: null,
    })

    return true
  } catch (error) {
    if (isUserAbortError(error)) {
      return false
    }

    showNativeAlert(
      `Could not open analysis.\n\n${toErrorMessage(
        error,
        'The selected file is not a valid .gta analysis.',
      )}`,
    )
    return false
  }
}

export async function openAnalysis(): Promise<boolean> {
  const confirmed = await confirmDiscardAnalysisChanges({
    confirm: getNativeConfirm(),
    message:
      'You have unsaved analysis changes. Discard them and open another analysis?',
  })

  if (!confirmed) {
    return false
  }

  try {
    return await openAnalysisWithPromptlessPicker()
  } catch (error) {
    if (isUserAbortError(error)) {
      return false
    }

    showNativeAlert(
      `Could not open analysis.\n\n${toErrorMessage(
        error,
        'The selected file is not a valid .gta analysis.',
      )}`,
    )
    return false
  }
}

export async function newAnalysis(): Promise<boolean> {
  const confirmed = await confirmDiscardAnalysisChanges({
    confirm: getNativeConfirm(),
    message:
      'You have unsaved analysis changes. Discard them and start a new analysis?',
  })

  if (!confirmed) {
    return false
  }

  resetAnalysisForNewDocument()
  return true
}

export async function saveAnalysisAs(): Promise<boolean> {
  const payload = createAnalysisSavePayload()

  try {
    let source: AnalysisPersistenceSource | null = null

    if (window.electronAPI?.isElectron) {
      source = await saveAnalysisAsWithElectron(
        payload.fileName,
        payload.text,
        payload.source.filePath ?? payload.fileName,
      )
    } else if (supportsFileSystemAccess()) {
      source = await saveAnalysisAsWithPicker(payload.fileName, payload.text)
    } else {
      source = saveAnalysisAsWithDownload(payload.fileName, payload.text)
    }

    if (!source) {
      return false
    }

    commitAnalysisSave(source)
    return true
  } catch (error) {
    if (isUserAbortError(error)) {
      return false
    }

    showNativeAlert(
      `Could not save analysis.\n\n${toErrorMessage(
        error,
        'The analysis could not be saved.',
      )}`,
    )
    return false
  }
}

export async function saveAnalysis(): Promise<boolean> {
  const payload = createAnalysisSavePayload()

  try {
    if (payload.source.fileHandle) {
      await writeTextToFileHandle(payload.source.fileHandle, payload.text)
      commitAnalysisSave(payload.source)
      return true
    }

    if (payload.source.filePath && window.electronAPI?.isElectron) {
      const filePath = await window.electronAPI.saveToPath(
        payload.source.filePath,
        payload.text,
      )

      commitAnalysisSave({
        fileName: getFileNameFromPath(filePath),
        filePath,
        fileHandle: null,
      })
      return true
    }

    return saveAnalysisAs()
  } catch (error) {
    if (isUserAbortError(error)) {
      return false
    }

    showNativeAlert(
      `Could not save analysis.\n\n${toErrorMessage(
        error,
        'The analysis could not be saved.',
      )}`,
    )
    return false
  }
}
