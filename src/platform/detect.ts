import type { Platform } from './types'

export function detectPlatform(): Platform {
  const isTauri = typeof (globalThis as any).__TAURI_INTERNALS__ !== 'undefined'
  return {
    type: isTauri ? 'tauri' : 'browser',
    capabilities: {
      nativeDialogs: isTauri,
      nativeFs: isTauri,
      nativeWindowChrome: isTauri,
    },
  }
}
