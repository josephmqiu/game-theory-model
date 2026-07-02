export const ENTITY_ARRIVAL_SETTLE_MS = 180;

export interface EntityArrivalSettleStyle {
  progress: number;
  opacity: number;
  scale: number;
  active: boolean;
}

export function getEntityArrivalSettleStyle(
  arrivedAtMs: number | undefined,
  nowMs: number,
  prefersReducedMotion: boolean,
): EntityArrivalSettleStyle {
  if (prefersReducedMotion || arrivedAtMs === undefined) {
    return { progress: 1, opacity: 1, scale: 1, active: false };
  }

  const rawProgress = (nowMs - arrivedAtMs) / ENTITY_ARRIVAL_SETTLE_MS;
  const progress = Math.max(0, Math.min(1, rawProgress));
  const eased = 1 - Math.pow(1 - progress, 3);

  return {
    progress,
    opacity: eased,
    scale: 0.96 + 0.04 * eased,
    active: progress < 1,
  };
}
