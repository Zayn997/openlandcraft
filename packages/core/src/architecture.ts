import type { Entity, Project, Roof, Slab, Wall } from './model';
import { curvePoint, curvedWallPoints } from './curved-walls';
import { onWallInterior, pathParameter, wallEnds, wallPathPoint, wallTangent, wallCrossings } from './wall-path';
import { curvedCapSlices, mixedJoinIssue, mixedWallCap, replaceMixedJoinedWall, snapArcEndPoint } from './curved-wall-joins';
import { openingIntersectsSpan } from './opening-profile';
import { isCircularWall } from './curved-walls';
import { conicalRoofIssue,roofEavesRadius } from './conical-roofs';
import { battlementIssue } from './battlements';
import { wallWalkIssue } from './wall-walks';
import { stairFootprint,stairsIssue } from './stairs';
import {railingIssue} from './railings';
import {spiralIssue} from './spiral-stairs';

export type PlanPoint = [number, number];
export const wallLength = (wall: Wall) => wall.curve ? wall.curve.radius * Math.abs(wall.curve.sweepAngle) * Math.PI / 180 : Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
export const sameCorner = (a: PlanPoint, b: PlanPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.00001;
export function footprint(part: Slab | Roof): PlanPoint[] {
  if(part.kind==='slab'&&part.stairs)return stairFootprint(part);
  if(part.kind==='roof'&&part.cone)return Array.from({length:120},(_,i)=>[part.center[0]+roofEavesRadius(part)*Math.cos(i*Math.PI/60),part.center[1]+roofEavesRadius(part)*Math.sin(i*Math.PI/60)]);
  const points: PlanPoint[] = part.outline ?? [[-part.width / 2, -part.depth / 2], [part.width / 2, -part.depth / 2], [part.width / 2, part.depth / 2], [-part.width / 2, part.depth / 2]];
  return points.map(p => [p[0] + part.center[0], p[1] + part.center[1]]);
}
const cross = (a: PlanPoint, b: PlanPoint) => a[0] * b[1] - a[1] * b[0];
const sub = (a: PlanPoint, b: PlanPoint): PlanPoint => [a[0] - b[0], a[1] - b[1]];
const dot = (a: PlanPoint, b: PlanPoint) => a[0] * b[0] + a[1] * b[1];
/** Centerline parameter; the authored endpoint remains on the host, while its solid ends at the face. */
export function wallParameter(point: PlanPoint, wall: Wall): number {
  return pathParameter(point,wall);
}
function onInterior(point: PlanPoint, wall: Wall): boolean {
  return onWallInterior(point,wall);
}
function related(a: Wall, b: Wall): boolean {
  return wallEnds(a).some(e=>wallEnds(b).some(f=>sameCorner(a[e],b[f]))) || Object.values(a.junctions??{}).includes(b.id) || Object.values(b.junctions??{}).includes(a.id);
}
function joinHosts(wall: Wall, corner: PlanPoint, walls: Wall[]) {
  const id=wall.junctions?.[sameCorner(corner,wall.start)?'start':'end'];
  return wall.joins&&id ? walls.filter(w=>w.id===id&&w.joins&&w.id!==wall.id&&w.parentId===wall.parentId&&onInterior(corner,w)) : [];
}
/** Copy only connections whose hosts are in the copied scope; partial copies detach. */
export function remapWallJunctions(wall:Wall, ids:Map<string,string>):Wall['junctions'] {
  const entries=Object.entries(wall.junctions??{}).flatMap(([end,id])=>ids.has(id)?[[end,ids.get(id)!]]:[]);
  return entries.length?Object.fromEntries(entries):undefined;
}
/** Removing/unjoining a host or deliberately moving a branch off it detaches that endpoint. */
export function detachInvalidJunctions(entities:Entity[]):Entity[] {
  return entities.map(e=>{
    if(e.kind!=='wall'||!e.junctions)return e;
    const junctions=Object.fromEntries(Object.entries(e.junctions).filter(([end,id])=>{
      const host=entities.find((w):w is Wall=>w.kind==='wall'&&w.id===id);
      return e.joins&&host?.joins&&host.parentId===e.parentId&&onInterior(e[end as 'start'|'end'],host);
    }));
    const next={...e};
    if(Object.keys(junctions).length)next.junctions=junctions;else delete next.junctions;
    return next;
  });
}
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
    for (const w of walls) if (!connected.has(w.id) && walls.some(n => connected.has(n.id) && related(w,n))) { connected.add(w.id); changed = true; }
  }
  if(walls.some(w=>connected.has(w.id)&&w.curve))return detachInvalidJunctions(replaceMixedJoinedWall(entities,previous,next));
  const profile = joinChange&&next.joins || previous.height !== next.height || previous.elevation !== next.elevation;
  const result = entities.map(entity => {
    if (entity.id === previous.id) return next;
    if (entity.kind !== 'wall' || !connected.has(entity.id)) return entity;
    const move = (point: PlanPoint): PlanPoint => sameCorner(point, previous.start) ? next.start : sameCorner(point, previous.end) ? next.end : point;
    return { ...entity, ...(joinChange?{joins:next.joins}:{}), ...(profile ? {height:next.height,elevation:next.elevation} : {}), start: move(entity.start), end: move(entity.end) };
  });
  // Follow moved hosts at the original normalized position, including hosts whose corners moved above.
  // Every constraint is evaluated against the original document, never an accumulated pointer preview.
  const moved = new Map(result.filter((e): e is Wall=>e.kind==='wall').map(w=>[w.id,w]));
  for(let pass=0;pass<walls.length;pass++) {
    let progressed=false;
    for(const wall of walls) {
      if(wall.id===previous.id)continue;
      const current=moved.get(wall.id)!;
      const follow=(p:PlanPoint,end:'start'|'end'):PlanPoint=>{
        const host=walls.find(w=>w.id===wall.junctions?.[end]&&onInterior(p,w));
        if(!host)return current[end];
        const replacement=moved.get(host.id)!, t=wallParameter(p,host);
        return [replacement.start[0]+t*(replacement.end[0]-replacement.start[0]),replacement.start[1]+t*(replacement.end[1]-replacement.start[1])];
      };
      const start=follow(wall.start,'start'),end=follow(wall.end,'end');
      if(!sameCorner(start,current.start)||!sameCorner(end,current.end)){
        moved.set(wall.id,{...current,start,end});progressed=true;
      }
    }
    if(!progressed)break;
  }
  return detachInvalidJunctions(result.map(e=>e.kind==='wall'?moved.get(e.id)!:e));
}

