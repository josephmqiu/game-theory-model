import { describe, it, expect } from 'vitest'
import { BrowserShellService } from '../browser-shell-service'

describe('BrowserShellService', () => {
  it('sets document title', () => {
    const service = new BrowserShellService()
    service.setTitle('Test Title')
    expect(document.title).toBe('Test Title')
  })
})
