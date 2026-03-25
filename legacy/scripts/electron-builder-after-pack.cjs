const { execFileSync } = require('node:child_process')
const { existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const UNUSED_PRIVACY_KEYS = [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription',
]

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appBundleName = readdirSync(context.appOutDir).find((entry) =>
    entry.endsWith('.app'),
  )
  if (!appBundleName) {
    throw new Error(
      `[afterPack] Could not find .app bundle in ${context.appOutDir}`,
    )
  }

  const plistPath = join(
    context.appOutDir,
    appBundleName,
    'Contents',
    'Info.plist',
  )
  if (!existsSync(plistPath)) {
    throw new Error(`[afterPack] Missing Info.plist at ${plistPath}`)
  }

  for (const key of UNUSED_PRIVACY_KEYS) {
    try {
      execFileSync(
        '/usr/libexec/PlistBuddy',
        ['-c', `Delete :${key}`, plistPath],
        { stdio: 'ignore' },
      )
    } catch {
      // Ignore missing keys so rebuilds stay idempotent.
    }
  }
}
