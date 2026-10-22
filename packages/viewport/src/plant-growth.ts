export const PLANT_GROWTH_MS = 450;
/** Ease up from the ground without overshoot or changing the authored scale. */
export function plantGrowthScale(start: number | undefined, now: number): number {
  if (start === undefined) return 1;
  const progress = Math.max(0, Math.min(1, (now - start) / PLANT_GROWTH_MS));
  return 0.04 + 0.96 * (1 - (1 - progress) ** 3);
}
