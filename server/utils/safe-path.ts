import { realpath } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { homedir, tmpdir } from "node:os";

interface ResolveSafePathOptions {
  mustExist: boolean;
  requiredSuffix?: string;
}

function hasAllowedSuffix(filePath: string, requiredSuffix?: string): boolean {
  return requiredSuffix ? filePath.endsWith(requiredSuffix) : true;
}

async function resolveAllowedRoots(): Promise<string[]> {
  return Promise.all(
    [homedir(), tmpdir()].map(async (root) => {
      try {
        return await realpath(root);
      } catch {
        return resolve(root);
      }
    }),
  );
}

async function resolveWithExistingAncestor(path: string): Promise<string> {
  const resolved = resolve(path);

  try {
    return await realpath(resolved);
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (code !== "ENOENT") {
      throw error;
    }
  }

  const missingSegments: string[] = [];
  let current = resolved;

  for (;;) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error("Path is outside the allowed directory");
    }
    missingSegments.unshift(current.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
    current = parent;
    try {
      const realAncestor = await realpath(current);
      return resolve(realAncestor, ...missingSegments);
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? (error as NodeJS.ErrnoException).code
          : undefined;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function isWithinRoot(candidate: string, root: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(`..${sep}`));
}

export async function resolveSafePath(
  filePath: string,
  options: ResolveSafePathOptions,
): Promise<string> {
  if (filePath.includes("\0")) {
    throw new Error("Path contains a null byte.");
  }

  if (!hasAllowedSuffix(filePath, options.requiredSuffix)) {
    throw new Error(`File path must end with ${options.requiredSuffix}`);
  }

  const candidate = options.mustExist
    ? await realpath(resolve(filePath))
    : await resolveWithExistingAncestor(filePath);
  const allowedRoots = await resolveAllowedRoots();

  if (!allowedRoots.some((root) => isWithinRoot(candidate, root))) {
    throw new Error("Path is outside the allowed directory");
  }

  return candidate;
}

export async function resolveSafeReadPath(filePath: string): Promise<
  | { ok: true; path: string }
  | { ok: false; error: string }
> {
  try {
    const path = await resolveSafePath(filePath, {
      mustExist: true,
      requiredSuffix: ".gta.json",
    });
    return { ok: true, path };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid path.",
    };
  }
}

export async function resolveSafeWritePath(filePath: string): Promise<
  | { ok: true; path: string }
  | { ok: false; error: string }
> {
  try {
    const path = await resolveSafePath(filePath, {
      mustExist: false,
      requiredSuffix: ".gta.json",
    });
    return { ok: true, path };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid path.",
    };
  }
}