function openingsIssue(wall:Wall,usableStart:number,usableEnd:number):string|null{
  const openings=wall.openings??[],circle=isCircularWall(wall),length=wallLength(wall),margin=Math.max(.1,wall.thickness*2),ids=new Set<string>();
  for(const opening of openings){
    if(ids.has(opening.id))return 'Opening IDs must be unique within a wall.';
    ids.add(opening.id);
    if((circle?opening.offset<0||opening.offset>=length||opening.width>length-.2:opening.offset<usableStart+margin-1e-6||opening.offset+opening.width>usableEnd-margin+1e-6)||opening.sill+opening.height>wall.height-.1+1e-6)return 'The opening must fit inside its wall, clear of corners, junctions and the wall top. Move or resize the opening first.';
    if(opening.kind==='door'&&opening.sill!==0)return 'Doors must start at the wall base.';
    for(const other of openings)if(other.id!==opening.id&&openingIntersectsSpan(wall,other,opening.offset+1e-6,opening.offset+opening.width-1e-6)&&opening.sill<other.sill+other.height+.1-1e-6&&opening.sill+opening.height+.1>other.sill+1e-6)return 'Keep at least 0.1 m of wall between openings.';
  }
  return null;
}
export function architectureIssue(entities: Entity[]): string | null {
  const walls = entities.filter((e): e is Wall => e.kind === 'wall');
  for (const wall of walls) {
    const battlements=battlementIssue(wall);if(battlements)return battlements;
    const walk=wallWalkIssue(wall);if(walk)return walk;
    const railing=railingIssue(wall);if(railing)return railing;
    for(const [end,id] of Object.entries(wall.junctions??{})) {
      const host=walls.find(w=>w.id===id);
      if(!wall.joins||!host?.joins||host.id===wall.id||host.parentId!==wall.parentId||!onInterior(wall[end as 'start'|'end'],host))return 'A wall junction must reference a joined wall on the same level, with its endpoint on the host centerline.';
    }
    const mixed=mixedJoinIssue(wall,walls);if(mixed)return mixed;
    if (wall.curve) {
      const c=wall.curve;
      if (Math.abs(c.sweepAngle)<1 || wallLength(wall)<0.2) return 'Draw an arc of at least 1° and 0.2 m.';
      if (c.radius-wall.thickness/2<=0.1) return 'Keep at least 0.1 m of clear inner radius.';
      if (!sameCorner(wall.start,curvePoint(c,0)) || !sameCorner(wall.end,curvePoint(c,1))) return 'Curved wall endpoints must follow its center, radius and angles.';
      if (curvedWallPoints(wall).some(p=>p.some(v=>Math.abs(v)+wall.thickness/2>100+1e-6))) return 'Keep the curved wall within ±100 m of its level origin.';
      const cap=(end:'start'|'end')=>[-wall.thickness/2,wall.thickness/2].map(side=>{const p=mixedWallCap(wall,end,side,walls);if(!p)return end==='start'?0:wallLength(wall);const t=pathParameter(p,wall),turn=360/Math.abs(c.sweepAngle),near=end==='start'?0:1;return (t+Math.round((near-t)/turn)*turn)*wallLength(wall);});
      const issue=openingsIssue(wall,Math.max(0,...cap('start')),Math.min(wallLength(wall),...cap('end')));if(issue)return issue;
      continue;
    }
    const length = wallLength(wall);
    const polygon=wallFootprint(wall,walls);
    const capXs=(end:'start'|'end')=>curvedCapSlices(wall,walls).flatMap(side=>{const p=mixedWallCap(wall,end,side,walls);return p?[dot(sub(p,wall.start),wallTangent(wall,0))]:[];});
    const usableStart=Math.max(0,polygon[0][0],polygon[3][0],...capXs('start')), usableEnd=Math.min(length,polygon[1][0],polygon[2][0],...capXs('end'));
    const issue=openingsIssue(wall,usableStart,usableEnd);if(issue)return issue;
    if(wall.joins)for (const corner of [wall.start, wall.end]) {
      const neighbors = walls.filter(w => w.joins && w.id !== wall.id && w.parentId === wall.parentId && wallEnds(w).some(end=>sameCorner(w[end],corner)));
      const hosts=joinHosts(wall,corner,walls);
      if (neighbors.length > 1 || hosts.length > 1 || hosts.length && neighbors.length) return 'A shared endpoint supports two walls. Connect an interior wall to the middle of one existing wall for a T junction.';
      for (const other of neighbors) {
        if(other.curve)continue; // Validated using offset curves and endpoint tangents above.
        const away = sameCorner(corner, wall.start) ? wall.end : wall.start;
        const otherAway = sameCorner(corner, other.start) ? other.end : other.start;
        const a = sub(away, corner), b = sub(otherAway, corner);
        const cosine = (a[0] * b[0] + a[1] * b[1]) / (wallLength(wall) * wallLength(other));
        if (cosine > Math.cos(Math.PI / 6)+1e-8) return 'Joined wall angles must be at least 30°.';
        const cap=sameCorner(corner,wall.start)?[polygon[0],polygon[3]]:[polygon[1],polygon[2]],origin=sameCorner(corner,wall.start)?0:length;
        const extension=Math.max(...cap.map(p=>Math.abs(p[0]-origin)));
        if(extension>Math.min(length,wallLength(other))*0.45) return 'The joined corner is too tight for this wall length and thickness.';
        if (Math.abs(wall.elevation - other.elevation) > 1e-6 || Math.abs(wall.height - other.height) > 1e-6) return 'Joined walls must share their height and base elevation; their thicknesses may differ.';
      }
      for(const host of hosts) {
        if(host.curve)continue;
        if(Math.abs(wall.elevation-host.elevation)>1e-6||Math.abs(wall.height-host.height)>1e-6)return 'Joined walls must share their height and base elevation; their thicknesses may differ.';
        const sine=Math.abs(cross(sub(wall.end,wall.start),sub(host.end,host.start)))/(length*wallLength(host));
        if(sine<0.5-1e-6)return 'Interior wall joins must meet the host at an angle of at least 30°.';
        const cap=sameCorner(corner,wall.start)?[polygon[0],polygon[3]]:[polygon[1],polygon[2]];
        const dx=(wall.end[0]-wall.start[0])/length,dz=(wall.end[1]-wall.start[1])/length;
        const contact=cap.map(p=>wallParameter([wall.start[0]+dx*p[0]-dz*p[1],wall.start[1]+dz*p[0]+dx*p[1]],host)*wallLength(host));
        const lo=Math.min(...contact),hi=Math.max(...contact),hostLength=wallLength(host);
        const hostPolygon=wallFootprint(host,walls),hostStart=Math.max(0,hostPolygon[0][0],hostPolygon[3][0]),hostEnd=Math.min(hostLength,hostPolygon[1][0],hostPolygon[2][0]);
        if(lo<hostStart+0.1||hi>hostEnd-0.1)return 'Move the interior wall farther from the host corner.';
        const away=sameCorner(corner,wall.start)?wall.end:wall.start,side=Math.sign(cross(sub(host.end,host.start),sub(away,host.start)));
        for(const other of walls)if(other.id!==wall.id&&other.joins)for(const end of ['start','end'] as const) {
          if(other.junctions?.[end]!==host.id)continue;
          const otherAway=end==='start'?other.end:other.start;
          if(Math.sign(cross(sub(host.end,host.start),sub(otherAway,host.start)))!==side)continue;
          const poly=wallFootprint(other,walls),ends=end==='start'?[poly[0],poly[3]]:[poly[1],poly[2]],ol=wallLength(other),ox=(other.end[0]-other.start[0])/ol,oz=(other.end[1]-other.start[1])/ol;
          const span=ends.map(p=>wallParameter([other.start[0]+ox*p[0]-oz*p[1],other.start[1]+oz*p[0]+ox*p[1]],host)*hostLength);
          if(lo<Math.max(...span)-1e-6&&hi>Math.min(...span)+1e-6)return 'These interior wall connections overlap. Move them farther apart.';
        }
        if((host.openings??[]).some(o=>lo<o.offset+o.width+0.1&&hi>o.offset-0.1))return 'The wall junction would intersect a door or window. Move the connection or the opening.';
        if(usableEnd-usableStart<0.2)return 'The wall is too short for this junction and thickness.';
      }
    }
  }
  for (const e of entities) if ((e.kind === 'slab' || e.kind === 'roof') && e.outline) {
    const issue = outlineIssue(e.outline); if (issue) return issue;
  }
  for(const e of entities)if(e.kind==='roof'){const issue=conicalRoofIssue(e,entities);if(issue)return issue;}
  for(const e of entities)if(e.kind==='slab'){const issue=stairsIssue(e)??spiralIssue(e,entities)??railingIssue(e);if(issue)return issue;}
  return null;
}

