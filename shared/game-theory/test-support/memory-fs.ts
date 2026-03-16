export interface MemoryFs {
  files: Map<string, string>
  readFile(path: string): Promise<string>
  writeFile(path: string, contents: string): Promise<void>
  copyFile(source: string, destination: string): Promise<void>
  rename(source: string, destination: string): Promise<void>
  removeFile(path: string): Promise<void>
  fileExists(path: string): Promise<boolean>
}

export function createMemoryFs(
  initialFiles: Record<string, string> = {},
  options?: {
    onReadFile?: (path: string, contents: string) => string
  },
): MemoryFs {
  const files = new Map<string, string>(Object.entries(initialFiles))

  return {
    files,
    async readFile(path) {
      const contents = files.get(path)
      if (contents === undefined) {
        throw new Error(`ENOENT: ${path}`)
      }

      return options?.onReadFile ? options.onReadFile(path, contents) : contents
    },
    async writeFile(path, contents) {
      files.set(path, contents)
    },
    async copyFile(source, destination) {
      const contents = files.get(source)
      if (contents === undefined) {
        throw new Error(`ENOENT: ${source}`)
      }

      files.set(destination, contents)
    },
    async rename(source, destination) {
      const contents = files.get(source)
      if (contents === undefined) {
        throw new Error(`ENOENT: ${source}`)
      }

      files.set(destination, contents)
      files.delete(source)
    },
    async removeFile(path) {
      files.delete(path)
    },
    async fileExists(path) {
      return files.has(path)
    },
  }
}
