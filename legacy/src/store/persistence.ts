function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key)
    }
    const value = (localStorage as Record<string, unknown>)[key]
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value)
      return
    }
    ;(localStorage as Record<string, unknown>)[key] = value
  } catch {
    // Ignore persistence failures in browser-only fallback mode.
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(key)
      return
    }
    delete (localStorage as Record<string, unknown>)[key]
  } catch {
    // Ignore persistence failures in browser-only fallback mode.
  }
}

export interface BrowserPersistenceAdapter<T> {
  load: (analysisId: string | null) => T | null
  save: (analysisId: string | null, value: T) => void
  clear: (analysisId: string | null) => void
}

export function createBrowserPersistenceAdapter<T>(namespace: string): BrowserPersistenceAdapter<T> {
  function buildKey(analysisId: string): string {
    return `${namespace}:${analysisId}`
  }

  return {
    load: (analysisId) => {
      if (!analysisId) {
        return null
      }

      const raw = safeGetItem(buildKey(analysisId))
      if (!raw) {
        return null
      }

      try {
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    },
    save: (analysisId, value) => {
      if (!analysisId) {
        return
      }

      safeSetItem(buildKey(analysisId), JSON.stringify(value))
    },
    clear: (analysisId) => {
      if (!analysisId) {
        return
      }

      safeRemoveItem(buildKey(analysisId))
    },
  }
}
