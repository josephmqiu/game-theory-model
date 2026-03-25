/**
 * Brand-asset icon overrides for build and publish workflows.
 *
 * Stub – the upstream T3 repo ships real icon mappings here. This project
 * doesn't use icon-override swaps, so the arrays are empty.
 */

export interface IconOverride {
  readonly sourceRelativePath: string;
  readonly targetRelativePath: string;
}

/** Icon overrides applied during `cli build` (development assets). */
export const DEVELOPMENT_ICON_OVERRIDES: readonly IconOverride[] = [];

/** Icon overrides applied during `cli publish` (production assets). */
export const PUBLISH_ICON_OVERRIDES: readonly IconOverride[] = [];
