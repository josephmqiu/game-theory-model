// FileSystemFileHandle is a DOM API not available in Node.js / server environments.
// This shim provides the type declaration so the entity graph service can compile.
// At runtime, fileHandle values are always null in the server context.

interface FileSystemFileHandle {
  readonly kind: "file";
  readonly name: string;
}
