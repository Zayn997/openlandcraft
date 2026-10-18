import { architectureIssue, wallLength } from './architecture';
import { openingSchema, type Level, type Opening, type Wall } from './model';

export type OpeningSettings = Pick<Opening, 'kind' | 'width' | 'height' | 'sill'> & { snapping: boolean };
export type WallHit = [number, number, number];

/** Project a world-space hit onto the host axis. The cursor centers the opening;
 * snapping rounds its near-edge offset to 0.1 m. Never clamp into a different gap. */
export function openingAtPoint(wall: Wall, level: Level, point: WallHit, settings: OpeningSettings, id: string): { opening: Opening | null; issue: string | null } {
  if (wall.parentId !== level.id) return { opening: null, issue: 'Choose a wall on the active floor.' };
  const { kind, width, height } = settings, sill = kind === 'door' ? 0 : settings.sill;
  if (![...point, width, height, sill].every(Number.isFinite) || width < 0.3 || width > 20 || height < 0.3 || height > 20 || sill < 0 || sill > 20)
    return { opening: null, issue: 'Enter a width and height between 0.3 and 20 m, and a sill between 0 and 20 m.' };
  const angle = level.rotation * Math.PI / 180, x = point[0] - level.position[0], z = point[2] - level.position[2];
  const localX = x * Math.cos(angle) - z * Math.sin(angle), localZ = x * Math.sin(angle) + z * Math.cos(angle);
  const along = ((localX - wall.start[0]) * (wall.end[0] - wall.start[0]) + (localZ - wall.start[1]) * (wall.end[1] - wall.start[1])) / wallLength(wall);
  const offset = settings.snapping ? Math.round((along - width / 2) * 10) / 10 : along - width / 2;
  const opening: Opening = { id, kind, width, height, sill, offset };
  const issue = (wall.openings?.length ?? 0) >= 8 ? 'This wall already has 8 openings. Remove one before placing another.'
    : architectureIssue([{ ...wall, openings: [...(wall.openings ?? []), opening] }])
      ?? (!openingSchema.safeParse(opening).success ? 'The opening is outside the supported wall range.' : null);
  return { opening, issue };
}
