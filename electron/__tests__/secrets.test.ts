import { describe, expect, it, vi } from "vitest";

import {
  createSecretsService,
  isSecretKey,
  stripSecretKeys,
  SECRET_PREFIX,
} from "../secrets";

/** In-memory stand-in for the preference store's get/set/remove. */
function createFakeStore(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    get: (key: string) => data[key],
    set: (key: string, value: string) => {
      data[key] = value;
    },
    remove: (key: string) => {
      delete data[key];
    },
  };
}

/**
 * Fake safeStorage that "encrypts" by prefixing so we can assert ciphertext !=
 * plaintext without a real OS keychain.
 */
function createFakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plaintext: string) =>
      Buffer.from(`enc:${plaintext}`, "utf-8"),
    decryptString: (buffer: Buffer) => {
      const raw = buffer.toString("utf-8");
      if (!raw.startsWith("enc:")) throw new Error("bad ciphertext");
      return raw.slice("enc:".length);
    },
  };
}

describe("secret key helpers", () => {
  it("identifies reserved secret keys", () => {
    expect(isSecretKey("secret:customProvider.apiKey")).toBe(true);
    expect(isSecretKey("panelCorner")).toBe(false);
  });

  it("strips secret entries from a preference record", () => {
    const filtered = stripSecretKeys({
      panelCorner: "bottom-left",
      "secret:search.apiKey": "cipher",
    });
    expect(filtered).toEqual({ panelCorner: "bottom-left" });
  });
});

describe("createSecretsService", () => {
  it("round-trips set/get when encryption is available", () => {
    const store = createFakeStore();
    const safeStorage = createFakeSafeStorage(true);
    const service = createSecretsService({
      safeStorage,
      store,
      logWarn: vi.fn(),
    });

    const result = service.set("customProvider.apiKey", "sk-test-123");
    expect(result).toEqual({ ok: true, encrypted: true });

    // Stored under the prefix, and as ciphertext (not the plaintext value).
    const stored = store.data[`${SECRET_PREFIX}customProvider.apiKey`];
    expect(stored).toBeDefined();
    expect(stored).not.toContain("sk-test-123");

    expect(service.get("customProvider.apiKey")).toBe("sk-test-123");
    expect(service.has("customProvider.apiKey")).toBe(true);
  });

  it("refuses to write when encryption is unavailable", () => {
    const store = createFakeStore();
    const service = createSecretsService({
      safeStorage: createFakeSafeStorage(false),
      store,
      logWarn: vi.fn(),
    });

    const result = service.set("search.apiKey", "plaintext-key");
    expect(result).toEqual({ ok: false, encrypted: false });
    expect(store.data).toEqual({});
  });

  it("returns null and warns on undecryptable ciphertext", () => {
    const store = createFakeStore({
      [`${SECRET_PREFIX}search.apiKey`]: Buffer.from(
        "garbage",
        "utf-8",
      ).toString("base64"),
    });
    const logWarn = vi.fn();
    const service = createSecretsService({
      safeStorage: createFakeSafeStorage(true),
      store,
      logWarn,
    });

    expect(service.get("search.apiKey")).toBeNull();
    expect(logWarn).toHaveBeenCalledOnce();
    // Never log the value itself.
    expect(logWarn.mock.calls[0][0]).not.toContain("garbage");
  });

  it("returns null for a missing secret", () => {
    const service = createSecretsService({
      safeStorage: createFakeSafeStorage(true),
      store: createFakeStore(),
      logWarn: vi.fn(),
    });
    expect(service.get("nope")).toBeNull();
    expect(service.has("nope")).toBe(false);
  });

  it("removes a secret", () => {
    const store = createFakeStore();
    const service = createSecretsService({
      safeStorage: createFakeSafeStorage(true),
      store,
      logWarn: vi.fn(),
    });
    service.set("k", "v");
    service.remove("k");
    expect(service.has("k")).toBe(false);
    expect(store.data).toEqual({});
  });
});
