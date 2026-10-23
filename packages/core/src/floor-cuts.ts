import type {PlanPoint} from './architecture';
import {lakeDistance,polygonArea} from '@openlandcraft/landscape';
export const signedPlanArea=(points:PlanPoint[])=>points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p[0]*q[1]-p[1]*q[0];},0)/2;
export const ccwPlan=(points:PlanPoint[])=>signedPlanArea(points)<0?[...points].reverse():points;
const cross=(a:PlanPoint,b:PlanPoint,p:PlanPoint)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function halfPlane(points:PlanPoint[],a:PlanPoint,b:PlanPoint,inside:boolean):PlanPoint[]{
 const out:PlanPoint[]=[];for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],x=cross(a,b,p)*(inside?1:-1),y=cross(a,b,q)*(inside?1:-1);if(x>=-1e-9)out.push(p);if(x*y< -1e-18){const t=x/(x-y);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
 return polygonArea(out)>1e-9?out:[];
}
/** Subtract a convex shaft from a convex triangle/piece; returned pieces stay convex. */
export function subtractFloorCut(subject:PlanPoint[],cut:PlanPoint[]):PlanPoint[][]{
 let remaining=subject;const pieces:PlanPoint[][]=[],boundary=ccwPlan(cut);
 for(let i=0;i<boundary.length&&remaining.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length],outside=halfPlane(remaining,a,b,false);if(outside.length)pieces.push(outside);remaining=halfPlane(remaining,a,b,true);}
 return pieces;
}
/** Split a boundary at every crossing, including collinear endpoint contacts. */
export function floorEdgeSegments(a:PlanPoint,b:PlanPoint,polygons:PlanPoint[][]):[PlanPoint,PlanPoint][]{
 const times=[0,1],u=[b[0]-a[0],b[1]-a[1]],length=u[0]*u[0]+u[1]*u[1];
 for(const poly of polygons)for(let i=0;i<poly.length;i++){const c=poly[i],d=poly[(i+1)%poly.length],v=[d[0]-c[0],d[1]-c[1]],w=[c[0]-a[0],c[1]-a[1]],den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)>1e-10){const t=(w[0]*v[1]-w[1]*v[0])/den,s=(w[0]*u[1]-w[1]*u[0])/den;if(t>0&&t<1&&s>=-1e-8&&s<=1+1e-8)times.push(t);}else if(Math.abs(w[0]*u[1]-w[1]*u[0])<1e-8&&length>0)for(const p of [c,d]){const t=((p[0]-a[0])*u[0]+(p[1]-a[1])*u[1])/length;if(t>0&&t<1)times.push(t);}}
 const sorted=times.sort((a,b)=>a-b).filter((t,i,all)=>i===0||t-all[i-1]>1e-8),at=(t:number):PlanPoint=>[a[0]+u[0]*t,a[1]+u[1]*t];return sorted.slice(1).map((t,i)=>[at(sorted[i]),at(t)]);
}
export function floorContainsPath(outline:PlanPoint[],path:PlanPoint[],closed=false,margin=.02):boolean{
 if(path.some(p=>lakeDistance(outline,...p)<margin-1e-8))return false;
 for(let i=1;i<path.length+(closed?1:0);i++)for(const [a,b] of floorEdgeSegments(path[(i-1)%path.length],path[i%path.length],[outline]))if(lakeDistance(outline,(a[0]+b[0])/2,(a[1]+b[1])/2)<margin-1e-8)return false;
 return true;
}
