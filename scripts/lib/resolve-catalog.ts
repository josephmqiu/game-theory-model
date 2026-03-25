/**
 * Resolve `catalog:` protocol dependencies to their real versions.
 *
 * Stub – the upstream T3 repo uses Bun's `catalog:` protocol for workspace
 * dependency pinning. This project's package.json files already specify
 * concrete versions, so this is a pass-through.
 */

/**
 * Resolves any `catalog:` version specifiers in `dependencies` by looking them
 * up in the workspace root's `catalog` map. Returns a new object with all
 * `catalog:*` entries replaced by their resolved versions.
 *
 * In this stub implementation, the dependencies are returned as-is since this
 * project does not use `catalog:` protocol references in package dependencies.
 */
export function resolveCatalogDependencies(
  dependencies: Record<string, unknown>,
  _catalog: Record<string, unknown> | undefined,
  _label?: string,
): Record<string, unknown> {
  return { ...dependencies };
}
