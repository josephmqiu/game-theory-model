/**
 * Nitro plugin — writes the MCP discovery port file on server startup so the
 * MCP server can discover the running instance (dev server or Electron).
 *
 * In Electron production mode the main process also writes this file,
 * but this plugin ensures the dev server (`bun --bun run dev`) is
 * discoverable too.
 */

import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  getLegacyPortFilePath,
  getPortFilePath,
} from '../../src/lib/runtime-state-paths'

function getCanonicalPortFilePath(): string {
  return getPortFilePath({ env: process.env })
}

function shouldCleanLegacyPortFile(): boolean {
  return getCanonicalPortFilePath() !== getLegacyPortFilePath()
}

async function writePortFile(port: number): Promise<void> {
  const portFilePath = getCanonicalPortFilePath()
  try {
    await mkdir(dirname(portFilePath), { recursive: true })
    await writeFile(
      portFilePath,
      JSON.stringify({ port, pid: process.pid, timestamp: Date.now() }),
      'utf-8',
    )
    if (shouldCleanLegacyPortFile()) {
      await cleanupLegacyPortFile()
    }
  } catch {
    // Non-critical — MCP sync will fall back to file I/O
  }
}

async function cleanupPortFile(): Promise<void> {
  try {
    await unlink(getCanonicalPortFilePath())
  } catch {
    // Ignore if already removed
  }
}

async function cleanupLegacyPortFile(): Promise<void> {
  try {
    await unlink(getLegacyPortFilePath())
  } catch {
    // Ignore if already removed
  }
}

export default () => {
  const port = parseInt(process.env.PORT || '3000', 10)
  writePortFile(port)

  const cleanup = () => {
    cleanupPortFile()
    if (shouldCleanLegacyPortFile()) {
      cleanupLegacyPortFile()
    }
  }
  process.on('beforeExit', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}
