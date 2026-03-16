import type { Platform } from './types'

export function detectPlatform(): Platform {
  return {
    type: 'browser',
    capabilities: {
      nativeDialogs: false,
      nativeFs: false,
      nativeWindowChrome: false,
    },
  }
}