/** Mitered footprint in wall coordinates: x is distance from start; y is lateral offset. */
export function wallFootprint(wall: Wall, walls: Wall[]): PlanPoint[] {
  const length = wallLength(wall), dx = (wall.end[0] - wall.start[0]) / length, dz = (wall.end[1] - wall.start[1]) / length, half = wall.thickness / 2;
  const edge = (end: boolean, side: number): PlanPoint => {
    const corner = end ? wall.end : wall.start;
    const mixed=mixedWallCap(wall,end?'end':'start',side*half,walls);
    if(mixed)return [(mixed[0]-wall.start[0])*dx+(mixed[1]-wall.start[1])*dz,-(mixed[0]-wall.start[0])*dz+(mixed[1]-wall.start[1])*dx];
    const host=joinHosts(wall,corner,walls)[0];
    if(host) {
      const hx=(host.end[0]-host.start[0])/wallLength(host),hz=(host.end[1]-host.start[1])/wallLength(host);
      const localX=hx*dx+hz*dz,localY=-hx*dz+hz*dx;
      if(Math.abs(localY)>1e-6) return [(end?length:0)+(end?-1:1)*host.thickness/(2*Math.abs(localY))+localX*side*half/localY,side*half];
    }
    const neighbor = wall.joins&&walls.find(w => w.joins && w.id !== wall.id && w.parentId === wall.parentId && wallEnds(w).some(end=>sameCorner(w[end],corner)));
    if (!neighbor) return [end ? length : 0, side * half];
    const away = sameCorner(neighbor.start, corner) ? neighbor.end : neighbor.start;
    const nx = (away[0] - corner[0]) / wallLength(neighbor), nz = (away[1] - corner[1]) / wallLength(neighbor);
    const localX = nx * dx + nz * dz, localY = -nx * dz + nz * dx;
    if (Math.abs(localY) < 1e-6) return [end ? length : 0, side * half];
    const offset = side * (half * localX + (end ? -1 : 1) * neighbor.thickness / 2) / localY;
    return [(end ? length : 0) + offset, side * half];
  };
  return [edge(false, -1), edge(true, -1), edge(true, 1), edge(false, 1)];
}

