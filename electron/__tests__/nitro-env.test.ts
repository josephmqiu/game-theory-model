import { describe, expect, it } from 'vitest'

import { buildNitroChildEnv } from '../nitro-env'
import { GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV } from '../../src/lib/runtime-state-paths'

describe('buildNitroChildEnv', () => {
  it('passes the packaged runtime state directory to Nitro', () => {
    const env = buildNitroChildEnv(
      { PATH: '/usr/bin', LANG: 'en_US.UTF-8' },
      {
        host: '127.0.0.1',
        port: 4312,
        resourcesPath: '/Applications/GTA.app/Contents/Resources',
        userDataDir: '/Users/tester/Library/Application Support/Game Theory Analyzer',
      },
    )

    expect(env).toMatchObject({
      PATH: '/usr/bin',
      LANG: 'en_US.UTF-8',
      HOST: '127.0.0.1',
      PORT: '4312',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: '4312',
      ELECTRON_RESOURCES_PATH: '/Applications/GTA.app/Contents/Resources',
      [GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV]:
        '/Users/tester/Library/Application Support/Game Theory Analyzer',
    })
  })
})
