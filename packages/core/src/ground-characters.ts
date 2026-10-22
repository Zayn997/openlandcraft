import { lakeDistance, pointSegmentDistance, sampleRiver } from '@openlandcraft/landscape';
import { assetAnimation } from './asset-animation';
import { decodeGlb, type Asset } from './assets';
import { footprint, type PlanPoint } from './architecture';
import { groundHeight, type Instance, type Project, type Path } from './model';
import { instancePosition } from './placement';
import { fishSeed } from './fish-schools';
import { nearestWalkNode, pedestrianGraph, type PedestrianPath } from './pedestrian-paths';
import { characterWalkingPath } from './character-routes';

export const groundCharacterKind = (asset: Asset): 'horse' | 'person' | null => {
  const animation = assetAnimation(asset);
  return animation === 'horse-walk-v1' ? 'horse' : animation === 'person-walk-v1' ? 'person' : null;
};
export const isGroundCharacterAsset = (asset: Asset): boolean => groundCharacterKind(asset) !== null;
export type GroundRoute = { x: number; z: number; radius: number; bodyRadius: number; height: number; speed: number; seed: number; kind: 'horse' | 'person'; entity: Instance;
  path?: PedestrianPath; reason?: 'idle' | 'no-path' | 'far-path' | 'blocked' | 'fixed' | 'path' | 'circle' };

const geometry = new WeakMap<Asset, { radius: number; height: number }>();
/** Bound imported static geometry through its node transforms; match bottom-center normalization. */
function staticExtent(asset: Asset) {
  if (geometry.has(asset)) return geometry.get(asset)!;
  let radius = 1, height = 2;
  try {
    const bytes = decodeGlb(asset.data), view = new DataView(bytes.buffer, bytes.byteOffset);
    const doc = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))));
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    const transform = (p: number[], node: { matrix?: number[]; translation?: number[]; scale?: number[]; rotation?: number[] }) => {
      if (node.matrix) { const m = node.matrix; return [0,1,2].map(i => m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]); }
      const [x,y,z] = p.map((v,i) => v*(node.scale?.[i] ?? 1)), [qx,qy,qz,qw] = node.rotation ?? [0,0,0,1];
      const tx = 2*(qy*z-qz*y), ty = 2*(qz*x-qx*z), tz = 2*(qx*y-qy*x);
      return [x+qw*tx+qy*tz-qz*ty,y+qw*ty+qz*tx-qx*tz,z+qw*tz+qx*ty-qy*tx].map((v,i) => v+(node.translation?.[i] ?? 0));
    };
    const visit = (index: number, parents: number[], depth = 0) => {
      if (depth > 64 || parents.includes(index)) return;
      const node = doc.nodes[index], chain = [index,...parents];
      for (const primitive of doc.meshes?.[node.mesh]?.primitives ?? []) {
        const accessor = doc.accessors?.[primitive.attributes?.POSITION];
        if (!accessor?.min || !accessor?.max) continue;
        for (let corner = 0; corner < 8; corner++) {
          let p = [0,1,2].map(i => (corner & (1 << i) ? accessor.max : accessor.min)[i]);
          chain.forEach(i => { p = transform(p,doc.nodes[i]); });
          p.forEach((v,i) => { min[i] = Math.min(min[i],v); max[i] = Math.max(max[i],v); });
        }
      }
      for (const child of node.children ?? []) visit(child,chain,depth+1);
    };
    for (const node of doc.scenes?.[doc.scene ?? 0]?.nodes ?? []) visit(node,[]);
    if (min.every(Number.isFinite) && max.every(Number.isFinite)) {
      radius = Math.hypot(max[0]-min[0],max[2]-min[2])/2; height = max[1]-min[1];
      // These curated trees have narrow, central trunks and traversable overhead crowns.
      if (doc.nodes?.some((n: {name?: string}) => ['Pine','Oak','Palm'].includes(n.name ?? ''))) radius = Math.min(radius,0.65);
    }
  } catch { /* Invalid files are handled by the model validator. Use a conservative fallback. */ }
  const extent = { radius, height }; geometry.set(asset,extent); return extent;
}

