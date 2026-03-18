import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const useElectronMenuPath = fileURLToPath(
  new URL('../use-electron-menu.ts', import.meta.url),
)

describe('use-electron-menu', () => {
  it('handles the Phase 03 analysis persistence menu actions', () => {
    const source = readFileSync(useElectronMenuPath, 'utf8')

    expect(source).toContain("action === 'new'")
    expect(source).toContain("action === 'open'")
    expect(source).toContain("action === 'save'")
    expect(source).toContain("action === 'saveAs'")
  })
})
