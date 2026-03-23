import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  type OpenDialogOptions,
  type BrowserWindowConstructorOptions,
} from "electron";
import { execSync } from "node:child_process";
import { fork, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, resolve, extname, sep, dirname } from "node:path";
import { homedir } from "node:os";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";

import { buildAppMenu } from "./app-menu";
import {
  VITE_DEV_PORT,
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_MIN_WIDTH,
  WINDOW_MIN_HEIGHT,
  TITLEBAR_OVERLAY_HEIGHT,
  MACOS_TRAFFIC_LIGHT_POSITION,
  MACOS_TRAFFIC_LIGHT_PAD,
  WIN_CONTROLS_PAD,
  LINUX_CONTROLS_PAD,
  NITRO_HOST,
  NITRO_FALLBACK_TIMEOUT_WIN,
  NITRO_FALLBACK_TIMEOUT_DEFAULT,
} from "./constants";
import {
  setupAutoUpdater,
  broadcastUpdaterState,
  getUpdaterState,
  setUpdaterState,
  checkForAppUpdates,
  clearUpdateTimer,
  startUpdateTimer,
  quitAndInstall,
  getAutoUpdateEnabled,
  setAutoUpdateEnabled,
} from "./auto-updater";
import { initLogger, log, getLogDir } from "./logger";
import { applyGuiPathFix } from "./path-bootstrap";
import { buildNitroChildEnv } from "./nitro-env";
import { isRunningFromMountedDiskImage } from "./install-location";
import {
  getConfiguredUserDataDir,
  getLegacyPortFilePath,
  getPortFilePath,
} from "../src/lib/runtime-state-paths";

let mainWindow: BrowserWindow | null = null;
let nitroProcess: ChildProcess | null = null;
let serverPort = 0;
let pendingFilePath: string | null = null;
const APP_NAME = "Game Theory Analyzer";
const SMOKE_READY_FILE_NAME = "smoke-ready.json";
const ANALYSIS_FILE_EXTENSION = ".gta";
const ANALYSIS_FILE_FILTER: OpenDialogOptions["filters"] = [
  {
    name: "Game Theory Analyzer Files",
    extensions: ["gta"],
  },
];

const isSmokeTestMode = process.env.GAME_THEORY_SMOKE_TEST === "1";
const configuredUserDataDir = getConfiguredUserDataDir({ env: process.env });

if (configuredUserDataDir) {
  app.setPath("userData", configuredUserDataDir);
}

const isDev = !app.isPackaged && !isSmokeTestMode;

function getUserDataPath(): string {
  return app.getPath("userData");
}

function getSmokeReadyFilePath(): string {
  return join(getUserDataPath(), SMOKE_READY_FILE_NAME);
}

// Settings stored in platform-standard app data dir (Electron-managed):
// macOS: ~/Library/Application Support/Game Theory Analyzer/
// Windows: %APPDATA%\Game Theory Analyzer\
// Linux: ~/.config/Game Theory Analyzer/
function getSettingsPath(): string {
  return join(getUserDataPath(), "settings.json");
}

function getPrefsPath(): string {
  return join(getUserDataPath(), "preferences.json");
}

// ---------------------------------------------------------------------------
// Renderer preferences (replaces localStorage which is origin-scoped)
// ---------------------------------------------------------------------------

let prefsCache: Record<string, string> = {};
let prefsDirty = false;
let prefsWriteTimer: ReturnType<typeof setTimeout> | null = null;

async function loadPrefs(): Promise<void> {
  try {
    const raw = await readFile(getPrefsPath(), "utf-8");
    prefsCache = JSON.parse(raw);
  } catch {
    prefsCache = {};
  }
}

