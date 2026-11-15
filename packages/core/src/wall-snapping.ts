import { snapWallPoint, type PlanPoint } from './architecture';
import { dragWall, type WallDragMode } from './wall-edit';
import { wallEnds } from './wall-path';
import type { Wall } from './model';

export type WallSnapEndpoint = { point: PlanPoint; wallId?: string; end?: 'start' | 'end' };
export type WallSnapFeedback = {
  point: PlanPoint;
  axis?: 0 | 1;
  origin?: PlanPoint;
  endpoint?: WallSnapEndpoint;
  /** A compatible endpoint in the approach zone, before the 0.4 m snap engages. */
  nearEndpoint?: WallSnapEndpoint;
};
const distance = (a: PlanPoint, b: PlanPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const grid = (n: number) => Math.round(n * 4) / 4;
const axisFor = (point: PlanPoint, origin: PlanPoint): 0 | 1 => Math.abs(point[0] - origin[0]) >= Math.abs(point[1] - origin[1]) ? 0 : 1;
const constrain = (point: PlanPoint, origin: PlanPoint, axis: 0 | 1): PlanPoint => axis === 0 ? [point[0], origin[1]] : [origin[0], point[1]];
const onAxis = (point: PlanPoint, origin: PlanPoint, axis?: 0 | 1) => axis === undefined || Math.abs(point[1 - axis] - origin[1 - axis]) < 1e-8;
const endpoints = (walls: Wall[]) => walls.filter(w => w.visible).flatMap(w => wallEnds(w).map(end => ({ point: w[end], wallId: w.id, end })));

/** One resolver for the displayed preview and committed click. Axis locking takes priority over snapping. */
export function resolveWallDrawingSnap(raw: PlanPoint, walls: Wall[], previous: PlanPoint | undefined, snapping: boolean, shift: boolean, corners: PlanPoint[] = []): WallSnapFeedback {
  const axis = shift && previous ? axisFor(raw, previous) : undefined;
  const point = axis !== undefined ? constrain(raw, previous!, axis) : raw;
  const feedback: Omit<WallSnapFeedback, 'point'> = { axis, origin: previous };
  if (!snapping) return { ...feedback, point };
  const targets: NonNullable<WallSnapFeedback['endpoint']>[] = [...endpoints(walls), ...corners.map(point => ({ point }))];
  const candidate = targets.filter(t => (!previous || distance(t.point, previous) > 1e-8) && onAxis(t.point, previous ?? point, axis) && distance(t.point, point) <= 0.8)
    .sort((a, b) => distance(a.point, point) - distance(b.point, point))[0];
  const endpoint = candidate && distance(candidate.point, point) <= 0.4 ? candidate : undefined;
  if (endpoint) return { ...feedback, point: [...endpoint.point], endpoint };
  feedback.nearEndpoint = candidate;
  const snapped = snapWallPoint(point, walls.filter(w => w.visible), previous);
  if (axis === undefined || onAxis(snapped, previous!, axis)) return { ...feedback, point: snapped };
  return { ...feedback, point: constrain(point.map(grid) as PlanPoint, previous!, axis) };
}

/** Resolve against the gesture's original geometry, never against a moving preview. */
export function resolveWallDrag(wall: Wall, mode: WallDragMode, delta: PlanPoint, walls: Wall[], snapping: boolean, shift: boolean): { wall: Wall; feedback?: WallSnapFeedback } {
  if (!delta.every(Number.isFinite)) throw new Error('Keep the pointer on the wall editing plane.');
  if (mode === 'radius' || (wall.curve && mode !== 'move')) return { wall: dragWall(wall, mode, delta, snapping) };
  const moving = mode === 'move';
  const anchor = wall.curve?.center ?? (mode === 'end' ? wall.end : wall.start);
  const origin = moving ? anchor : mode === 'start' ? wall.end : wall.start;
  const raw: PlanPoint = [anchor[0] + delta[0], anchor[1] + delta[1]];
  const axis = shift ? axisFor(raw, origin) : undefined;
  const point = axis === undefined ? raw : constrain(raw, origin, axis);
  let resolved: PlanPoint = [point[0] - anchor[0], point[1] - anchor[1]];
  let endpoint: WallSnapFeedback['endpoint'];
  let nearEndpoint: WallSnapFeedback['nearEndpoint'];
  let guideOrigin = origin;
  let source = point;
  if (snapping) {
    // Connected corners follow this gesture and cannot be stationary snap targets.
    const movingEnds = moving ? [wall.start, wall.end] : [anchor];
    const targets = walls.filter(w => w.id !== wall.id && w.parentId === wall.parentId)
      .flatMap(w => endpoints([w]).filter(t => w.junctions?.[t.end] !== wall.id))
      .filter(t => !movingEnds.some(p => distance(t.point, p) < 1e-5));
    const sources = wall.curve ? [] : moving ? [wall.start, wall.end] : [anchor];
    const candidates = sources.flatMap(from => {
      const at: PlanPoint = [from[0] + resolved[0], from[1] + resolved[1]];
      return targets.filter(t => onAxis(t.point, at, axis) && distance(t.point, at) <= 0.8).map(target => ({ target, from, distance: distance(target.point, at) }));
    }).sort((a, b) => a.distance - b.distance);
    const match = candidates[0];
    if (match && match.distance <= 0.4) {
      endpoint = match.target;
      resolved = [endpoint.point[0] - match.from[0], endpoint.point[1] - match.from[1]];
      source = endpoint.point;
      guideOrigin = moving ? match.from : origin;
    } else {
      const quantized: PlanPoint = moving ? [anchor[0] + grid(resolved[0]), anchor[1] + grid(resolved[1])] : point.map(grid) as PlanPoint;
      const locked = axis === undefined ? quantized : constrain(quantized, origin, axis);
      resolved = [locked[0] - anchor[0], locked[1] - anchor[1]];
      source = locked;
      if (match) {
        nearEndpoint = match.target;
        source = [match.from[0] + resolved[0], match.from[1] + resolved[1]];
        guideOrigin = moving ? match.from : origin;
      }
    }
  }
  return { wall: dragWall(wall, mode, resolved, false), feedback: { point: source, origin: guideOrigin, axis, endpoint, nearEndpoint } };
}
