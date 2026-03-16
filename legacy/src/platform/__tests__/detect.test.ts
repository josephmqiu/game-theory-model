import { describe, it, expect, afterEach } from 'vitest'
import { detectPlatform } from '../detect'

describe('detectPlatform', () => {
  afterEach(() => {
    delete (globalThis as any).__TAURI_INTERNALS__
  })

  it('detects browser platform when no Tauri', () => {
    const platform = detectPlatform()
    expect(platform.type).toBe('browser')
    expect(platform.capabilities.nativeDialogs).toBe(false)
  })

  it('keeps browser platform even when Tauri internals are present', () => {
    ;(globalThis as any).__TAURI_INTERNALS__ = {}
    const platform = detectPlatform()
    expect(platform.type).toBe('browser')
    expect(platform.capabilities.nativeDialogs).toBe(false)
  })
})
