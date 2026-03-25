import { describe, expect, it } from 'vitest'

import {
  GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV,
  getLegacyPortFilePath,
  getPortFileReadCandidates,
  getServerLogDir,
  getWorkspaceDatabasePath,
  getWritableRuntimeStateDir,
} from '../runtime-state-paths'

describe('runtime-state-paths', () => {
  it('prefers the packaged userData dir when provided via env', () => {
    const env = {
      [GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV]: '/tmp/gta-user-data',
    }

    expect(getWritableRuntimeStateDir({ env, homeDir: '/Users/tester' })).toBe(
      '/tmp/gta-user-data',
    )
    expect(getServerLogDir({ env, homeDir: '/Users/tester' })).toBe(
      '/tmp/gta-user-data/logs',
    )
  })

  it('falls back to the legacy home-dir location when no packaged dir is configured', () => {
    expect(getWritableRuntimeStateDir({ homeDir: '/Users/tester' })).toBe(
      '/Users/tester/.game-theory-analyzer',
    )
    expect(getWorkspaceDatabasePath({ homeDir: '/Users/tester' })).toBe(
      '/Users/tester/.game-theory-analyzer/workspace-state.sqlite',
    )
  })

  it('checks the computed Electron userData location before the legacy port file', () => {
    expect(
      getPortFileReadCandidates({
        homeDir: '/Users/tester',
        platform: 'darwin',
      }),
    ).toEqual([
      '/Users/tester/Library/Application Support/Game Theory Analyzer/.port',
      '/Users/tester/.game-theory-analyzer/.port',
    ])
  })

  it('deduplicates the read candidates when both paths resolve to the same file', () => {
    const env = {
      [GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV]:
        '/Users/tester/.game-theory-analyzer',
    }

    expect(
      getPortFileReadCandidates({
        env,
        homeDir: '/Users/tester',
      }),
    ).toEqual([getLegacyPortFilePath({ homeDir: '/Users/tester' })])
  })
})
