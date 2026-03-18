import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appMenuPath = fileURLToPath(
  new URL('../../../../electron/app-menu.ts', import.meta.url),
)
const electronMainPath = fileURLToPath(
  new URL('../../../../electron/main.ts', import.meta.url),
)
const electronBuilderPath = fileURLToPath(
  new URL('../../../../electron-builder.yml', import.meta.url),
)

describe('Phase 03 shell persistence wiring', () => {
  it('routes analysis file actions through the native app menu', () => {
    const source = readFileSync(appMenuPath, 'utf8')

    expect(source).toContain("sendMenuAction('new')")
    expect(source).toContain("sendMenuAction('open')")
    expect(source).toContain("sendMenuAction('save')")
    expect(source).toContain("sendMenuAction('saveAs')")
  })

  it('restricts the Electron main-process file flow to .gta analysis files', () => {
    const source = readFileSync(electronMainPath, 'utf8')

    expect(source).toContain("const ANALYSIS_FILE_EXTENSION = '.gta'")
    expect(source).toContain("filters: ANALYSIS_FILE_FILTER")
    expect(source).toContain('Only .gta file extensions are allowed')
    expect(source).toContain("if (ext !== ANALYSIS_FILE_EXTENSION) return null")
    expect(source).toContain("if (ext === ANALYSIS_FILE_EXTENSION) {")
  })

  it('declares .gta as the packaged file association', () => {
    const source = readFileSync(electronBuilderPath, 'utf8')

    expect(source).toContain('ext: gta')
    expect(source).toContain('Game Theory Analyzer Analysis File')
    expect(source).toContain('application/x-game-theory-analysis')
  })
})
