import { pathStrips, polygonArea, clipPathPolygon, type PathPoint } from './path';
import { roundedRoutePoints, type RoundedRoute } from './rounded-route';
import {regionTriangles} from './region';

export const MAX_LANDSCAPE_PATHS = 16;
export type NetworkPath = RoundedRoute & { id: string; visible: boolean };
export type PathSurface = { points: PathPoint[]; segment: number };
export type CourtyardBoundary = {id:string;visible:boolean;points:PathPoint[]};
export type SurfaceHeightSampler=(id:string,point:PathPoint)=>number;
export type SurfaceMask={id:string;points:PathPoint[]};
function elevationsMatch(a:PathPoint[],b:PathPoint[],idA:string,idB:string,height?:SurfaceHeightSampler){
  if(!height)return true;
  const overlap=clipPathPolygon(a,b);if(polygonArea(overlap)<1e-9)return true;
  const center:PathPoint=[overlap.reduce((s,p)=>s+p[0],0)/overlap.length,overlap.reduce((s,p)=>s+p[1],0)/overlap.length];
  return [...overlap,center].every(p=>Math.abs(height(idA,p)-height(idB,p))<=.015);
}
const side = (a: PathPoint, b: PathPoint, p: PathPoint) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const box = (p: PathPoint[]) => [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const overlaps = (a: number[], b: number[]) => a[0]<b[2]-1e-9&&a[2]>b[0]+1e-9&&a[1]<b[3]-1e-9&&a[3]>b[1]+1e-9;

/** Partition a convex polygon at one line; shared edges have zero area. */
function halfPlane(points: PathPoint[], a: PathPoint, b: PathPoint, inside: boolean): PathPoint[] {
  const result: PathPoint[]=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length],sp=side(a,b,p),sq=side(a,b,q);
    const keepP=inside?sp>=0:sp<=0,keepQ=inside?sq>=0:sq<=0;
    if(keepP)result.push(p);
    if(keepP!==keepQ){const t=sp/(sp-sq);result.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
  }
  return result;
}

/** Convex difference produces disjoint convex pieces, without a boolean library. */
export function subtractPathPolygon(subject: PathPoint[], boundary: PathPoint[]): PathPoint[][] {
  if(!overlaps(box(subject),box(boundary)))return [subject];
  let remaining=subject;
  const pieces: PathPoint[][]=[];
  for(let i=0;i<boundary.length&&remaining.length>=3;i++){
    const a=boundary[i],b=boundary[(i+1)%boundary.length],outside=halfPlane(remaining,a,b,false);
    if(polygonArea(outside)>1e-9)pieces.push(outside);
    remaining=halfPlane(remaining,a,b,true);
  }
  return pieces;
}

/** Earlier visible paths own shared ground. No stacked faces at T/cross joins.
 * Authored paths stay independent; junctions regenerate from their geometry. */
export function pathNetworkSurfaces(paths: readonly NetworkPath[], masks:(PathPoint[]|SurfaceMask)[]=[],height?:SurfaceHeightSampler): Map<string, PathSurface[]> {
  const surfaces=new Map<string,PathSurface[]>(),occupied=masks.map(mask=>{const points=Array.isArray(mask)?mask:mask.points;return {points,bounds:box(points),id:Array.isArray(mask)?'':mask.id};});
  for(const path of paths){
    if(!path.visible)continue;
    const strips=pathStrips({...path,points:roundedRoutePoints(path)}),parts:PathSurface[]=[];
    for(const [segment,strip] of strips.entries()){
      let fragments=[strip];
      const bounds=box(strip);
      for(const obstacle of occupied){
        if(!overlaps(bounds,obstacle.bounds))continue;
        if(!elevationsMatch(strip,obstacle.points,path.id,obstacle.id,height))continue;
        fragments=fragments.flatMap(fragment=>subtractPathPolygon(fragment,obstacle.points));
        if(parts.length+fragments.length>4096)throw new Error('This path junction is too complex. Simplify the crossing routes.');
        if(!fragments.length)break;
      }
      parts.push(...fragments.map(points=>({points,segment})));
      if(parts.length>4096)throw new Error('This path junction is too complex. Simplify the crossing routes.');
    }
    surfaces.set(path.id,parts);
    occupied.push(...strips.map(points=>({points,bounds:box(points),id:path.id})));
  }
  return surfaces;
}

/** Courtyards own the finish where paths enter. Later courtyard boundaries win
 * over earlier ones, matching the existing surface-region ordering. */
export function courtyardNetworkSurfaces(courtyards:readonly CourtyardBoundary[],height?:SurfaceHeightSampler):Map<string,PathPoint[][]>{
  const surfaces=new Map<string,PathPoint[][]>(),occupied:SurfaceMask[]=[];
  for(const courtyard of [...courtyards].reverse()){
    if(!courtyard.visible)continue;
    const triangles=regionTriangles(courtyard.points),parts:PathPoint[][]=[];
    for(const triangle of triangles){
      let fragments=[triangle];
      for(const obstacle of occupied){
        if(!elevationsMatch(triangle,obstacle.points,courtyard.id,obstacle.id,height))continue;
        fragments=fragments.flatMap(fragment=>subtractPathPolygon(fragment,obstacle.points));
        if(parts.length+fragments.length>4096)throw new Error('These courtyard overlaps are too complex. Simplify the boundaries.');
        if(!fragments.length)break;
      }
      parts.push(...fragments);
    }
    surfaces.set(courtyard.id,parts);occupied.push(...triangles.map(points=>({points,id:courtyard.id})));
  }
  return surfaces;
}
