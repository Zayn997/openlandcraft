import {pathIssue,type PathPoint} from './path';
import type {TerrainBounds} from './index';

export type RoundedRoute={points:PathPoint[];width:number;cornerRounding?:number[]};
/** Circular tangent fillets. Neighboring corners each use at most 45% of a
 * segment, leaving a straight connection; inner corridor edges never invert. */
export function routeCorner(route:RoundedRoute,index:number){
  const {points,width}=route,a=points[index-1],b=points[index],c=points[index+1];
  if(!a||!b||!c)return null;
  const incoming=[b[0]-a[0],b[1]-a[1]],outgoing=[c[0]-b[0],c[1]-b[1]],before=Math.hypot(...incoming),after=Math.hypot(...outgoing);
  if(before<1e-6||after<1e-6)return null;
  const u=incoming.map(v=>v/before),v=outgoing.map(v=>v/after),turn=Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]))),sign=Math.sign(u[0]*v[1]-u[1]*v[0]);
  if(turn<Math.PI/180||turn>=Math.PI-.001)return null;
  const tangent=Math.tan(turn/2),minimum=width/2+.1,maximum=Math.min(before,after)*.45/tangent;
  const amount=route.cornerRounding?.[index]??0,canRound=maximum>=minimum;
  const radius=amount>0&&canRound ? minimum+(maximum-minimum)*Math.min(1,amount) : 0,cut=radius*tangent;
  const start:PathPoint=[b[0]-u[0]*cut,b[1]-u[1]*cut],end:PathPoint=[b[0]+v[0]*cut,b[1]+v[1]*cut];
  const center:PathPoint=[start[0]-u[1]*sign*radius,start[1]+u[0]*sign*radius];
  return {turn:turn*180/Math.PI,canRound,radius,start,end,center,sweep:turn*sign};
}

export function roundedRoutePoints(route:RoundedRoute):PathPoint[]{
  if(route.points.length<3||!route.cornerRounding?.some(value=>value>0))return route.points;
  const result:PathPoint[]=[route.points[0]],push=(point:PathPoint)=>{if(Math.hypot(point[0]-result.at(-1)![0],point[1]-result.at(-1)![1])>.001)result.push(point);};
  for(let index=1;index<route.points.length-1;index++){
    const corner=routeCorner(route,index);
    if(!corner?.radius){push(route.points[index]);continue;}
    push(corner.start);
    const angle=Math.atan2(corner.start[1]-corner.center[1],corner.start[0]-corner.center[0]);
    const steps=Math.min(64,Math.max(2,Math.ceil(Math.abs(corner.sweep)/(Math.PI/18)),Math.ceil(corner.radius*Math.abs(corner.sweep)/.75)));
    for(let step=1;step<steps;step++){const theta=angle+corner.sweep*step/steps;push([corner.center[0]+corner.radius*Math.cos(theta),corner.center[1]+corner.radius*Math.sin(theta)]);}
    push(corner.end);
  }
  push(route.points.at(-1)!);return result;
}

export function walkingRouteIssue(route:RoundedRoute,bounds:TerrainBounds){
  const original=pathIssue(route,bounds);if(original)return original;
  const points=roundedRoutePoints(route);return points===route.points ? null : pathIssue({points,width:route.width},bounds,{sampled:true});
}
