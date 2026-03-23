import {
  mkdir as defaultMkdir,
  readFile as defaultReadFile,
  writeFile as defaultWriteFile,
} from "node:fs/promises";

interface FsLike {
  mkdir: typeof defaultMkdir;
  readFile: typeof defaultReadFile;
  writeFile: typeof defaultWriteFile;
}

interface PreferenceStoreOptions {
  getPrefsPath: () => string;
  getUserDataPath: () => string;
  logError: (message: string) => void;
  writeDelayMs?: number;
  fs?: Partial<FsLike>;
}

interface AppSettingsStoreOptions {
  getSettingsPath: () => string;
  getUserDataPath: () => string;
  fs?: Partial<FsLike>;
}

function getFs(overrides?: Partial<FsLike>): FsLike {
  return {
    mkdir: overrides?.mkdir ?? defaultMkdir,
    readFile: overrides?.readFile ?? defaultReadFile,
    writeFile: overrides?.writeFile ?? defaultWriteFile,
  };
}

export function createPreferenceStore({
  getPrefsPath,
  getUserDataPath,
  logError,
  writeDelayMs = 500,
  fs: fsOverrides,
}: PreferenceStoreOptions) {
  const fs = getFs(fsOverrides);

  let prefsCache: Record<string, string> = {};
  let prefsWriteTimer: ReturnType<typeof setTimeout> | null = null;
  let writeInFlight = false;
  let currentRevision = 0;
  let lastWrittenRevision = 0;

  async function load(): Promise<void> {
    try {
      const raw = await fs.readFile(getPrefsPath(), "utf-8");
      const parsed = JSON.parse(raw);
      prefsCache =
        parsed && typeof parsed === "object"
          ? (parsed as Record<string, string>)
          : {};
    } catch {
      prefsCache = {};
    }
    currentRevision = 0;
    lastWrittenRevision = 0;
  }

  async function flushWrite(): Promise<void> {
    if (writeInFlight) return;
    if (currentRevision === lastWrittenRevision) return;

    writeInFlight = true;
    const targetRevision = currentRevision;
    const serialized = JSON.stringify(prefsCache, null, 2);

    try {
      await fs.mkdir(getUserDataPath(), { recursive: true });
      await fs.writeFile(getPrefsPath(), serialized, "utf-8");
      lastWrittenRevision = targetRevision;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`[prefs] Failed to write preferences: ${message}`);
    } finally {
      writeInFlight = false;
      if (currentRevision !== lastWrittenRevision) {
        scheduleWrite();
      }
    }
  }

  function scheduleWrite(): void {
    if (prefsWriteTimer || writeInFlight) return;
    prefsWriteTimer = setTimeout(() => {
      prefsWriteTimer = null;
      void flushWrite();
    }, writeDelayMs);
  }

  function set(key: string, value: string): void {
    prefsCache[key] = value;
    currentRevision += 1;
    scheduleWrite();
  }

  function remove(key: string): void {
    delete prefsCache[key];
    currentRevision += 1;
    scheduleWrite();
  }

  function getAll(): Record<string, string> {
    return { ...prefsCache };
  }

  function hasPendingWrite(): boolean {
    return (
      prefsWriteTimer !== null ||
      writeInFlight ||
      currentRevision !== lastWrittenRevision
    );
  }

  return {
    getAll,
    hasPendingWrite,
    load,
    remove,
    set,
  };
}

export function createAppSettingsStore<TSettings extends object>({
  getSettingsPath,
  getUserDataPath,
  fs: fsOverrides,
}: AppSettingsStoreOptions) {
  const fs = getFs(fsOverrides);
  let writeQueue = Promise.resolve();

  async function read(): Promise<TSettings> {
    try {
      const raw = await fs.readFile(getSettingsPath(), "utf-8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as TSettings) : ({} as TSettings);
    } catch {
      return {} as TSettings;
    }
  }

  async function performWrite(patch: Partial<TSettings>): Promise<void> {
    const current = await read();
    const merged = { ...current, ...patch };
    await fs.mkdir(getUserDataPath(), { recursive: true });
    await fs.writeFile(
      getSettingsPath(),
      JSON.stringify(merged, null, 2),
      "utf-8",
    );
  }

  async function write(patch: Partial<TSettings>): Promise<void> {
    const nextWrite = writeQueue.then(() => performWrite(patch));
    writeQueue = nextWrite.catch(() => {});
    await nextWrite;
  }

  return {
    read,
    write,
  };
}
