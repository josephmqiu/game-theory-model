import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BrowserFileService } from '../browser-file-service'

function clearLocalStorage(): void {
  if (typeof localStorage.clear === 'function') {
    localStorage.clear()
  } else {
    // jsdom v28+ exposes localStorage as a plain object without Storage methods
    for (const key of Object.keys(localStorage)) {
      delete (localStorage as Record<string, unknown>)[key]
    }
  }
}

describe('BrowserFileService', () => {
  let service: BrowserFileService

  beforeEach(() => {
    clearLocalStorage()
    service = new BrowserFileService()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty recent files initially', async () => {
    const files = await service.getRecentFiles()
    expect(files).toEqual([])
  })

  it('loads fixture by name', async () => {
    const result = await service.loadFixture('sample')
    expect(result.status).toBe('success')
  })

  it('sanitizes malformed recent files from storage', async () => {
    const payload = JSON.stringify([
      { path: 'valid.gta.json', name: 'valid.gta.json', lastOpened: 123 },
      { path: 42, name: 'broken', lastOpened: 'today' },
    ])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === 'strategic-lens:recent-files' ? payload : null),
      setItem: vi.fn(),
      clear: vi.fn(),
    })

    const files = await service.getRecentFiles()

    expect(files).toEqual([
      { path: 'valid.gta.json', name: 'valid.gta.json', lastOpened: 123 },
    ])
  })
})
