import type { Wall } from './model';
import type { PlanPoint } from './architecture';
import { curvePoint, isCircularWall, updateCurvedWall } from './curved-walls';

export const pathSub=(a:PlanPoint,b:PlanPoint):PlanPoint=>[a[0]-b[0],a[1]-b[1]];
export const pathDot=(a:PlanPoint,b:PlanPoint)=>a[0]*b[0]+a[1]*b[1];
export const pathCross=(a:PlanPoint,b:PlanPoint)=>a[0]*b[1]-a[1]*b[0];
export const pathDistance=(a:PlanPoint,b:PlanPoint)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const pathLength=(w:Wall)=>w.curve?w.curve.radius*Math.abs(w.curve.sweepAngle)*Math.PI/180:pathDistance(w.start,w.end);
export function wallPathPoint(w:Wall,t:number,lateral=0):PlanPoint{
  if(w.curve)return curvePoint(w.curve,t,w.curve.radius-Math.sign(w.curve.sweepAngle)*lateral);
  const d=wallTangent(w,0);return [w.start[0]+(w.end[0]-w.start[0])*t-d[1]*lateral,w.start[1]+(w.end[1]-w.start[1])*t+d[0]*lateral];
}
export function wallTangent(w:Wall,t:number):PlanPoint{
  if(w.curve){const a=(w.curve.startAngle+w.curve.sweepAngle*t)*Math.PI/180,s=Math.sign(w.curve.sweepAngle);return [-Math.sin(a)*s,Math.cos(a)*s];}
  const l=pathLength(w);return [(w.end[0]-w.start[0])/l,(w.end[1]-w.start[1])/l];
}
export function pathParameter(p:PlanPoint,w:Wall):number{
  if(w.curve){const angle=Math.atan2(p[1]-w.curve.center[1],p[0]-w.curve.center[0])*180/Math.PI;const delta=(angle-w.curve.startAngle)*Math.sign(w.curve.sweepAngle);return ((delta%360+360)%360)/Math.abs(w.curve.sweepAngle);}
  const d=pathSub(w.end,w.start);return pathDot(pathSub(p,w.start),d)/pathDot(d,d);
}
export const wallEnds=(w:Wall):('start'|'end')[]=>isCircularWall(w)?[]:['start','end'];
export function onWallInterior(p:PlanPoint,w:Wall):boolean{
  const t=pathParameter(p,w);
  if(w.curve)return (isCircularWall(w)||t>1e-5&&t<1-1e-5)&&Math.abs(pathDistance(p,w.curve.center)-w.curve.radius)<1e-5;
  return t>1e-5&&t<1-1e-5&&Math.abs(pathCross(pathSub(w.end,w.start),pathSub(p,w.start)))/pathLength(w)<1e-5;
}
/** Intersections of infinite offset lines/circles; callers choose the local solution. */
export function offsetIntersections(a:Wall,sideA:number,b:Wall,sideB:number):PlanPoint[]{
  if(a.curve&&!b.curve)return offsetIntersections(b,sideB,a,sideA);
  if(!a.curve&&!b.curve){const p=wallPathPoint(a,0,sideA),q=wallPathPoint(b,0,sideB),u=wallTangent(a,0),v=wallTangent(b,0),den=pathCross(u,v);if(Math.abs(den)<1e-9)return [];const t=pathCross(pathSub(q,p),v)/den;return [[p[0]+t*u[0],p[1]+t*u[1]]];}
  if(!a.curve&&b.curve){const p=wallPathPoint(a,0,sideA),d=wallTangent(a,0),c=b.curve,r=c.radius-Math.sign(c.sweepAngle)*sideB,f=pathSub(p,c.center),v=pathDot(f,d),disc=v*v-pathDot(f,f)+r*r;if(disc< -1e-8)return [];return [-v-Math.sqrt(Math.max(0,disc)),-v+Math.sqrt(Math.max(0,disc))].map(t=>[p[0]+t*d[0],p[1]+t*d[1]]);}
  return []; // Curve-to-curve junctions are outside this increment.
}
export function wallCrossings(a:Wall,b:Wall):PlanPoint[]{return offsetIntersections(a,0,b,0).filter(p=>{const on=(w:Wall)=>{const t=pathParameter(p,w);return t>=-1e-6&&t<=1+1e-6;};return on(a)&&on(b);});}
/** Preserve sweep when a connected straight wall moves one or both arc endpoints. */
export function fitArcEndpoints(w:Wall,start:PlanPoint,end:PlanPoint):Wall{
  if(!w.curve)return {...w,start,end};
  if(pathDistance(start,w.start)<1e-9&&pathDistance(end,w.end)<1e-9)return w;
  if(isCircularWall(w))throw new Error('A circular wall has no endpoint to move. Move its center instead.');
  const chord=pathSub(end,start),length=Math.hypot(...chord),sweep=w.curve.sweepAngle*Math.PI/180;
  if(length<0.2)throw new Error('Keep joined arc endpoints at least 0.2 m apart.');
  const k=1/(2*Math.tan(sweep/2)),center:PlanPoint=[(start[0]+end[0])/2-chord[1]*k,(start[1]+end[1])/2+chord[0]*k];
  return updateCurvedWall(w,{center,radius:length/(2*Math.abs(Math.sin(sweep/2))),startAngle:Math.atan2(start[1]-center[1],start[0]-center[0])*180/Math.PI});
}
