import type { SafeStorage } from "electron";

/**
 * Encrypted-at-rest secret storage for API keys.
 *
 * Secrets are persisted in the same preference store as other renderer
 * preferences, but under a reserved `secret:` key prefix and encrypted with
 * Electron's OS-backed `safeStorage`. The ciphertext is base64-encoded so it
 * round-trips through the JSON preference file. Callers on the renderer side
 * never see the `secret:` entries: they are stripped from the `prefs:getAll`
 * response and the plain `prefs:set` / `prefs:remove` paths refuse to touch
 * them.
 */

export const SECRET_PREFIX = "secret:";

/** Whether a raw preference key belongs to the reserved secret namespace. */
export function isSecretKey(key: string): boolean {
  return key.startsWith(SECRET_PREFIX);
}

/** Drop every `secret:`-prefixed entry so ciphertext never reaches the renderer. */
export function stripSecretKeys(
  record: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!isSecretKey(key)) {
      result[key] = value;
    }
  }
  return result;
}

type SafeStorageLike = Pick<
  SafeStorage,
  "isEncryptionAvailable" | "encryptString" | "decryptString"
>;

interface SecretStoreLike {
  get: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

interface SecretsServiceOptions {
  safeStorage: SafeStorageLike;
  store: SecretStoreLike;
  logWarn: (message: string) => void;
}

export interface SecretsService {
  encryptionAvailable: () => boolean;
  set: (key: string, plaintext: string) => { ok: boolean; encrypted: boolean };
  get: (key: string) => string | null;
  has: (key: string) => boolean;
  remove: (key: string) => void;
}

export function createSecretsService({
  safeStorage,
  store,
  logWarn,
}: SecretsServiceOptions): SecretsService {
  function encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  function set(
    key: string,
    plaintext: string,
  ): { ok: boolean; encrypted: boolean } {
    if (!safeStorage.isEncryptionAvailable()) {
      // Refuse to persist plaintext on disk: the UI must warn and require an
      // explicit opt-in that is out of scope here.
      return { ok: false, encrypted: false };
    }
    const encrypted = safeStorage.encryptString(plaintext).toString("base64");
    store.set(SECRET_PREFIX + key, encrypted);
    return { ok: true, encrypted: true };
  }

  function get(key: string): string | null {
    const stored = store.get(SECRET_PREFIX + key);
    if (stored === undefined) return null;
    try {
      return safeStorage.decryptString(Buffer.from(stored, "base64"));
    } catch {
      logWarn(`[secrets] Failed to decrypt secret for key "${key}"`);
      return null;
    }
  }

  function has(key: string): boolean {
    return store.get(SECRET_PREFIX + key) !== undefined;
  }

  function remove(key: string): void {
    store.remove(SECRET_PREFIX + key);
  }

  return { encryptionAvailable, set, get, has, remove };
}