function schedulePrefsWrite(): void {
  if (prefsWriteTimer) return;
  prefsDirty = true;
  prefsWriteTimer = setTimeout(async () => {
    prefsWriteTimer = null;
    if (!prefsDirty) return;
    prefsDirty = false;
    try {
      await mkdir(getUserDataPath(), { recursive: true });
      await writeFile(
        getPrefsPath(),
        JSON.stringify(prefsCache, null, 2),
        "utf-8",
      );
    } catch (err) {
      log.error(`[prefs] Failed to write preferences: ${err}`);
    }
  }, 500);
}

// ---------------------------------------------------------------------------
// Fix PATH for GUI apps (shell PATH not inherited)
// ---------------------------------------------------------------------------

function fixPath(): void {
  applyGuiPathFix(process.env, process.platform, homedir());
}

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------

interface AppSettings {
  autoUpdate?: boolean;
}

async function readAppSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(getSettingsPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeAppSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await readAppSettings();
  const merged = { ...current, ...patch };
  await mkdir(getUserDataPath(), { recursive: true });
  await writeFile(getSettingsPath(), JSON.stringify(merged, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Port file for MCP sync discovery.
// ---------------------------------------------------------------------------

function getCanonicalPortFilePath(): string {
  return isDev
    ? getLegacyPortFilePath()
    : getPortFilePath({ userDataDir: getUserDataPath() });
}

async function unlinkIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Ignore if already removed
  }
}

async function writePortFile(port: number): Promise<void> {
  const portFilePath = getCanonicalPortFilePath();
  try {
    await mkdir(dirname(portFilePath), { recursive: true });
    await writeFile(
      portFilePath,
      JSON.stringify({ port, pid: process.pid, timestamp: Date.now() }),
      "utf-8",
    );
    if (!isDev) {
      await unlinkIfPresent(getLegacyPortFilePath());
    }
  } catch (err) {
    log.error(`[port-file] Failed to write port file: ${err}`);
  }
}

async function cleanupPortFile(): Promise<void> {
  await unlinkIfPresent(getCanonicalPortFilePath());
  if (!isDev) {
    await unlinkIfPresent(getLegacyPortFilePath());
  }
}

async function writeSmokeReadyFile(data: Record<string, unknown>): Promise<void> {
  if (!isSmokeTestMode) return;

  const filePath = getSmokeReadyFilePath();
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    log.error(`[smoke] Failed to write readiness file: ${err}`);
  }
}

async function cleanupSmokeReadyFile(): Promise<void> {
  if (!isSmokeTestMode) return;
  await unlinkIfPresent(getSmokeReadyFilePath());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFreePorts(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, NITRO_HOST, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const { port } = addr;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Failed to get free port"));
      }
    });
    server.on("error", reject);
  });
}

