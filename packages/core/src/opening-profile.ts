import type { Opening, Wall } from './model';
import { pathLength, pathParameter, wallPathPoint } from './wall-path';
import type { PlanPoint } from './architecture';
import { isCircularWall } from './curved-walls';

/** All opening dimensions and offsets are distances on the host centerline. */
export function openingTop(o:Opening,x:number):number {
  if(o.shape!=='arch')return o.sill+o.height;
  const u=Math.max(-1,Math.min(1,(x-o.offset)*2/o.width-1));
  return o.sill+o.height-o.archRise!+o.archRise!*Math.sqrt(Math.max(0,1-u*u));
}
export function openingSamples(o:Opening):number[]{
  return o.shape==='arch'?Array.from({length:25},(_,i)=>o.offset+o.width*(1-Math.cos(i*Math.PI/24))/2):[o.offset,o.offset+o.width];
}
export function wallProfileSamples(w:Wall):number[]{
  const length=pathLength(w),n=w.curve?Math.max(8,Math.ceil(Math.abs(w.curve.sweepAngle)/3)):1;
  return [...new Set([...Array.from({length:n+1},(_,i)=>length*i/n),...wallProfileOpenings(w).flatMap(openingSamples).filter(x=>x>=0&&x<=length)])].sort((a,b)=>a-b);
}
export function wrapOpeningOffset(w:Wall,offset:number):number{const length=pathLength(w);return isCircularWall(w)?((offset%length)+length)%length:offset;}
/** Derived copies let one authored opening cross the circular seam without splitting its ID. */
export function wallProfileOpenings(w:Wall):Opening[]{
  const openings=w.openings??[],length=pathLength(w);
  return isCircularWall(w)?openings.flatMap(o=>[o,...(o.offset+o.width>length?[{...o,offset:o.offset-length}]:[])]):openings;
}
export function openingIntersectsSpan(w:Wall,o:Opening,lo:number,hi:number,margin=.1):boolean{
  const length=pathLength(w),shifts=isCircularWall(w)?[-length,0,length]:[0];
  return shifts.some(delta=>lo<o.offset+delta+o.width+margin&&hi>o.offset+delta-margin);
}
/** Unwrap a circular drag near its authored position instead of jumping across the seam. */
export function openingDistanceAtPoint(w:Wall,p:PlanPoint,near?:number):number{
  const length=pathLength(w),distance=pathParameter(p,w)*length;
  return w.curve&&near!==undefined?distance+Math.round((near-distance)/(2*Math.PI*w.curve.radius))*2*Math.PI*w.curve.radius:distance;
}
export function openingCenter(w:Wall,o:Opening):PlanPoint{return wallPathPoint(w,(o.offset+o.width/2)/pathLength(w));}
