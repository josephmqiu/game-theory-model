/**
 * Cross-environment secret storage for API keys.
 *
 * - **Electron**: delegates to `window.electronAPI.secrets`, which encrypts
 *   values at rest with the OS keychain via `safeStorage` in the main process.
 *   Ciphertext never reaches the renderer.
 * - **Electron without OS encryption**: keeps newly typed values in memory for
 *   the current app session only, so local unsigned/ad-hoc builds can still
 *   use one-time BYOK keys without writing plaintext to disk.
 * - **Web**: falls back to `localStorage` under a `gta-secret:` prefix. A
 *   browser tab has no OS keychain, so these values are plaintext — callers
 *   should treat web storage as insecure (see {@link isSecureStorage}).
 *
 * The API is async in both environments so callers do not branch on runtime.
 */

const WEB_PREFIX = "gta-secret:";
const electronSessionSecrets = new Map<string, string>();

/** Whether the encrypted Electron secrets bridge is present. */
function hasElectronSecrets(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.secrets;
}

export function hasElectronSecretBridge(): boolean {
  return hasElectronSecrets();
}

/**
 * Cached result of the encryption-availability probe. `null` until
 * {@link probeSecureStorage} has run at least once.
 */
let secureProbe: boolean | null = null;

/**
 * Ask the main process whether OS-backed encryption is available and cache the
 * answer. Resolves to `false` in web mode. Idempotent enough to call at
 * startup; later calls refresh the cached value.
 */
export async function probeSecureStorage(): Promise<boolean> {
  if (!hasElectronSecrets()) {
    secureProbe = false;
    return false;
  }
  try {
    secureProbe = await window.electronAPI!.secrets!.encryptionAvailable();
  } catch {
    secureProbe = false;
  }
  return secureProbe;
}

/**
 * Synchronous best-effort answer to "are secrets encrypted at rest?". Reflects
 * the last {@link probeSecureStorage} result; returns `false` until a probe has
 * completed (fail-safe: never claim security we have not confirmed).
 */
export function isSecureStorage(): boolean {
  return secureProbe === true;
}

/**
 * Persist a secret. In Electron returns whether it was stored and encrypted; a
 * `{ ok: false }` result means encryption was unavailable and nothing was
 * written. The web fallback always stores (plaintext) and reports
 * `encrypted: false`.
 */
export async function setSecret(
  key: string,
  value: string,
): Promise<{ ok: boolean; encrypted: boolean }> {
  if (hasElectronSecrets()) {
    const result = await window.electronAPI!.secrets!.set(key, value);
    if (result.ok) {
      electronSessionSecrets.delete(key);
      return result;
    }
    electronSessionSecrets.set(key, value);
    return { ok: true, encrypted: false };
  }
  try {
    localStorage.setItem(WEB_PREFIX + key, value);
    return { ok: true, encrypted: false };
  } catch {
    return { ok: false, encrypted: false };
  }
}

/** Read a secret, or `null` if missing/undecryptable. */
export async function getSecret(key: string): Promise<string | null> {
  if (hasElectronSecrets()) {
    const stored = await window.electronAPI!.secrets!.get(key);
    return stored ?? electronSessionSecrets.get(key) ?? null;
  }
  try {
    return localStorage.getItem(WEB_PREFIX + key);
  } catch {
    return null;
  }
}

/** Whether a secret is present. */
export async function hasSecret(key: string): Promise<boolean> {
  if (hasElectronSecrets()) {
    return (
      (await window.electronAPI!.secrets!.has(key)) ||
      electronSessionSecrets.has(key)
    );
  }
  try {
    return localStorage.getItem(WEB_PREFIX + key) !== null;
  } catch {
    return false;
  }
}

/** Delete a secret. */
export async function removeSecret(key: string): Promise<void> {
  if (hasElectronSecrets()) {
    electronSessionSecrets.delete(key);
    await window.electronAPI!.secrets!.remove(key);
    return;
  }
  try {
    localStorage.removeItem(WEB_PREFIX + key);
  } catch {
    // ignore
  }
}

export const secretStorage = {
  setSecret,
  getSecret,
  hasSecret,
  removeSecret,
  isSecureStorage,
  probeSecureStorage,
};