/** Compile only when the evaluated/displayed scene changes, never in the frame loop. */
export function groundHabitat(project: Project) {
  const polygons: {points: PlanPoint[]; margin: number}[] = [];
  const circles: {x: number; z: number; radius: number}[] = [];
  const assets = new Map(project.assets.map(a => [a.id,a]));
  for (const entity of project.entities.filter(e => e.visible)) {
    if (entity.kind === 'block') {
      const a = entity.rotation*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
      polygons.push({margin:0, points:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z]) =>
        [entity.position[0]+x*entity.size[0]/2*c+z*entity.size[2]/2*s,entity.position[2]-x*entity.size[0]/2*s+z*entity.size[2]/2*c])});
    } else if (entity.kind === 'wall' || entity.kind === 'slab' || entity.kind === 'roof') {
      const level = project.entities.find(e => e.id === entity.parentId);
      if (level?.kind !== 'level') continue;
      const a = level.rotation*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
      const points = entity.kind === 'wall' ? [entity.start,entity.end] : footprint(entity);
      polygons.push({margin:entity.kind === 'wall' ? entity.thickness/2 : 0,points:points.map(([x,z]) => [level.position[0]+x*c+z*s,level.position[2]-x*s+z*c])});
    } else if (entity.kind === 'instance') {
      const asset = assets.get(entity.assetId);
      if (!asset || assetAnimation(asset)) continue;
      const extent = staticExtent(asset), scale = Math.max(...entity.scale), position = instancePosition(entity,project);
      if (extent.height*scale < 0.8 || position[1] > groundHeight(position[0],position[2],project.site)+3) continue;
      circles.push({x:position[0],z:position[2],radius:extent.radius*scale});
    }
  }
  const waters = project.entities.filter(e => e.visible && ['ocean','lake','river'].includes(e.kind));
  const rivers = new Map(waters.filter(e => e.kind === 'river').map(e => [e.id,sampleRiver(e.points)]));
  // Route smoothing asks many nearby clearance questions. Index static object
  // bounds once per project instead of scanning every planted tree each time.
  const cellSize=8,buckets=new Map<string,number[]>(),visited=new Uint32Array(circles.length),oversized:number[]=[];
  let query=0;
  circles.forEach((circle,index)=>{
    const reach=circle.radius+.15;
    if((Math.ceil(reach*2/cellSize)+1)**2>256){oversized.push(index);return;}
    for(let row=Math.floor((circle.z-reach)/cellSize);row<=Math.floor((circle.z+reach)/cellSize);row++)
      for(let col=Math.floor((circle.x-reach)/cellSize);col<=Math.floor((circle.x+reach)/cellSize);col++){
        const key=`${col}:${row}`,members=buckets.get(key);
        if(members)members.push(index);else buckets.set(key,[index]);
      }
  });
  return { clear(x: number, z: number, radius: number) {
    const {site} = project;
    if (![x,z,radius].every(Number.isFinite) || radius <= 0 || Math.abs(x)+radius > site.width/2 || Math.abs(z)+radius > site.depth/2) return false;
    if(++query===0xffffffff){visited.fill(0);query=1;}
    for(const index of oversized){const circle=circles[index];if(Math.hypot(x-circle.x,z-circle.z)<radius+circle.radius+.15)return false;}
    for(let row=Math.floor((z-radius)/cellSize);row<=Math.floor((z+radius)/cellSize);row++)
      for(let col=Math.floor((x-radius)/cellSize);col<=Math.floor((x+radius)/cellSize);col++)
        for(const index of buckets.get(`${col}:${row}`)??[]){
          if(visited[index]===query)continue;visited[index]=query;
          const circle=circles[index];
          if(Math.hypot(x-circle.x,z-circle.z)<radius+circle.radius+.15)return false;
        }
    for (const {points,margin} of polygons) {
      if (points.length > 2 && lakeDistance(points,x,z) >= 0) return false;
      for (let i = 0; i < (points.length === 2 ? 1 : points.length); i++)
        if (pointSegmentDistance([x,z],points[i],points[(i+1)%points.length]) < radius+margin+0.15) return false;
    }
    // Every touched terrain cell bounds height and slope between the ring samples.
    const {columns,rows,heights} = site.terrain, dx = site.width/(columns-1), dz = site.depth/(rows-1);
    let low = groundHeight(x,z,site);
    for (let row = Math.max(0,Math.floor((z-radius+site.depth/2)/dz)); row <= Math.min(rows-1,Math.ceil((z+radius+site.depth/2)/dz)); row++)
      for (let col = Math.max(0,Math.floor((x-radius+site.width/2)/dx)); col <= Math.min(columns-1,Math.ceil((x+radius+site.width/2)/dx)); col++) {
        const h = heights[row*columns+col]; low = Math.min(low,h);
        if (col < columns-1 && Math.abs(heights[row*columns+col+1]-h)/dx > 0.45) return false;
        if (row < rows-1 && Math.abs(heights[(row+1)*columns+col]-h)/dz > 0.45) return false;
      }
    for (const water of waters) {
      if (water.kind === 'ocean' && low < water.level+2*water.amplitude+0.12) return false;
      if (water.kind === 'lake' && lakeDistance(water.points,x,z) > -radius && low < water.level+2*water.amplitude+0.12) return false;
      if (water.kind === 'river') {
        const path = rivers.get(water.id)!;
        for (let i = 1; i < path.length; i++)
          if (pointSegmentDistance([x,z],[path[i-1].x,path[i-1].z],[path[i].x,path[i].z]) < water.width/2+radius && low < Math.max(path[i-1].y,path[i].y)+2*water.water.amplitude+0.12) return false;
      }
    }
    return true;
  }};
}

