import { architectureIssue, type PlanPoint } from './architecture';
import { wallSchema, type Wall } from './model';

export type WallDragMode = 'move' | 'start' | 'end';
/** Local level-plane delta from the original grab, never the previous preview. */
export function dragWall(wall: Wall, mode: WallDragMode, delta: PlanPoint, snapping: boolean): Wall {
  if (!delta.every(Number.isFinite)) throw new Error('Keep the pointer on the wall editing plane.');
  const snap = (n: number) => Number((snapping ? Math.round(n * 4) / 4 : n).toFixed(10));
  const shift: PlanPoint = mode === 'move' ? delta.map(snap) as PlanPoint : delta;
  const point = (p: PlanPoint): PlanPoint => p.map((n, i) => mode === 'move' ? Number((n + shift[i]).toFixed(10)) : snap(n + shift[i])) as PlanPoint;
  const next = { ...wall, start: mode === 'end' ? wall.start : point(wall.start), end: mode === 'start' ? wall.end : point(wall.end) };
  const parsed = wallSchema.safeParse(next);
  if (!parsed.success || Math.hypot(next.end[0] - next.start[0], next.end[1] - next.start[1]) < 0.2) throw new Error('Keep wall endpoints within ±100 m and the wall at least 0.2 m long.');
  const issue = architectureIssue([{...next,junctions:undefined}]); // Full joined-scene validation happens in the command.
  if (issue) throw new Error(issue);
  return next;
}
