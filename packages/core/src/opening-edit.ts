import { architectureIssue } from './architecture';
import { openingSchema, type Opening, type Wall } from './model';

export type OpeningDragMode = 'move' | 'start' | 'end' | 'top';

/** Replace only one hosted opening, retaining its ID and the order of siblings. */
export function editOpening(wall: Wall, id: string, patch: Partial<Pick<Opening, 'offset' | 'width' | 'height' | 'sill'>>): Wall {
  const original = wall.openings?.find(o => o.id === id);
  if (!original) throw new Error('This opening no longer exists. Select another opening.');
  const opening = { ...original, ...patch };
  if (!openingSchema.safeParse(opening).success) throw new Error('Use positive dimensions of 0.3–20 m, a sill of 0–20 m, and an offset of 0–200 m.');
  const updated = { ...wall, openings: wall.openings!.map(o => o.id === id ? opening : o) };
  const issue = architectureIssue([{...updated,junctions:undefined}]); // The command validates all connected walls.
  if (issue) throw new Error(issue);
  return updated;
}

/** Delta is measured from the original pointer-down position, never the last preview. */
export function dragOpening(wall: Wall, id: string, mode: OpeningDragMode, delta: number, snapping: boolean): Wall {
  const opening = wall.openings?.find(o => o.id === id);
  if (!opening) throw new Error('This opening no longer exists.');
  if (!Number.isFinite(delta)) throw new Error('Keep the pointer on the editing plane.');
  const snap = (value: number) => snapping ? Math.round(value * 10) / 10 : value;
  const end = opening.offset + opening.width;
  const patch = mode === 'move' ? { offset: snap(opening.offset + delta) }
    : mode === 'start' ? { offset: snap(opening.offset + delta), width: end - snap(opening.offset + delta) }
    : mode === 'end' ? { width: snap(end + delta) - opening.offset }
    : { height: snap(opening.sill + opening.height + delta) - opening.sill };
  // Subtracting snapped edges should not leave 1.6999999999999993 in the inspector.
  return editOpening(wall, id, Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, Number(value.toFixed(10))])));
}