function getServerEntry(): string {
  if (!app.isPackaged) {
    const appPath = app.getAppPath();
    const candidates = [
      join(appPath, ".output", "server", "index.mjs"),
      resolve(appPath, "..", ".output", "server", "index.mjs"),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }
  // In production, extraResources copies .output into the resources folder
  return join(process.resourcesPath, "server", "index.mjs");
}

function isAnalysisFilePath(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ANALYSIS_FILE_EXTENSION;
}

function ensureAnalysisFileName(filePath: string): string {
  const currentExt = extname(filePath);
  if (currentExt.toLowerCase() === ANALYSIS_FILE_EXTENSION) return filePath;
  return `${filePath.slice(0, filePath.length - currentExt.length)}${ANALYSIS_FILE_EXTENSION}`;
}

// ---------------------------------------------------------------------------
// Nitro server
// ---------------------------------------------------------------------------

async function startNitroServer(): Promise<number> {
  const port = await getFreePorts();
  const entry = getServerEntry();

  return new Promise((resolve, reject) => {
    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const child = fork(entry, [], {
      env: buildNitroChildEnv(process.env, {
        host: NITRO_HOST,
        port,
        resourcesPath: process.resourcesPath,
        userDataDir: getUserDataPath(),
      }),
      stdio: "pipe",
    });

    nitroProcess = child;

    const settleResolve = () => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      resolve(port);
    };

    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      reject(error);
    };

    child.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString();
      log.info(`[nitro] ${msg.trimEnd()}`);
      // Resolve once Nitro reports it's listening
      if (msg.includes("Listening") || msg.includes("ready")) {
        settleResolve();
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      log.error(`[nitro:err] ${data.toString().trimEnd()}`);
    });

    child.on("error", (error) => {
      settleReject(
        error instanceof Error ? error : new Error(String(error)),
      );
    });
    child.on("exit", (code) => {
      if (!settled) {
        settleReject(
          new Error(`Nitro exited before readiness with code ${code ?? "unknown"}`),
        );
      }
      if (code !== 0 && code !== null) {
        log.error(`Nitro exited with code ${code}`);
      }
      nitroProcess = null;
      // Auto-restart Nitro server if it crashes while app is running
      if (
        code !== 0 &&
        code !== null &&
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        log.info("[nitro] Restarting server after crash...");
        startNitroServer()
          .then((newPort) => {
            serverPort = newPort;
            writePortFile(newPort);
            log.info(`[nitro] Restarted on port ${newPort}`);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`http://${NITRO_HOST}:${newPort}/editor`);
            }
          })
          .catch((err) => {
            log.error(`[nitro] Failed to restart: ${err}`);
          });
      }
    });

    // Fallback: if no stdout "ready" message comes, wait then resolve anyway.
    // Use longer timeout on Windows (slower process creation).
    const fallbackMs =
      process.platform === "win32"
        ? NITRO_FALLBACK_TIMEOUT_WIN
        : NITRO_FALLBACK_TIMEOUT_DEFAULT;
    fallbackTimer = setTimeout(() => settleResolve(), fallbackMs);
  });
}