export function snapWallPoint(point: PlanPoint, walls: Wall[], previous?: PlanPoint): PlanPoint {
  const nearest = walls.flatMap(w => wallEnds(w).map(end=>w[end])).sort((a,b)=>Math.hypot(...sub(a,point))-Math.hypot(...sub(b,point)))[0];
  if (nearest && Math.hypot(...sub(nearest, point)) <= 0.4) return [...nearest];
  const targets=walls.map(w=>{
    let t=wallParameter(point,w);
    if(w.curve){const p=wallPathPoint(w,t);return {t,p,distance:Math.hypot(...sub(p,point)),wall:w};}
    // Preserve a nearly orthogonal segment while snapping onto the host centerline.
    if(previous)for(const axis of [0,1] as const) {
      const span=w.end[axis]-w.start[axis];
      if(Math.abs(point[axis]-previous[axis])>0.4||Math.abs(span)<1e-6)continue;
      const aligned=(previous[axis]-w.start[axis])/span;
      if(aligned>0&&aligned<1&&Math.hypot(w.start[0]+aligned*(w.end[0]-w.start[0])-point[0],w.start[1]+aligned*(w.end[1]-w.start[1])-point[1])<=w.thickness/2+0.4){t=aligned;break;}
    }
    const p:PlanPoint=[w.start[0]+t*(w.end[0]-w.start[0]),w.start[1]+t*(w.end[1]-w.start[1])];
    return {t,p,distance:Math.hypot(...sub(p,point)),wall:w};
  }).filter(hit=>(hit.wall.curve&&Math.abs(hit.wall.curve.sweepAngle)===360||hit.t>0&&hit.t<1)&&hit.distance<=hit.wall.thickness/2+0.4).sort((a,b)=>a.distance-b.distance);
  if(targets.length)return targets[0].p;
  const result: PlanPoint = point.map(v => Math.round(v * 4) / 4) as PlanPoint;
  if (previous) { if (Math.abs(result[0] - previous[0]) <= 0.4) result[0] = previous[0]; if (Math.abs(result[1] - previous[1]) <= 0.4) result[1] = previous[1]; }
  return result;
}
export function snapCurveDrawingPoint(point:PlanPoint,points:PlanPoint[],walls:Wall[],snapping:boolean):PlanPoint{
  if(!snapping)return [...point];
  if(points.length===1)return snapWallPoint(point,walls);
  const grid=point.map(v=>Math.round(v*4)/4) as PlanPoint;
  return points.length===2?snapArcEndPoint(grid,points[0],points[1],walls):grid;
}
export function createWallChain(project: Project, parentId: string, points: PlanPoint[], closed: boolean, id: string = crypto.randomUUID(), snapping = true, thickness?:number): Wall[] {
  const existing = project.entities.filter((e): e is Wall => e.kind === 'wall' && e.parentId === parentId && e.joins===true);
  const snapped: PlanPoint[] = [];
  for (const point of points) snapped.push(snapping ? snapWallPoint(point, existing, snapped.at(-1)) : [...point]);
  const count = closed ? snapped.length : snapped.length - 1;
  if (count < 1 || points.length > 16 || closed && points.length < 3) throw new Error('Use 2–16 points for a wall chain, or at least 3 for a closed room.');
  const profile = existing.find(w => snapped.some(p=>sameCorner(p,w.start)||sameCorner(p,w.end)||onInterior(p,w)));
  const created:Wall[]=Array.from({length:count},(_,i)=>({id:`${id}-${i}`,kind:'wall',joins:true,parentId,name:`Wall ${i+1}`,visible:true,color:'#e4ded1',start:snapped[i],end:snapped[(i+1)%snapped.length],height:profile?.height??3.2,thickness:thickness??profile?.thickness??0.25,elevation:profile?.elevation??0.2,openings:[]}));
  const all=[...existing,...created];
  for(const wall of created)for(const other of all) {
    if(wall.id===other.id)continue;
    if(other.curve){if(wallCrossings(wall,other).some(p=>onInterior(p,wall)&&onInterior(p,other)))throw new Error('Crossing walls are not supported. Finish the straight wall on the curved wall instead.');continue;}
    const a=sub(wall.end,wall.start),b=sub(other.end,other.start),c=sub(other.start,wall.start),den=cross(a,b);
    if(Math.abs(den)>1e-8) {
      const t=cross(c,b)/den,u=cross(c,a)/den;
      if(t>1e-5&&t<1-1e-5&&u>1e-5&&u<1-1e-5)throw new Error('Crossing walls are not supported. Finish the interior wall on the existing wall instead.');
    } else if(Math.abs(cross(a,c))<1e-8) {
      const lo=Math.min(wallParameter(other.start,wall),wallParameter(other.end,wall)),hi=Math.max(wallParameter(other.start,wall),wallParameter(other.end,wall));
      if(Math.min(1,hi)-Math.max(0,lo)>1e-5)throw new Error('This wall overlaps an existing wall. Draw from its endpoint or connect to its side.');
    }
  }
  for(const wall of created)for(const end of ['start','end'] as const) {
    const hosts=all.filter(host=>host.id!==wall.id&&onInterior(wall[end],host));
    if(hosts.length>1)throw new Error('Choose a single host wall for this connection.');
    if(hosts[0])wall.junctions={...wall.junctions,[end]:hosts[0].id};
  }
  return created;
}