const layouts = new WeakMap<Project,Map<string,GroundRoute>>();
/** Reserve horse orbits and standing figures; compile safe path corridors for people. */
export function groundRoutes(project: Project): ReadonlyMap<string,GroundRoute> {
  const cached = layouts.get(project); if (cached) return cached;
  const routes = new Map<string,GroundRoute>();
  const assets = new Map(project.assets.map(a => [a.id,a]));
  const candidates: GroundRoute[] = project.entities.filter((e): e is Instance => e.kind === 'instance' && e.visible && !!assets.get(e.assetId) && isGroundCharacterAsset(assets.get(e.assetId)!))
    .sort((a,b) => a.id.localeCompare(b.id)).map(entity => {
      const kind = groundCharacterKind(assets.get(entity.assetId)!)!, scale = Math.max(...entity.scale);
      return {entity,kind,x:entity.position[0],z:entity.position[2],radius:0,bodyRadius:(kind === 'horse' ? 2.1 : 0.58)*scale,
        height:(kind === 'horse' ? 2.1 : 1.78)*scale, speed:(kind === 'horse' ? 1.05 : 0.85)*scale,seed:fishSeed(entity.id)};
    });
  if (!candidates.length) { layouts.set(project,routes); return routes; }
  const habitat = groundHabitat(project);
  for (const candidate of candidates) {
    if (!habitat.clear(candidate.x,candidate.z,candidate.bodyRadius)) continue;
    if ([...routes.values()].some(other => Math.hypot(candidate.x-other.x,candidate.z-other.z) < candidate.bodyRadius+other.bodyRadius+0.2)) continue;
    routes.set(candidate.entity.id,candidate);
  }
  const personalPaths = new Map(candidates.map(route=>[route.entity.id,characterWalkingPath(route.entity)]));
  const paths = [...personalPaths.values()].filter((path):path is Path=>!!path);
  const following = new Set<string>();
  for (const route of routes.values()) {
    if (route.entity.characterAnimation === 'idle') { route.reason = 'idle'; continue; }
    if (route.entity.anchor !== 'terrain' || Math.abs(route.entity.position[1]) > 0.15) { route.reason = 'fixed'; continue; }
    if (route.kind !== 'person') continue;
    if (!personalPaths.get(route.entity.id)) { route.reason = 'no-path'; continue; }
    following.add(route.entity.id);
  }
  for (const route of routes.values()) {
    if (route.kind === 'person' || route.reason === 'idle' || route.reason === 'fixed') continue;
    const scale = Math.max(...route.entity.scale);
    for (const radius of [4.5,3.5].map(r => r*scale)) {
      if ([...routes.values()].some(other => other !== route && Math.hypot(route.x-other.x,route.z-other.z) < radius+route.bodyRadius+other.radius+other.bodyRadius+0.2)) continue;
      let clear = true;
      // Cover arcs between samples as well as the full animated body extent.
      for (let i = 0; i < 96; i++) {
        const angle = i*Math.PI/48;
        const x = route.x+radius*Math.cos(angle), z = route.z+radius*Math.sin(angle), body = route.bodyRadius+radius*Math.PI/96;
        if (!habitat.clear(x,z,body) || following.size && paths.some(path => path.points.slice(1).some((point,j) => pointSegmentDistance([x,z],path.points[j],point) < path.width/2+body+0.15))) { clear = false; break; }
      }
      if (clear) { route.radius = radius; route.reason = 'circle'; break; }
    }
  }
  const graphCache = new Map<string,ReturnType<typeof pedestrianGraph>>();
  const reserved = [...routes.values()].filter(route => !following.has(route.entity.id));
  for (const route of routes.values()) {
    if (!following.has(route.entity.id)) continue;
    let nearest = Infinity;
    for (const path of [personalPaths.get(route.entity.id)!]) {
      const key = `${path.id}:${route.bodyRadius}`;
      let graph = graphCache.get(key);
      if (!graph) {
        graph = pedestrianGraph(path,route.bodyRadius,(x,z,r) => habitat.clear(x,z,r) && reserved.every(other => Math.hypot(x-other.x,z-other.z) > r+other.bodyRadius+other.radius+0.2));
        graphCache.set(key,graph);
      }
      const usable = new Set(graph.components.map((members,index) => {
        let min = Infinity, max = -Infinity;
        for (const i of members) { min = Math.min(min,graph!.nodes[i].station); max = Math.max(max,graph!.nodes[i].station); }
        return max-min > 2 ? index : -1;
      }));
      const start = nearestWalkNode(graph,route.x,route.z,index => usable.has(graph!.nodes[index].component));
      if (start < 0) continue;
      const node = graph.nodes[start], distance = Math.hypot(node.x-route.x,node.z-route.z);
      if (distance >= nearest) continue;
      route.path = {graph,start}; route.reason = 'path'; nearest = distance;
    }
    if (!route.path) route.reason = 'blocked';
  }
  layouts.set(project,routes); return routes;
}
