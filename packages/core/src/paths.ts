import {footprint} from './architecture';
import type { PathPoint } from '@openlandcraft/landscape';
import type { Level, Path, Project } from './model';
import { snap } from './placement';

export function createPath(project: Project, points?: PathPoint[]): Path {
  return { id: crypto.randomUUID(), parentId: 'site', kind: 'path', name: 'Landscape path', visible: true,
    points: points ?? [[-project.site.width * 0.25, project.site.depth * 0.28], [-project.site.width * 0.12, project.site.depth * 0.28], [0, project.site.depth * 0.36]],
    width: 2, surface: 'gravel', elevationMode: 'terrain' };
}

/** Placement snapping only: no hidden attachment to future building edits. */
export function snapPathPoint(project: Project, point: PathPoint, enabled: boolean, endpoint = true): { point: PathPoint; target: string | null } {
  if (!enabled) return { point, target: null };
  let nearest = 0.8, result: PathPoint | null = null, target: string | null = null;
  const consider = (p: PathPoint, name: string) => {
    const distance = Math.hypot(point[0] - p[0], point[1] - p[1]);
    if (distance < nearest) { nearest = distance; result = p; target = name; }
  };
  if (endpoint) for (const entity of project.entities) {
    if (!entity.visible) continue;
    if (entity.kind === 'block' || entity.kind === 'slab' || entity.kind === 'wall') {
      const level = project.entities.find((e): e is Level => e.kind === 'level' && e.id === entity.parentId && e.visible);
      if (entity.kind !== 'block' && level?.kind !== 'level') continue;
      const origin = entity.kind === 'block' ? entity : level!;
      const angle = origin.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
      const world = ([x, z]: PathPoint): PathPoint => [origin.position[0] + x * cos + z * sin, origin.position[2] - x * sin + z * cos];
      if (entity.kind === 'wall') {
        consider(world(entity.start), entity.name); consider(world(entity.end), entity.name);
        consider(world([(entity.start[0] + entity.end[0]) / 2, (entity.start[1] + entity.end[1]) / 2]), entity.name);
      } else {
        if(entity.kind==='slab'&&entity.outline){const points=footprint(entity);points.forEach((p,i)=>{consider(world(p),entity.name);const q=points[(i+1)%points.length];consider(world([(p[0]+q[0])/2,(p[1]+q[1])/2]),entity.name);});continue;}
        const width = entity.kind === 'block' ? entity.size[0] : entity.width, depth = entity.kind === 'block' ? entity.size[2] : entity.depth;
        const center: PathPoint = entity.kind === 'block' ? [0, 0] : entity.center;
        for (const p of [[-width / 2, 0], [width / 2, 0], [0, -depth / 2], [0, depth / 2], [-width / 2, -depth / 2], [-width / 2, depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2]]) consider(world([center[0] + p[0], center[1] + p[1]]), entity.name);
      }
    }
  }
  return { point: result ?? [snap(point[0]), snap(point[1])], target };
}
