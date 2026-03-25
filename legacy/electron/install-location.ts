export function isRunningFromMountedDiskImage(
  platform: NodeJS.Platform,
  isPackaged: boolean,
  execPath: string,
): boolean {
  if (!isPackaged || platform !== "darwin") {
    return false;
  }

  return execPath.startsWith("/Volumes/");
}