async function waitForAnalysisStateReady(
  port: number,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `http://${NITRO_HOST}:${port}/api/ai/state`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function handleStartupFailure(err: unknown, title: string): void {
  const detail = err instanceof Error ? err.message : String(err);
  log.error(`${title}: ${detail}`);

  if (isSmokeTestMode) {
    app.exit(1);
    return;
  }

  dialog.showErrorBox(
    APP_NAME,
    `${title}.\n\n${detail}\n\nThe application will now quit.`,
  );
  app.quit();
}

// ---------------------------------------------------------------------------
// Linux window-controls side detection
// ---------------------------------------------------------------------------

/** Cached result for Linux controls side detection. */
let cachedLinuxControlsSide: "left" | "right" | null = null;

/**
 * Detect whether Linux DE places window controls on the left or right.
 * Uses gsettings (GNOME/Cinnamon/MATE) as primary check, checks XDG_CURRENT_DESKTOP
 * for known right-side DEs, then defaults to right. Result is cached.
 */
function getLinuxControlsSide(): "left" | "right" {
  if (cachedLinuxControlsSide) return cachedLinuxControlsSide;

  let result: "left" | "right" = "right";

  // Try gsettings (works for GNOME, Cinnamon, MATE, Budgie)
  try {
    const layout = execSync(
      "gsettings get org.gnome.desktop.wm.preferences button-layout",
      { encoding: "utf-8", timeout: 3000 },
    )
      .trim()
      .replace(/'/g, "");
    const colonIndex = layout.indexOf(":");
    if (colonIndex >= 0) {
      const beforeColon = layout.slice(0, colonIndex);
      if (
        beforeColon.includes("close") ||
        beforeColon.includes("minimize") ||
        beforeColon.includes("maximize")
      ) {
        result = "left";
      }
    }
  } catch {
    // gsettings not available — check desktop environment
    const desktop = (process.env.XDG_CURRENT_DESKTOP || "").toLowerCase();
    // KDE, XFCE, LXQt default to right. elementary OS defaults to left.
    if (desktop.includes("pantheon")) {
      result = "left";
    }
  }

  cachedLinuxControlsSide = result;
  return result;
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow(): void {
  const isWinOrLinux =
    process.platform === "win32" || process.platform === "linux";

  const windowOptions: BrowserWindowConstructorOptions = {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    title: APP_NAME,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    ...(isWinOrLinux
      ? {
          titleBarOverlay: {
            // Windows supports transparent overlay; Linux uses solid color (updated via theme:set IPC)
            color: process.platform === "win32" ? "rgba(0,0,0,0)" : "#1a1a1a",
            symbolColor: "#d4d4d8",
            height: TITLEBAR_OVERLAY_HEIGHT,
          },
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Persist localStorage/cookies in a fixed partition so data survives
      // across random Nitro server port changes (origin-independent storage).
      partition: "persist:game-theory-analyzer",
    },
  };

  if (process.platform === "darwin") {
    windowOptions.trafficLightPosition = MACOS_TRAFFIC_LIGHT_POSITION;
  }

  // Start hidden to avoid visual flash before CSS injection
  windowOptions.show = false;

  mainWindow = new BrowserWindow(windowOptions);

  // Hide native menu bar on Windows/Linux (shortcuts still work via Alt key)
  if (isWinOrLinux) {
    mainWindow.setAutoHideMenuBar(true);
    mainWindow.setMenuBarVisibility(false);
  }

  const url = isDev
    ? `http://localhost:${VITE_DEV_PORT}/editor`
    : `http://${NITRO_HOST}:${serverPort}/editor`;

  // Inject traffic-light padding CSS then show window (no flash)
  mainWindow.webContents.on("did-finish-load", async () => {
    if (!mainWindow) return;
    if (process.platform === "darwin") {
      await mainWindow.webContents.insertCSS(
        `.electron-traffic-light-pad { margin-left: ${MACOS_TRAFFIC_LIGHT_PAD}px; }` +
          ".electron-fullscreen .electron-traffic-light-pad { margin-left: 0; }",
      );
    }
    if (process.platform === "win32") {
      await mainWindow.webContents.insertCSS(
        `.electron-win-controls-pad { margin-right: ${WIN_CONTROLS_PAD}px; }`,
      );
    }
    if (process.platform === "linux") {
      const side = getLinuxControlsSide();
      if (side === "left") {
        await mainWindow.webContents.insertCSS(
          `.electron-traffic-light-pad { margin-left: ${LINUX_CONTROLS_PAD}px; }`,
        );
      } else {
        await mainWindow.webContents.insertCSS(
          `.electron-win-controls-pad { margin-right: ${LINUX_CONTROLS_PAD}px; }`,
        );
      }
    }
    if (!isSmokeTestMode) {
      mainWindow.show();
    }
    broadcastUpdaterState();

    if (!isDev) {
      try {
        await waitForAnalysisStateReady(serverPort);
        await writeSmokeReadyFile({
          ready: true,
          port: serverPort,
          timestamp: Date.now(),
          url: `http://${NITRO_HOST}:${serverPort}/editor`,
        });
      } catch (err) {
        handleStartupFailure(err, "Smoke readiness probe failed");
      }
    }
  });

  // Toggle fullscreen class to remove traffic-light padding in fullscreen
  if (process.platform === "darwin") {
    mainWindow.on("enter-full-screen", () => {
      mainWindow?.webContents.executeJavaScript(
        'document.body.classList.add("electron-fullscreen")',
      );
    });
    mainWindow.on("leave-full-screen", () => {
      mainWindow?.webContents.executeJavaScript(
        'document.body.classList.remove("electron-fullscreen")',
      );
    });
  }

  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC: native file dialogs & updater
// ---------------------------------------------------------------------------

function setupIPC(): void {
  ipcMain.handle("dialog:openFile", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Open Analysis File",
      filters: ANALYSIS_FILE_FILTER,
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    if (!isAnalysisFilePath(filePath)) return null;
    const content = await readFile(filePath, "utf-8");
    return { filePath, content };
  });

  ipcMain.handle(
    "dialog:saveFile",
    async (_event, payload: { content: string; defaultPath?: string }) => {
      if (!mainWindow) return null;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Save Analysis File",
        defaultPath: payload.defaultPath
          ? ensureAnalysisFileName(payload.defaultPath)
          : `untitled${ANALYSIS_FILE_EXTENSION}`,
        filters: ANALYSIS_FILE_FILTER,
      });
      if (result.canceled || !result.filePath) return null;
      const filePath = ensureAnalysisFileName(result.filePath);
      await writeFile(filePath, payload.content, "utf-8");
      return filePath;
    },
  );

  ipcMain.handle(
    "dialog:saveToPath",
    async (_event, payload: { filePath: string; content: string }) => {
      const resolved = resolve(payload.filePath);
      if (resolved.includes("\0")) {
        throw new Error("Invalid file path");
      }
      const ext = extname(resolved).toLowerCase();
      if (ext !== ANALYSIS_FILE_EXTENSION) {
        throw new Error("Only .gta file extensions are allowed");
      }
      // Directory allowlist: only allow writes under user home or OS temp
      const allowedRoots = [app.getPath("home"), app.getPath("temp")];
      const inAllowedDir = allowedRoots.some(
        (root) => resolved === root || resolved.startsWith(root + sep),
      );
      if (!inAllowedDir) {
        throw new Error(
          "File path must be within the user home or temp directory",
        );
      }
      await writeFile(resolved, payload.content, "utf-8");
      return resolved;
    },
  );

  ipcMain.handle("file:getPending", () => {
    if (pendingFilePath) {
      const filePath = pendingFilePath;
      pendingFilePath = null;
      return filePath;
    }
    return null;
  });

  ipcMain.handle("file:read", async (_event, filePath: string) => {
    const resolved = resolve(filePath);
    const ext = extname(resolved).toLowerCase();
    if (ext !== ANALYSIS_FILE_EXTENSION) return null;
    const allowedRoots = [app.getPath("home"), app.getPath("temp")];
    const inAllowedDir = allowedRoots.some(
      (root) => resolved === root || resolved.startsWith(root + sep),
    );
    if (!inAllowedDir) return null;
    try {
      const content = await readFile(resolved, "utf-8");
      return { filePath: resolved, content };
    } catch {
      return null;
    }
  });

  // Generic renderer preferences (replaces localStorage which is origin-scoped
  // and lost when Nitro server restarts on a different random port)
  ipcMain.handle("prefs:getAll", () => ({ ...prefsCache }));

  ipcMain.handle("prefs:set", (_event, key: string, value: string) => {
    prefsCache[key] = value;
    schedulePrefsWrite();
  });

  ipcMain.handle("prefs:remove", (_event, key: string) => {
    delete prefsCache[key];
    schedulePrefsWrite();
  });

  ipcMain.handle("log:getDir", () => getLogDir());

  ipcMain.handle("updater:getState", () => getUpdaterState());
  ipcMain.handle("updater:checkForUpdates", async () => {
    await checkForAppUpdates(true);
    return getUpdaterState();
  });
  ipcMain.handle("updater:quitAndInstall", () => quitAndInstall());
  ipcMain.handle("updater:getAutoCheck", () => getAutoUpdateEnabled());

  ipcMain.handle("updater:setAutoCheck", async (_event, enabled: boolean) => {
    setAutoUpdateEnabled(enabled);
    await writeAppSettings({ autoUpdate: enabled });

    if (enabled) {
      startUpdateTimer();
      setUpdaterState({ status: "idle" });
    } else {
      clearUpdateTimer();
      setUpdaterState({ status: "disabled" });
    }
    return enabled;
  });
}

// ---------------------------------------------------------------------------
// File association: open .gta files
// ---------------------------------------------------------------------------

/** Extract .gta file path from command-line arguments. */
function getFilePathFromArgs(args: string[]): string | null {
  for (const arg of args) {
    // Skip flags and the Electron binary/script path
    if (arg.startsWith("-") || arg.startsWith("--")) continue;
    const ext = extname(arg).toLowerCase();
    if (ext === ANALYSIS_FILE_EXTENSION) {
      return arg;
    }
  }
  return null;
}

/** Send a file path to the renderer for loading. */
function sendOpenFile(filePath: string): void {
  if (!isAnalysisFilePath(filePath)) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("file:open", filePath);
  } else {
    pendingFilePath = filePath;
  }
}

// macOS: open-file fires when user double-clicks a .gta file
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (app.isReady()) {
    sendOpenFile(filePath);
  } else {
    if (isAnalysisFilePath(filePath)) {
      pendingFilePath = filePath;
    }
  }
});

