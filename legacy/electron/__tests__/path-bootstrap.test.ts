import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildAugmentedGuiPath } from '../path-bootstrap'

const electronMainPath = fileURLToPath(
  new URL('../main.ts', import.meta.url),
)

describe('path bootstrap', () => {
  it('adds the standard macOS and Linux tool directories once', () => {
    const result = buildAugmentedGuiPath(
      'darwin',
      '/usr/bin:/opt/homebrew/bin',
      '/Users/tester',
    )

    expect(result?.split(':')).toEqual([
      '/Users/tester/.local/bin',
      '/Users/tester/.asdf/shims',
      '/Users/tester/.mise/shims',
      '/Users/tester/.local/share/mise/shims',
      '/Users/tester/.volta/bin',
      '/Users/tester/.nvm/current/bin',
      '/Users/tester/.cargo/bin',
      '/Users/tester/.bun/bin',
      '/usr/local/bin',
      '/home/linuxbrew/.linuxbrew/bin',
      '/usr/bin',
      '/opt/homebrew/bin',
    ])
  })

  it('preserves the existing Windows path entries without duplicating case-insensitive matches', () => {
    const result = buildAugmentedGuiPath(
      'win32',
      'C:\\Existing;C:\\Users\\tester\\.cargo\\bin',
      'C:\\Users\\tester',
    )

    expect(result?.split(';')).toEqual([
      'C:\\Users\\tester\\AppData\\Roaming\\npm',
      'C:\\Users\\tester\\AppData\\Local\\Programs\\Microsoft VS Code\\bin',
      'C:\\Users\\tester\\scoop\\shims',
      'C:\\Users\\tester\\.bun\\bin',
      'C:\\Existing',
      'C:\\Users\\tester\\.cargo\\bin',
    ])
  })

  it('no longer sources a login shell during startup path setup', () => {
    const source = readFileSync(electronMainPath, 'utf-8')

    expect(source).not.toContain(`-ilc 'echo -n "$PATH"'`)
  })
})
