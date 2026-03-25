import { GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV } from '../src/lib/runtime-state-paths'

type EnvLike = Record<string, string | undefined>

interface NitroChildEnvOptions {
  host: string
  port: number
  resourcesPath: string
  userDataDir: string
}

export function buildNitroChildEnv(
  baseEnv: EnvLike,
  options: NitroChildEnvOptions,
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    HOST: options.host,
    PORT: String(options.port),
    NITRO_HOST: options.host,
    NITRO_PORT: String(options.port),
    ELECTRON_RESOURCES_PATH: options.resourcesPath,
    [GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV]: options.userDataDir,
  }
}