// Single instance lock (Windows/Linux: second instance passes file path as arg)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const filePath = getFilePathFromArgs(argv);
    if (filePath) {
      sendOpenFile(filePath);
    }
    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

async function blockMountedDiskImageLaunch(): Promise<boolean> {
  if (isSmokeTestMode) {
    return false;
  }

  if (!isRunningFromMountedDiskImage(process.platform, app.isPackaged, process.execPath)) {
    return false;
  }

  const { response } = await dialog.showMessageBox({
    type: "info",
    buttons: ["Move to Applications", "Quit"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: APP_NAME,
    message: `Install ${APP_NAME} before opening it.`,
    detail:
      "This copy is running directly from the mounted disk image. Move it to Applications first to avoid unnecessary macOS privacy prompts and to enable normal updates.",
  });

  if (response !== 0) {
    app.quit();
    return true;
  }

  try {
    const moved = app.moveToApplicationsFolder();
    if (!moved) {
      app.quit();
    }
    return true;
  } catch (err) {
    dialog.showErrorBox(
      APP_NAME,
      `Could not move the app to Applications.\n\n${err instanceof Error ? err.message : String(err)}`,
    );
    app.quit();
    return true;
  }
}

app.on("ready", async () => {
  app.setName(APP_NAME);

  if (await blockMountedDiskImageLaunch()) {
    return;
  }

  await initLogger(getUserDataPath());
  fixPath();
  await loadPrefs();
  setupIPC();
  buildAppMenu();

  if (!isDev) {
    try {
      serverPort = await startNitroServer();
      log.info(`Nitro server started on port ${serverPort}`);
      await writePortFile(serverPort);
    } catch (err) {
      handleStartupFailure(err, "Failed to start the application server");
      return;
    }
  } else {
    // Dev mode: Vite dev server runs on port 3000
    await writePortFile(VITE_DEV_PORT);
  }

  createWindow();

  // Check for file to open: pending open-file event or CLI args (Windows/Linux).
  // The file path is stored in pendingFilePath and pulled by the renderer
  // via file:getPending IPC when the React app mounts.
  if (!pendingFilePath) {
    pendingFilePath = getFilePathFromArgs(process.argv);
  }

  if (!isDev && !isSmokeTestMode) {
    const settings = await readAppSettings();
    const autoUpdate = settings.autoUpdate !== false;
    setAutoUpdateEnabled(autoUpdate);
    if (autoUpdate) {
      setupAutoUpdater();
    } else {
      setUpdaterState({ status: "disabled" });
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", async () => {
  clearUpdateTimer();
  await cleanupSmokeReadyFile();
  await cleanupPortFile();
  killNitroProcess();
});

/** Platform-aware Nitro process termination. */
function killNitroProcess(): void {
  if (!nitroProcess) return;
  if (process.platform === "win32") {
    // SIGTERM is unreliable on Windows; use taskkill for proper tree-kill
    try {
      const pid = nitroProcess.pid;
      if (pid) {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
      }
    } catch {
      /* process may have already exited */
    }
  } else {
    nitroProcess.kill("SIGTERM");
  }
  nitroProcess = null;
}

// Ensure child process cleanup on unexpected termination (Linux/macOS signals)
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => {
    killNitroProcess();
    Promise.all([cleanupPortFile(), cleanupSmokeReadyFile()]).finally(() =>
      process.exit(0),
    );
  });
}
