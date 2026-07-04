// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSecret,
  hasSecret,
  isSecureStorage,
  probeSecureStorage,
  removeSecret,
  setSecret,
} from "@/utils/secret-storage";

function clearElectron() {
  Object.defineProperty(window, "electronAPI", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

// This vitest jsdom setup does not ship a localStorage; provide a minimal
// in-memory Storage so the web fallback path can be exercised.
function installLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  };
  vi.stubGlobal("localStorage", storage);
}

beforeEach(() => {
  installLocalStorage();
});

describe("secret-storage web fallback", () => {
  beforeEach(() => {
    clearElectron();
    localStorage.clear();
  });

  it("stores and reads via localStorage under the gta-secret prefix", async () => {
    const result = await setSecret("search.apiKey", "web-key");
    expect(result).toEqual({ ok: true, encrypted: false });
    expect(localStorage.getItem("gta-secret:search.apiKey")).toBe("web-key");

    expect(await getSecret("search.apiKey")).toBe("web-key");
    expect(await hasSecret("search.apiKey")).toBe(true);

    await removeSecret("search.apiKey");
    expect(await getSecret("search.apiKey")).toBeNull();
    expect(await hasSecret("search.apiKey")).toBe(false);
  });

  it("reports insecure storage on the web", async () => {
    expect(await probeSecureStorage()).toBe(false);
    expect(isSecureStorage()).toBe(false);
  });
});

describe("secret-storage electron path", () => {
  const secrets = {
    set: vi.fn(),
    get: vi.fn(),
    has: vi.fn(),
    remove: vi.fn(),
    encryptionAvailable: vi.fn(),
  };

  beforeEach(() => {
    for (const fn of Object.values(secrets)) fn.mockReset();
    Object.defineProperty(window, "electronAPI", {
      value: { secrets },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    clearElectron();
  });

  it("delegates to the electron secrets bridge", async () => {
    secrets.set.mockResolvedValue({ ok: true, encrypted: true });
    secrets.get.mockResolvedValue("sk-live");
    secrets.has.mockResolvedValue(true);
    secrets.remove.mockResolvedValue(undefined);

    expect(await setSecret("customProvider.apiKey", "sk-live")).toEqual({
      ok: true,
      encrypted: true,
    });
    expect(secrets.set).toHaveBeenCalledWith(
      "customProvider.apiKey",
      "sk-live",
    );

    expect(await getSecret("customProvider.apiKey")).toBe("sk-live");
    expect(await hasSecret("customProvider.apiKey")).toBe(true);

    await removeSecret("customProvider.apiKey");
    expect(secrets.remove).toHaveBeenCalledWith("customProvider.apiKey");

    // Web fallback must not have been touched.
    expect(localStorage.getItem("gta-secret:customProvider.apiKey")).toBeNull();
  });

  it("reflects the encryption probe in isSecureStorage", async () => {
    secrets.encryptionAvailable.mockResolvedValue(true);
    expect(await probeSecureStorage()).toBe(true);
    expect(isSecureStorage()).toBe(true);

    secrets.encryptionAvailable.mockResolvedValue(false);
    expect(await probeSecureStorage()).toBe(false);
    expect(isSecureStorage()).toBe(false);
  });
});
