import { describe, it, expect, beforeEach } from 'vitest'
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

  it('returns empty recent files initially', async () => {
    const files = await service.getRecentFiles()
    expect(files).toEqual([])
  })

  it('loads fixture by name', async () => {
    const result = await service.loadFixture('sample')
    expect(result.status).toBe('success')
  })
})
