import type { Entity, Project, Roof, Slab, Wall } from './model';

export type PlanPoint = [number, number];
export const wallLength = (wall: Wall) => Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
export const sameCorner = (a: PlanPoint, b: PlanPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.00001;
export function footprint(part: Slab | Roof): PlanPoint[] {
  const points: PlanPoint[] = part.outline ?? [[-part.width / 2, -part.depth / 2], [part.width / 2, -part.depth / 2], [part.width / 2, part.depth / 2], [-part.width / 2, part.depth / 2]];
  return points.map(p => [p[0] + part.center[0], p[1] + part.center[1]]);
}
const cross = (a: PlanPoint, b: PlanPoint) => a[0] * b[1] - a[1] * b[0];
const sub = (a: PlanPoint, b: PlanPoint): PlanPoint => [a[0] - b[0], a[1] - b[1]];
export function outlineIssue(points: PlanPoint[]): string | null {
  if (points.length < 3 || points.length > 16) return 'Use 3–16 outline corners.';
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (Math.hypot(...sub(a, b)) < 0.2) return 'Outline edges must be at least 0.2 m long.';
    const c = points[(i + 2) % points.length], ab = sub(b,a), bc = sub(c,b);
    if (Math.abs(cross(ab,bc)) < 1e-8 && ab[0]*bc[0]+ab[1]*bc[1] < 0) return 'Outline edges must not double back.';
    area += cross(a, b);
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || i === 0 && j === points.length - 1) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      const ab = sub(b, a), cd = sub(d, c), ac = sub(c, a), denominator = cross(ab, cd);
      if (Math.abs(denominator) < 1e-8) {
        if (Math.abs(cross(ac, ab)) < 1e-8 && [0, 1].every(k => Math.max(Math.min(a[k], b[k]), Math.min(c[k], d[k])) <= Math.min(Math.max(a[k], b[k]), Math.max(c[k], d[k])) + 1e-8)) return 'Outline edges must not touch or cross.';
      } else {
        const t = cross(ac, cd) / denominator, u = cross(ac, ab) / denominator;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 'Outline edges must not touch or cross.';
      }
    }
  }
  return Math.abs(area) < 0.5 ? 'Outline area must be at least 0.25 m².' : null;
}

/** Coincident endpoints are shared corners. A replacement moves every incident endpoint atomically. */
export function replaceJoinedWall(entities: Entity[], previous: Wall, next: Wall): Entity[] {
  const joinChange=!!previous.joins!==!!next.joins;
  if(!previous.joins&&!next.joins)return entities.map(e=>e.id===next.id?next:e);
  const connected = new Set([previous.id]);
  const walls = entities.filter((e): e is Wall => e.kind === 'wall' && e.parentId === previous.parentId && (joinChange||e.joins===true));
  let changed = true;
  while (changed) {
    changed = false;
    for (const w of walls) if (!connected.has(w.id) && walls.some(n => connected.has(n.id) && [w.start,w.end].some(p => sameCorner(p,n.start)||sameCorner(p,n.end)))) { connected.add(w.id); changed = true; }
  }
  const profile = joinChange&&next.joins || previous.height !== next.height || previous.thickness !== next.thickness || previous.elevation !== next.elevation;
  return entities.map(entity => {
    if (entity.id === previous.id) return next;
    if (entity.kind !== 'wall' || !connected.has(entity.id)) return entity;
    const move = (point: PlanPoint): PlanPoint => sameCorner(point, previous.start) ? next.start : sameCorner(point, previous.end) ? next.end : point;
    return { ...entity, ...(joinChange?{joins:next.joins}:{}), ...(profile ? {height:next.height,thickness:next.thickness,elevation:next.elevation} : {}), start: move(entity.start), end: move(entity.end) };
  });
}

