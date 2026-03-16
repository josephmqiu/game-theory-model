import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { GITHUB_OWNER, GITHUB_REPO } from './constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UpdaterStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

export interface UpdaterState {
  status: UpdaterStatus
  currentVersion: string
  latestVersion?: string
  downloadProgress?: number
  releaseDate?: string
  error?: string
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const isDev = !app.isPackaged

let updaterState: UpdaterState = {
  status: isDev ? 'disabled' : 'idle',
  currentVersion: app.getVersion(),
}

let autoUpdateEnabled = true
let updateCheckTimer: ReturnType<typeof setInterval> | null = null
let lastUpdateCheckAt = 0

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getUpdaterState(): UpdaterState {
  return updaterState
}

export function getAutoUpdateEnabled(): boolean {
  return autoUpdateEnabled
}

export function setAutoUpdateEnabled(enabled: boolean): void {
  autoUpdateEnabled = enabled
}

export function broadcastUpdaterState(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('updater:state', updaterState)
    }
  }
}

export function setUpdaterState(next: Partial<UpdaterState>): void {
  updaterState = {
    ...updaterState,
    ...next,
    currentVersion: app.getVersion(),
  }
  broadcastUpdaterState()
}

export async function checkForAppUpdates(force = false): Promise<void> {
  if (isDev) return
  if (!GITHUB_OWNER) return // No publish target configured yet

  const now = Date.now()
  if (!force && now - lastUpdateCheckAt < 60 * 1000) {
    return
  }
  lastUpdateCheckAt = now

  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    setUpdaterState({ status: 'error', error })
  }
}

export function clearUpdateTimer(): void {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer)
    updateCheckTimer = null
  }
}

export function startUpdateTimer(): void {
  if (updateCheckTimer) return
  updateCheckTimer = setInterval(() => {
    void checkForAppUpdates(false)
  }, 60 * 60 * 1000)
  updateCheckTimer.unref()
}

export function quitAndInstall(): boolean {
  if (!isDev && updaterState.status === 'downloaded') {
    autoUpdater.quitAndInstall()
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function setupAutoUpdater(): void {
  if (isDev) return
  if (!GITHUB_OWNER) return // No publish target configured yet

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    releaseType: 'release',
  })

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = true

  autoUpdater.on('checking-for-update', () => {
    setUpdaterState({ status: 'checking', error: undefined, downloadProgress: undefined })
  })

  autoUpdater.on('update-available', (info) => {
    setUpdaterState({
      status: 'available',
      latestVersion: info.version,
      releaseDate: info.releaseDate,
      error: undefined,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    setUpdaterState({
      status: 'downloading',
      downloadProgress: Math.round(progress.percent),
      error: undefined,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    setUpdaterState({
      status: 'downloaded',
      latestVersion: info.version,
      releaseDate: info.releaseDate,
      downloadProgress: 100,
      error: undefined,
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    setUpdaterState({
      status: 'not-available',
      latestVersion: info.version,
      downloadProgress: undefined,
      error: undefined,
    })
  })

  autoUpdater.on('error', (err) => {
    setUpdaterState({
      status: 'error',
      error: err?.message ?? String(err),
    })
  })

  if (autoUpdateEnabled) {
    setTimeout(() => {
      void checkForAppUpdates(true)
    }, 5000)

    startUpdateTimer()
  }
}
