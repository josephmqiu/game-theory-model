/**
 * Canvas screenshot export — captures the current Skia canvas as a PNG.
 *
 * Uses CanvasKit's `surface.makeImageSnapshot()` + `image.encodeToBytes()`
 * to produce PNG bytes, then either downloads via a temporary <a> link
 * or copies to the system clipboard.
 */

import { getSkiaEngineRef } from "@/canvas/skia-engine-ref";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert CanvasKit's Uint8Array (may be backed by SharedArrayBuffer) to a Blob. */
function pngBlob(bytes: Uint8Array): Blob {
  // Copy into a plain ArrayBuffer so Blob accepts it regardless of TS strictness
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Blob([buf], { type: "image/png" });
}

// ---------------------------------------------------------------------------
// Core capture
// ---------------------------------------------------------------------------

/**
 * Capture the current Skia surface as PNG bytes.
 * Returns null if the engine or surface is not available.
 */
export function captureCanvasPng(): Uint8Array | null {
  const engine = getSkiaEngineRef();
  if (!engine?.surface) return null;

  try {
    const image = engine.surface.makeImageSnapshot();
    const bytes = image.encodeToBytes(); // PNG by default
    image.delete(); // free the CanvasKit Image
    return bytes ?? null;
  } catch (err) {
    console.error("[canvas-screenshot] capture failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Export: download as file
// ---------------------------------------------------------------------------

/**
 * Capture the canvas and trigger a browser download of the PNG.
 * Works in both Electron and plain browser contexts.
 */
export function downloadCanvasPng(filename = "canvas-screenshot.png"): boolean {
  const bytes = captureCanvasPng();
  if (!bytes) return false;

  try {
    const blob = pngBlob(bytes);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    // Clean up the object URL after a short delay to allow the download to start
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error("[canvas-screenshot] download failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Export: copy to clipboard
// ---------------------------------------------------------------------------

/**
 * Capture the canvas and copy the PNG to the system clipboard.
 * Uses the async Clipboard API (requires secure context).
 */
export async function copyCanvasPngToClipboard(): Promise<boolean> {
  const bytes = captureCanvasPng();
  if (!bytes) return false;

  try {
    const blob = pngBlob(bytes);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch (err) {
    console.error("[canvas-screenshot] clipboard copy failed:", err);
    return false;
  }
}
