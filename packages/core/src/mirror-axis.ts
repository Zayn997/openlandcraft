import { footprint, type PlanPoint } from './architecture';
import { canEditObject, objectLayerState, objectOwners } from './layers';
import { mirrorSources } from './mirrors';
import { repeatOwner } from './repeats';
import type { Project } from './model';

export type MirrorSourceSelection = { sourceIds: string[]; repeatId?: never } | { repeatId: string; sourceIds?: never };
export type MirrorReferenceLine = { id: string; name: string; start: PlanPoint; end: PlanPoint; height?: number };

function ancestorsVisible(project: Project, id: string, seen = new Set<string>()): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  if (project.entities.find(entity => entity.id === id)?.visible === false) return false;
  return objectOwners(project, id).every(parent => ancestorsVisible(project, parent, seen));
}

/** A mirror starts from the explicit selection; never substitute another scene object. */
export function mirrorSelection(project: Project, ids: string[], isolatedId: string | null = null): MirrorSourceSelection | null {
  const selected = [...new Set(ids)];
  if (!selected.length || selected.length > 128 || selected.some(id => !canEditObject(project, id, isolatedId) || !ancestorsVisible(project, id))) return null;
  const repeat = repeatOwner(project, selected[0]);
  if (repeat && selected.every(id => repeatOwner(project, id)?.id === repeat.id)) return { repeatId: repeat.id };
  const allowed = new Set(mirrorSources(project).filter(entity => entity.visible).map(entity => entity.id));
  return selected.every(id => allowed.has(id)) ? { sourceIds: selected } : null;
}

export function mirrorAxisPoint(raw: PlanPoint, first: PlanPoint | undefined, snapping: boolean, shift: boolean): PlanPoint {
  const point: PlanPoint = snapping ? raw.map(value => Math.round(value * 4) / 4) as PlanPoint : [...raw];
  if (shift && first) {
    const axis = Math.abs(raw[0] - first[0]) >= Math.abs(raw[1] - first[1]) ? 1 : 0;
    point[axis] = first[axis];
  }
  return point;
}

/** Straight authored edges and centerlines, in world plan coordinates.
 * Curved elements are excluded: a chord is not a straight reference in the scene.
 */
export function mirrorReferenceLines(project: Project, isolatedId: string | null = null): MirrorReferenceLine[] {
  const lines: MirrorReferenceLine[] = [];
  const visibleIds = new Set(project.entities.filter(entity => entity.visible && objectLayerState(project, entity.id, isolatedId).visible && ancestorsVisible(project, entity.id)).map(entity => entity.id));
  const visible = (id: string) => visibleIds.has(id);
  const add = (id: string, name: string, points: PlanPoint[], closed = false, height?: number) => {
    const count = closed ? points.length : points.length - 1;
    for (let i = 0; i < count; i++) {
      const start = points[i], end = points[(i + 1) % points.length];
      if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 0.2) continue;
      lines.push({ id: `${id}:${i}`, name: `${name} · ${closed ? 'edge' : 'line'} ${i + 1}`, start: [...start], end: [...end], height });
    }
  };
  const world = (point: PlanPoint, position: [number, number, number], rotation: number): PlanPoint => {
    const angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    return [position[0] + point[0] * c + point[1] * s, position[2] - point[0] * s + point[1] * c];
  };
  for (const entity of project.entities) {
    if (!visible(entity.id)) continue;
    if (entity.kind === 'path' || entity.kind === 'hedge') add(entity.id, entity.name, entity.points, entity.kind === 'hedge' && entity.closed);
    if (entity.kind === 'materialRegion' || entity.kind === 'plantingRegion') add(entity.id, entity.name, entity.points, true);
    if (entity.kind === 'block') {
      const [w, h, d] = entity.size;
      const corners: PlanPoint[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
      add(entity.id, entity.name, corners.map(point => world(point, entity.position, entity.rotation)), true, entity.position[1] + h);
    }
    if (entity.kind === 'wall' || entity.kind === 'slab' || entity.kind === 'roof') {
      const level = project.entities.find(level => level.kind === 'level' && level.id === entity.parentId);
      if (!level || level.kind !== 'level') continue;
      if (entity.kind === 'wall' && entity.curve || entity.kind === 'slab' && (entity.disk || entity.stairs?.spiral) || entity.kind === 'roof' && entity.cone) continue;
      const points = entity.kind === 'wall' ? [entity.start, entity.end] : footprint(entity);
      add(entity.id, entity.name, points.map(point => world(point, level.position, level.rotation)), entity.kind !== 'wall', level.position[1] + entity.elevation + (entity.kind === 'wall' ? entity.height : 0));
    }
  }
  for (const repeat of project.repeatPatterns ?? []) {
    if (repeat.path.kind === 'line' && project.entities.some(entity => visible(entity.id) && repeatOwner(project, entity.id)?.id === repeat.id))
      add(`repeat:${repeat.id}`, repeat.name, [repeat.path.start, repeat.path.end]);
  }
  return lines;
}