export function architectureIssue(entities: Entity[]): string | null {
  const walls = entities.filter((e): e is Wall => e.kind === 'wall');
  for (const wall of walls) {
    const length = wallLength(wall), openings = wall.openings ?? [], margin = Math.max(0.1, wall.thickness * 2);
    const ids = new Set<string>();
    for (const opening of openings) {
      if (ids.has(opening.id)) return 'Opening IDs must be unique within a wall.';
      ids.add(opening.id);
      if (opening.offset < margin || opening.offset + opening.width > length - margin + 1e-6 || opening.sill + opening.height > wall.height - 0.1 + 1e-6) return 'The opening must fit inside its wall, clear of corners and the wall top. Move or resize the opening first.';
      if (opening.kind === 'door' && opening.sill !== 0) return 'Doors must start at the wall base.';
      for (const other of openings) if (other.id !== opening.id && opening.offset < other.offset + other.width + 0.1 - 1e-6 && opening.offset + opening.width + 0.1 > other.offset + 1e-6 && opening.sill < other.sill + other.height + 0.1 - 1e-6 && opening.sill + opening.height + 0.1 > other.sill + 1e-6) return 'Keep at least 0.1 m of wall between openings.';
    }
    if(wall.joins)for (const corner of [wall.start, wall.end]) {
      const neighbors = walls.filter(w => w.joins && w.id !== wall.id && w.parentId === wall.parentId && (sameCorner(w.start, corner) || sameCorner(w.end, corner)));
      if (neighbors.length > 1) return 'A shared corner supports two walls. T junctions are not supported yet.';
      for (const other of neighbors) {
        const away = sameCorner(corner, wall.start) ? wall.end : wall.start;
        const otherAway = sameCorner(corner, other.start) ? other.end : other.start;
        const a = sub(away, corner), b = sub(otherAway, corner);
        const cosine = (a[0] * b[0] + a[1] * b[1]) / (wallLength(wall) * wallLength(other));
        if (cosine > Math.cos(Math.PI / 6)+1e-8) return 'Joined wall angles must be at least 30°.';
        const extension=wall.thickness/2*Math.sqrt(Math.max(0,(1+cosine)/(1-cosine)));
        if(extension>Math.min(length,wallLength(other))*0.45) return 'The joined corner is too tight for this wall length and thickness.';
        if (Math.abs(wall.elevation - other.elevation) > 1e-6 || Math.abs(wall.height - other.height) > 1e-6 || Math.abs(wall.thickness - other.thickness) > 1e-6) return 'Joined walls must share their height, base elevation, and thickness. Edit the wall chain profile together.';
      }
    }
  }
  for (const e of entities) if ((e.kind === 'slab' || e.kind === 'roof') && e.outline) {
    const issue = outlineIssue(e.outline); if (issue) return issue;
  }
  return null;
}

/** Mitered footprint in wall coordinates: x is distance from start; y is lateral offset. */
export function wallFootprint(wall: Wall, walls: Wall[]): PlanPoint[] {
  const length = wallLength(wall), dx = (wall.end[0] - wall.start[0]) / length, dz = (wall.end[1] - wall.start[1]) / length, half = wall.thickness / 2;
  const edge = (end: boolean, side: number): PlanPoint => {
    const corner = end ? wall.end : wall.start;
    const neighbor = wall.joins&&walls.find(w => w.joins && w.id !== wall.id && w.parentId === wall.parentId && (sameCorner(w.start, corner) || sameCorner(w.end, corner)));
    if (!neighbor) return [end ? length : 0, side * half];
    const away = sameCorner(neighbor.start, corner) ? neighbor.end : neighbor.start;
    const nx = (away[0] - corner[0]) / wallLength(neighbor), nz = (away[1] - corner[1]) / wallLength(neighbor);
    const localX = nx * dx + nz * dz, localY = -nx * dz + nz * dx;
    if (Math.abs(localY) < 1e-6) return [end ? length : 0, side * half];
    const offset = side * half * (localX + (end ? -1 : 1)) / localY;
    return [(end ? length : 0) + offset, side * half];
  };
  return [edge(false, -1), edge(true, -1), edge(true, 1), edge(false, 1)];
}

export function snapWallPoint(point: PlanPoint, walls: Wall[], previous?: PlanPoint): PlanPoint {
  const nearest = walls.flatMap(w => [w.start, w.end]).sort((a,b)=>Math.hypot(...sub(a,point))-Math.hypot(...sub(b,point)))[0];
  if (nearest && Math.hypot(...sub(nearest, point)) <= 0.4) return [...nearest];
  const result: PlanPoint = point.map(v => Math.round(v * 4) / 4) as PlanPoint;
  if (previous) { if (Math.abs(result[0] - previous[0]) <= 0.4) result[0] = previous[0]; if (Math.abs(result[1] - previous[1]) <= 0.4) result[1] = previous[1]; }
  return result;
}
export function createWallChain(project: Project, parentId: string, points: PlanPoint[], closed: boolean, id: string = crypto.randomUUID()): Wall[] {
  const existing = project.entities.filter((e): e is Wall => e.kind === 'wall' && e.parentId === parentId && e.joins===true);
  const snapped: PlanPoint[] = [];
  for (const point of points) snapped.push(snapWallPoint(point, existing, snapped.at(-1)));
  const count = closed ? snapped.length : snapped.length - 1;
  if (count < 1 || points.length > 16 || closed && points.length < 3) throw new Error('Use 2–16 points for a wall chain, or at least 3 for a closed room.');
  const profile = existing.find(w => snapped.some(p=>sameCorner(p,w.start)||sameCorner(p,w.end)));
  return Array.from({length:count},(_,i)=>({id:`${id}-${i}`,kind:'wall',joins:true,parentId,name:`Wall ${i+1}`,visible:true,color:'#e4ded1',start:snapped[i],end:snapped[(i+1)%snapped.length],height:profile?.height??3.2,thickness:profile?.thickness??0.25,elevation:profile?.elevation??0.2,openings:[]}));
}
