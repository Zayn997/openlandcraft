import { outlineIssue, type PlanPoint } from './architecture';
import type { Level, Roof, Slab } from './model';

/** Picking happens in world coordinates; authored outlines belong to the level. */
export function drawingPoint(level: Level, x: number, z: number): PlanPoint {
  const angle = level.rotation * Math.PI / 180;
  const dx = x - level.position[0], dz = z - level.position[2];
  return [dx * Math.cos(angle) - dz * Math.sin(angle), dx * Math.sin(angle) + dz * Math.cos(angle)];
}

export function createDrawnSurface(kind: 'floor' | 'roof', level: Level, points: PlanPoint[], elevation: number, thickness: number, id = crypto.randomUUID()): Slab | Roof {
  const issue = outlineIssue(points);
  if (issue) throw new Error(issue);
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  const center: PlanPoint = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
  const base = {
    id, parentId: level.id, visible: true, center, elevation,
    width: Math.max(0.5, Math.max(...xs) - Math.min(...xs)),
    depth: Math.max(0.5, Math.max(...zs) - Math.min(...zs)),
    outline: points.map(p => [p[0] - center[0], p[1] - center[1]] as PlanPoint),
  };
  return kind === 'floor'
    ? { ...base, kind: 'slab', name: 'Floor', color: '#ded8ca', thickness }
    : { ...base, kind: 'roof', name: 'Flat roof', color: '#667869', rise: thickness };
}
