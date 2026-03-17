import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const editorLayoutPath = fileURLToPath(
  new URL('../editor-layout.tsx', import.meta.url),
)
const topBarPath = fileURLToPath(new URL('../top-bar.tsx', import.meta.url))

describe('Phase 2 shell assertions', () => {
  it('keeps the editor layout analysis-first', () => {
    const source = readFileSync(editorLayoutPath, 'utf8')

    expect(source).toContain("import AnalysisPanel")
    expect(source).toContain('<AnalysisPanel />')
    expect(source).not.toContain('SkiaCanvas')
    expect(source).not.toContain('AIChatPanel')
    expect(source).not.toContain('LayerPanel')
    expect(source).not.toContain('RightPanel')
    expect(source).not.toContain('Toolbar')
    expect(source).not.toContain('BooleanToolbar')
  })

  it('keeps open and save document controls out of the top bar shell', () => {
    const source = readFileSync(topBarPath, 'utf8')

    expect(source).toContain('New Analysis')
    expect(source).not.toContain('useDocumentStore')
    expect(source).not.toContain('saveDocumentAs')
    expect(source).not.toContain('openDocumentFS')
    expect(source).not.toContain('writeToFilePath')
  })
})
