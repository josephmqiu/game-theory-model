import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useThreadStore } from "@/stores/thread-store";
import { layoutEntities } from "@/services/entity/entity-layout";
import type {
  Analysis,
  AnalysisFileReference,
  LayoutState,
} from "@/types/entity";
import type { Workspace } from "@/types/workspace";
import {
  AnalysisFileError,
  createWorkspaceFromAnalysis,
  createDefaultAnalysisFileName,
  parseWorkspaceFileText,
  serializeWorkspaceFile,
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
const WORKSPACE_SYNC_ENDPOINT = "/api/workspace/state";
const EXPORT_SNAPSHOT_ENDPOINT = "/api/workspace/export-snapshot";

let currentWorkspace: Pick<
  Workspace,
  "id" | "name" | "createdAt" | "updatedAt"
> | null = null;

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

function isBrowserSaveRestrictionError(error: unknown): boolean {
  if (!(error instanceof DOMException || error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "SecurityError" ||
    error.name === "NotAllowedError" ||
    message.includes("not allowed by the user agent") ||
    message.includes("platform in the current context") ||
    message.includes("secure context") ||
    message.includes("user activation")
  );
}

function getPickerAccept(): Record<string, string[]> {
  return {
    "application/json": [ANALYSIS_FILE_EXTENSION],
  };
}

function rememberWorkspace(workspace: Workspace): void {
  currentWorkspace = {
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function buildWorkspaceSnapshot(
  state = useEntityGraphStore.getState(),
  timestamp = Date.now(),
): Workspace {
  const fallbackName =
    state.analysis.name.trim() ||
    state.analysis.topic.trim() ||
    "Untitled Workspace";

  const workspace = createWorkspaceFromAnalysis(state.analysis, state.layout, {
    id: currentWorkspace?.id ?? state.analysis.id,
    name: fallbackName,
    createdAt: currentWorkspace?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });

  rememberWorkspace(workspace);
  return workspace;
}

async function syncWorkspaceState(
  workspace: Workspace,
  source?: AnalysisPersistenceSource,
  importMode = false,
): Promise<void> {
  try {
    const response = await fetch(WORKSPACE_SYNC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          analysisType: workspace.analysisType,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
        },
        snapshot: workspace,
        fileName: source?.fileName ?? null,
        filePath: source?.filePath ?? null,
        ...(importMode ? { import: true } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`workspace sync failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn(
      "[workspace-sync] failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function confirmDiscardBeforeOpen(): Promise<boolean> {
  const entityState = useEntityGraphStore.getState();
  if (!entityState.isDirty) {
    return true;
  }

  return await getNativeConfirm()(
    "You have unsaved analysis changes. Discard them and open another analysis?",
  );
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

function buildResolvedLayout(
  analysis: Analysis,
  storedLayout: LayoutState,
): LayoutState {
  const validIds = new Set(analysis.entities.map((entity) => entity.id));
  const layout = Object.fromEntries(
    Object.entries(storedLayout).filter(([entityId]) => validIds.has(entityId)),
  );

  const computedPositions = layoutEntities(analysis.entities);
  for (const [entityId, position] of computedPositions) {
    if (!layout[entityId]) {
      layout[entityId] = { ...position, pinned: false };
    }
  }

  return layout;
}

// ── Persistence ──

async function fetchCanonicalAnalysis(): Promise<Analysis | null> {
  try {
    const response = await fetch(EXPORT_SNAPSHOT_ENDPOINT);
    if (response.ok) {
      const snapshot = await response.json();
      if (snapshot?.analysis) {
        return snapshot.analysis as Analysis;
      }
    }
  } catch {
    // server unreachable — caller should fall back to local state
  }
  return null;
}

export async function createAnalysisSavePayload(
  state = useEntityGraphStore.getState(),
): Promise<{
  text: string;
  fileName: string;
  workspace: Workspace;
  source: AnalysisFileReference;
}> {
  // Fetch canonical entity data from server; fall back to renderer state
  const serverAnalysis = await fetchCanonicalAnalysis();
  const analysis = serverAnalysis ?? state.analysis;
  if (!serverAnalysis) {
    console.warn("[export] using local entity state — server unavailable");
  }

  const fallbackName =
    analysis.name.trim() || analysis.topic.trim() || "Untitled Workspace";

  const workspace = createWorkspaceFromAnalysis(analysis, state.layout, {
    id: currentWorkspace?.id ?? analysis.id,
    name: fallbackName,
    createdAt: currentWorkspace?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  });
  rememberWorkspace(workspace);

  return {
    text: serializeWorkspaceFile(workspace),
    fileName: state.fileName ?? createDefaultAnalysisFileName(analysis),
    workspace,
    source: {
      fileName: state.fileName,
      filePath: state.filePath,
      fileHandle: state.fileHandle,
    },
  };
}

export async function saveAnalysisAs(): Promise<boolean> {
  const payload = await createAnalysisSavePayload();

  try {
    let source: AnalysisPersistenceSource | null = null;

    if (window.electronAPI?.isElectron) {
      source = await saveAnalysisAsWithElectron(
        payload.fileName,
        payload.text,
        payload.source.filePath ?? payload.fileName,
      );
    } else if (supportsFileSystemAccess()) {
      try {
        source = await saveAnalysisAsWithPicker(payload.fileName, payload.text);
      } catch (error) {
        if (isUserAbortError(error)) {
          return false;
        }

        if (!isBrowserSaveRestrictionError(error)) {
          throw error;
        }

        source = saveAnalysisAsWithDownload(payload.fileName, payload.text);
      }
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
    await syncWorkspaceState(payload.workspace, source);
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
  const payload = await createAnalysisSavePayload();

  try {
    if (payload.source.fileHandle) {
      let source: AnalysisPersistenceSource = {
        fileName: payload.source.fileName ?? undefined,
        filePath: payload.source.filePath ?? undefined,
        fileHandle: payload.source.fileHandle ?? undefined,
      };

      try {
        await writeTextToFileHandle(payload.source.fileHandle, payload.text);
      } catch (error) {
        if (isUserAbortError(error)) {
          return false;
        }

        if (
          window.electronAPI?.isElectron ||
          !isBrowserSaveRestrictionError(error)
        ) {
          throw error;
        }

        source = saveAnalysisAsWithDownload(payload.fileName, payload.text);
      }

      useEntityGraphStore.getState().commitSave({
        fileName: source.fileName ?? undefined,
        filePath: source.filePath ?? undefined,
        fileHandle: source.fileHandle ?? undefined,
      });
      await syncWorkspaceState(payload.workspace, source);
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
      await syncWorkspaceState(payload.workspace, {
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

export async function loadAnalysisFromText(
  text: string,
  source?: AnalysisPersistenceSource,
): Promise<void> {
  const { workspace, analysis, layout } = parseWorkspaceFileText(text);
  rememberWorkspace(workspace);
  useEntityGraphStore
    .getState()
    .loadAnalysis(analysis, buildResolvedLayout(analysis, layout), {
      fileName: source?.fileName ?? undefined,
      filePath: source?.filePath ?? undefined,
      fileHandle: source?.fileHandle ?? undefined,
    });
  await syncWorkspaceState(workspace, source, true); // import mode — load entities into graph tables
  try {
    await useThreadStore.getState().hydrateWorkspace(workspace.id);
  } catch (error) {
    console.warn(
      "[analysis-persistence] thread hydration failed, continuing without threads:",
      error,
    );
  }
}

export async function initializeWorkspacePersistence(): Promise<void> {
  const workspace = buildWorkspaceSnapshot();
  await syncWorkspaceState(workspace, {
    fileName: null,
    filePath: null,
    fileHandle: null,
  });
  try {
    await useThreadStore.getState().hydrateWorkspace(workspace.id);
  } catch (error) {
    console.warn(
      "[analysis-persistence] thread hydration failed, continuing without threads:",
      error,
    );
  }
}

export async function openAnalysisFromPath(filePath: string): Promise<boolean> {
  if (!(await confirmDiscardBeforeOpen())) {
    return false;
  }

  try {
    const result = await window.electronAPI?.readFile?.(filePath);
    if (!result) {
      return false;
    }

    await loadAnalysisFromText(result.content, {
      fileName: getFileNameFromPath(result.filePath),
      filePath: result.filePath,
      fileHandle: null,
    });
    return true;
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

export async function openAnalysis(): Promise<boolean> {
  if (!(await confirmDiscardBeforeOpen())) {
    return false;
  }

  try {
    if (window.electronAPI?.isElectron) {
      const result = await window.electronAPI.openFile?.();
      if (!result) {
        return false;
      }

      await loadAnalysisFromText(result.content, {
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
      await loadAnalysisFromText(text, {
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
          await loadAnalysisFromText(text, {
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
