import { useEntityGraphStore } from "@/stores/entity-graph-store";
import type { AnalysisFileReference } from "@/types/entity";
import {
  AnalysisFileError,
  createDefaultAnalysisFileName,
  parseAnalysisFileText,
  serializeAnalysisFile,
} from "./analysis-file";

export type AnalysisPersistenceSource = Partial<AnalysisFileReference>;

export interface AnalysisDiscardPrompt {
  confirm: (message: string) => boolean | Promise<boolean>;
  message?: string;
}

interface PickerWindow extends Window {
  showOpenFilePicker: (options: unknown) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>;
}

const ANALYSIS_FILE_EXTENSION = ".gta";
const ANALYSIS_FILE_DESCRIPTION = "Game Theory Analyzer Files";

function isPickerWindow(windowValue: Window): windowValue is PickerWindow {
  return (
    "showOpenFilePicker" in windowValue && "showSaveFilePicker" in windowValue
  );
}

function supportsFileSystemAccess(): boolean {
  return isPickerWindow(window);
}

function getNativeConfirm(): AnalysisDiscardPrompt["confirm"] {
  return (message) => window.confirm(message);
}

function showNativeAlert(message: string): void {
  window.alert(message);
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AnalysisFileError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function getFileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").pop() || filePath;
}

function ensureAnalysisFileName(fileName: string): string {
  return fileName.toLowerCase().endsWith(ANALYSIS_FILE_EXTENSION)
    ? fileName
    : `${fileName}${ANALYSIS_FILE_EXTENSION}`;
}

function isUserAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getPickerAccept(): Record<string, string[]> {
  return {
    "application/json": [ANALYSIS_FILE_EXTENSION],
  };
}

