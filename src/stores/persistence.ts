/**
 * Storage adapter that works in both Electron and browser contexts.
 * In Electron, uses the main process preferences API for persistence
 * that survives Nitro port changes. Falls back to localStorage.
 */

export interface PersistenceAdapter<T> {
  load(key: string): T | null;
  save(key: string, value: T): void;
  clear(key: string): void;
}

export function createBrowserPersistenceAdapter<T>(
  namespace: string,
): PersistenceAdapter<T> {
  function storageKey(key: string): string {
    return `${namespace}:${key}`;
  }

  return {
    load(key: string): T | null {
      try {
        const raw = localStorage.getItem(storageKey(key));
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },

    save(key: string, value: T): void {
      try {
        localStorage.setItem(storageKey(key), JSON.stringify(value));
      } catch {
        // localStorage quota exceeded or unavailable
      }
    },

    clear(key: string): void {
      try {
        localStorage.removeItem(storageKey(key));
      } catch {
        // ignore
      }
    },
  };
}
