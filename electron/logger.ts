/**
 * Size-bounded rotating file logger for the Electron main process.
 *
 * Writes to `{userData}/logs/main.log` with numbered backup rotation.
 * When the active log exceeds `MAX_BYTES`, it rotates:
 *   main.log → main.log.1, main.log.1 → main.log.2, ... up to MAX_FILES.
 *
 * Uses synchronous I/O for the write path (acceptable for Electron main).
 *
 * Usage:
 *   import { initLogger, log } from './logger'
 *   await initLogger(userDataPath)
 *   log.info('message')
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 10_000_000; // 10 MB
const MAX_FILES = 7;
const LOG_FILE_NAME = "main.log";

let logDir = "";
let logFilePath = "";
let currentSize = 0;
let initialized = false;

function timestamp(): string {
  return new Date().toISOString();
}

function rotate(): void {
  // Shift existing backups: main.log.6 → main.log.7, ... main.log.1 → main.log.2
  for (let i = MAX_FILES - 1; i >= 1; i--) {
    const from = join(logDir, `${LOG_FILE_NAME}.${i}`);
    const to = join(logDir, `${LOG_FILE_NAME}.${i + 1}`);
    if (existsSync(from)) {
      try {
        renameSync(from, to);
      } catch {
        // Best-effort rotation
      }
    }
  }

  // Rotate current log: main.log → main.log.1
  if (existsSync(logFilePath)) {
    try {
      renameSync(logFilePath, join(logDir, `${LOG_FILE_NAME}.1`));
    } catch {
      // Best-effort rotation
    }
  }

  // Prune overflow backups beyond MAX_FILES
  const overflow = join(logDir, `${LOG_FILE_NAME}.${MAX_FILES + 1}`);
  if (existsSync(overflow)) {
    try {
      unlinkSync(overflow);
    } catch {
      // ignore
    }
  }

  // Start fresh
  currentSize = 0;
}

function writeLine(level: string, msg: string): void {
  if (!initialized) return;
  const line = `${timestamp()} [${level}] ${msg}\n`;

  // Forward to console for dev mode
  if (level === "ERROR") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }

  // Rotate before write if needed
  if (currentSize + line.length > MAX_BYTES) {
    rotate();
  }

  try {
    appendFileSync(logFilePath, line, "utf-8");
    currentSize += line.length;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${timestamp()} [LOGGER_FALLBACK] Failed to append log file: ${detail}\n`,
    );
  }
}

/**
 * Clean up legacy date-based log files (main-YYYY-MM-DD.log) from before
 * the migration to size-bounded rotation. Runs once at startup.
 */
function cleanLegacyDateLogs(): void {
  try {
    const files = readdirSync(logDir);
    for (const file of files) {
      if (/^main-\d{4}-\d{2}-\d{2}\.log$/.test(file)) {
        try {
          unlinkSync(join(logDir, file));
        } catch {
          // ignore individual file errors
        }
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Initialize the logger. Must be called after `app.getPath('userData')` is available.
 */
export async function initLogger(userDataPath: string): Promise<void> {
  logDir = join(userDataPath, "logs");
  logFilePath = join(logDir, LOG_FILE_NAME);

  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // ignore
  }

  // Initialize currentSize from existing file
  try {
    const s = statSync(logFilePath);
    currentSize = s.size;
  } catch {
    currentSize = 0;
  }

  initialized = true;
  writeLine("INFO", "--- Game Theory Analyzer started ---");

  // Clean up legacy date-based log files in background
  cleanLegacyDateLogs();
}

/** Get the log directory path (for displaying to users). */
export function getLogDir(): string {
  return logDir;
}

export const log = {
  info: (msg: string) => {
    writeLine("INFO", msg);
  },
  warn: (msg: string) => {
    writeLine("WARN", msg);
  },
  error: (msg: string) => {
    writeLine("ERROR", msg);
  },
};