async function writeTextToFileHandle(
  handle: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

function downloadAnalysisText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function saveAnalysisAsWithElectron(
  fileName: string,
  text: string,
  defaultPath?: string | null,
): Promise<AnalysisPersistenceSource | null> {
  const filePath = await window.electronAPI?.saveFile?.(
    text,
    defaultPath ?? fileName,
  );
  if (!filePath) {
    return null;
  }

  return {
    fileName: getFileNameFromPath(filePath),
    filePath,
    fileHandle: null,
  };
}

async function saveAnalysisAsWithPicker(
  fileName: string,
  text: string,
): Promise<AnalysisPersistenceSource | null> {
  const pickerWindow = window as unknown as PickerWindow;
  const handle = await pickerWindow.showSaveFilePicker({
    suggestedName: ensureAnalysisFileName(fileName),
    types: [
      {
        description: ANALYSIS_FILE_DESCRIPTION,
        accept: getPickerAccept(),
      },
    ],
    excludeAcceptAllOption: true,
  });

  if (!handle) {
    return null;
  }

  await writeTextToFileHandle(handle, text);

  return {
    fileName: handle.name,
    fileHandle: handle,
    filePath: null,
  };
}

function saveAnalysisAsWithDownload(
  fileName: string,
  text: string,
): AnalysisPersistenceSource {
  const nextFileName = ensureAnalysisFileName(fileName);
  downloadAnalysisText(text, nextFileName);

  return {
    fileName: nextFileName,
    filePath: null,
    fileHandle: null,
  };
}

// ── Persistence ──

export function createAnalysisSavePayload(
  state = useEntityGraphStore.getState(),
): {
  text: string;
  fileName: string;
  source: AnalysisFileReference;
} {
  return {
    text: serializeAnalysisFile(state.analysis),
    fileName: state.fileName ?? createDefaultAnalysisFileName(state.analysis),
    source: {
      fileName: state.fileName,
      filePath: state.filePath,
      fileHandle: state.fileHandle,
    },
  };
}

export async function saveAnalysisAs(): Promise<boolean> {
  const payload = createAnalysisSavePayload();

  try {
    let source: AnalysisPersistenceSource | null = null;

    if (window.electronAPI?.isElectron) {
      source = await saveAnalysisAsWithElectron(
        payload.fileName,
        payload.text,
        payload.source.filePath ?? payload.fileName,
      );
    } else if (supportsFileSystemAccess()) {
      source = await saveAnalysisAsWithPicker(payload.fileName, payload.text);
    } else {
      source = saveAnalysisAsWithDownload(payload.fileName, payload.text);
    }

    if (!source) {
      return false;
    }

    useEntityGraphStore.getState().commitSave({
      fileName: source.fileName ?? undefined,
      filePath: source.filePath ?? undefined,
      fileHandle: source.fileHandle ?? undefined,
    });
    return true;
  } catch (error) {
    if (isUserAbortError(error)) {
      return false;
    }

    showNativeAlert(
      `Could not save analysis.\n\n${toErrorMessage(
        error,
        "The analysis could not be saved.",
      )}`,
    );
    return false;
  }
}

export async function saveAnalysis(): Promise<boolean> {
  const payload = createAnalysisSavePayload();

  try {
    if (payload.source.fileHandle) {
      await writeTextToFileHandle(payload.source.fileHandle, payload.text);
      useEntityGraphStore.getState().commitSave({
        fileName: payload.source.fileName ?? undefined,
        filePath: payload.source.filePath ?? undefined,
        fileHandle: payload.source.fileHandle ?? undefined,
      });
      return true;
    }

    if (payload.source.filePath && window.electronAPI?.isElectron) {
      const filePath = await window.electronAPI.saveToPath(
        payload.source.filePath,
        payload.text,
      );

      useEntityGraphStore.getState().commitSave({
        fileName: getFileNameFromPath(filePath),
        filePath,
      });
      return true;
    }

    return saveAnalysisAs();
  } catch (error) {
    if (isUserAbortError(error)) {
      return false;
    }

    showNativeAlert(
      `Could not save analysis.\n\n${toErrorMessage(
        error,
        "The analysis could not be saved.",
      )}`,
    );
    return false;
  }
}

export function loadAnalysisFromText(
  text: string,
  source?: AnalysisPersistenceSource,
): void {
  const analysis = parseAnalysisFileText(text);
  useEntityGraphStore.getState().loadAnalysis(analysis, {
    fileName: source?.fileName ?? undefined,
    filePath: source?.filePath ?? undefined,
    fileHandle: source?.fileHandle ?? undefined,
  });
}

export async function openAnalysis(): Promise<boolean> {
  const entityState = useEntityGraphStore.getState();
  if (entityState.isDirty) {
    const confirmed = await getNativeConfirm()(
      "You have unsaved analysis changes. Discard them and open another analysis?",
    );
    if (!confirmed) {
      return false;
    }
  }

  try {
    if (window.electronAPI?.isElectron) {
      const result = await window.electronAPI.openFile?.();
      if (!result) {
        return false;
      }

      loadAnalysisFromText(result.content, {
        fileName: getFileNameFromPath(result.filePath),
        filePath: result.filePath,
        fileHandle: null,
      });
      return true;
    }

    if (supportsFileSystemAccess()) {
      const pickerWindow = window as unknown as PickerWindow;
      const [handle] = await pickerWindow.showOpenFilePicker({
        types: [
          {
            description: ANALYSIS_FILE_DESCRIPTION,
            accept: getPickerAccept(),
          },
        ],
        excludeAcceptAllOption: true,
        multiple: false,
      });

      if (!handle) {
        return false;
      }

      const file = await handle.getFile();
      const text = await file.text();
      loadAnalysisFromText(text, {
        fileName: file.name,
        fileHandle: handle,
        filePath: null,
      });
      return true;
    }

    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ANALYSIS_FILE_EXTENSION;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(false);
          return;
        }

        try {
          const text = await file.text();
          loadAnalysisFromText(text, {
            fileName: file.name,
            filePath: null,
            fileHandle: null,
          });
          resolve(true);
        } catch (error) {
          reject(error);
        }
      };
      input.oncancel = () => resolve(false);
      input.click();
    });
  } catch (error) {
    if (isUserAbortError(error)) {
      return false;
    }

    showNativeAlert(
      `Could not open analysis.\n\n${toErrorMessage(
        error,
        "The selected file is not a valid .gta analysis.",
      )}`,
    );
    return false;
  }
}
