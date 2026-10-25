import {footprint} from './architecture';
import { walkingRouteIssue, roundedRoutePoints, MAX_LANDSCAPE_PATHS, type PathPoint } from '@openlandcraft/landscape';
import { canEditObject } from './layers';
import { pathSchema, type Level, type Path, type Project } from './model';
import { snap } from './placement';
export const ROUND_PATH_GESTURE='Round path corner';

export function createPath(project: Project, points?: PathPoint[]): Path {
  return { id: crypto.randomUUID(), parentId: 'site', kind: 'path', name: 'Landscape path', visible: true,
    points: points ?? [[-project.site.width * 0.25, project.site.depth * 0.28], [-project.site.width * 0.12, project.site.depth * 0.28], [0, project.site.depth * 0.36]],
    width: 2, surface: 'gravel', elevationMode: 'terrain' };
}

/** Only the points drawn by the user enter the document; redraw preserves route identity. */
export function createDrawnPath(project: Project, points: PathPoint[], settings: Pick<Path,'width'|'surface'|'cornerRounding'>, replaceId?: string): Path {
  if (points.length < 2) throw new Error('Click at least a start and an end point before finishing the path.');
  const original = replaceId ? project.entities.find(e => e.id === replaceId) : undefined;
  if (replaceId && original?.kind !== 'path') throw new Error('The path no longer exists. Start a new drawing.');
  if (!replaceId && project.entities.filter(e=>e.kind==='path').length>=MAX_LANDSCAPE_PATHS) throw new Error(`Keep the garden network within ${MAX_LANDSCAPE_PATHS} paths.`);
  const path = pathSchema.parse({...(original?.kind === 'path' ? original : createPath(project,points)),width:settings.width,surface:settings.surface,cornerRounding:settings.cornerRounding,points:points.map(p => [...p])});
  const issue = walkingRouteIssue(path,project.site); if (issue) throw new Error(issue);
  return path;
}

/** Placement snapping only: no hidden attachment to future building edits. */
export function snapPathPoint(project: Project, point: PathPoint, enabled: boolean, endpoint = true, excludeId?: string, isolatedLayerId: string|null = null): { point: PathPoint; target: string | null } {
  if (!enabled) return { point, target: null };
  let nearest = 0.8, result: PathPoint | null = null, target: string | null = null;
  const consider = (p: PathPoint, name: string) => {
    const distance = Math.hypot(point[0] - p[0], point[1] - p[1]);
    if (distance < nearest) { nearest = distance; result = p; target = name; }
  };
  if (endpoint) for (const entity of project.entities) {
    if (!entity.visible || entity.id===excludeId || !canEditObject(project,entity.id,isolatedLayerId)) continue;
    if(entity.kind==='path'){
      const points=roundedRoutePoints(entity);
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],lengthSquared=dx*dx+dz*dz;
        const t=lengthSquared?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/lengthSquared)):0;
        consider([a[0]+dx*t,a[1]+dz*t],entity.name);
      }
    }
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
