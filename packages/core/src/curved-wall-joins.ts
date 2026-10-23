import type { Entity, Project, Wall } from './model';
import type { PlanPoint } from './architecture';
import { isCircularWall } from './curved-walls';
import { openingIntersectsSpan,wallProfileSamples } from './opening-profile';
import { fitArcEndpoints, offsetIntersections, onWallInterior, pathCross, pathDistance, pathDot, pathLength, pathParameter, pathSub, wallCrossings, wallEnds, wallPathPoint, wallTangent } from './wall-path';

const near=(a:PlanPoint,b:PlanPoint)=>pathDistance(a,b)<1e-5;
export function endpointNeighbor(w:Wall,end:'start'|'end',walls:Wall[]):Wall|undefined{
  return w.joins?walls.find(o=>o.id!==w.id&&o.joins&&o.parentId===w.parentId&&wallEnds(o).some(e=>near(o[e],w[end]))):undefined;
}
export function junctionHost(w:Wall,end:'start'|'end',walls:Wall[]):Wall|undefined{
  const host=walls.find(o=>o.id===w.junctions?.[end]);return w.joins&&host?.joins&&onWallInterior(w[end],host)?host:undefined;
}
const away=(w:Wall,end:'start'|'end'):PlanPoint=>wallTangent(w,end==='start'?0:1).map(v=>v*(end==='start'?1:-1)) as PlanPoint;
export function hostFace(w:Wall,end:'start'|'end',host:Wall):number{
  const tangent=wallTangent(host,pathParameter(w[end],host));return Math.sign(pathCross(tangent,away(w,end)))*host.thickness/2;
}
/** The rendered boundary is shared by host solids and the ends trimmed to them. */
export function curveBoundary(w:Wall,lateral:number,walls:Wall[]):PlanPoint[]{
  if(isCircularWall(w))return wallProfileSamples(w).map(x=>wallPathPoint(w,x/pathLength(w),lateral));
  const start=mixedWallCap(w,'start',lateral,walls)??wallPathPoint(w,0,lateral),end=mixedWallCap(w,'end',lateral,walls)??wallPathPoint(w,1,lateral);
  return [start,...wallBodySamples(w,walls).slice(1,-1).map(x=>wallPathPoint(w,x/pathLength(w),lateral)),end];
}
/** Both faces share longitudinal slices; samples behind either miter cap are omitted. */
export function wallBodySamples(w:Wall,walls:Wall[]):number[]{
  const length=pathLength(w),samples=wallProfileSamples(w);if(!w.curve||isCircularWall(w))return samples;
  const ends=(end:'start'|'end')=>[-w.thickness/2,w.thickness/2].map(side=>boundaryParameter(mixedWallCap(w,end,side,walls)??wallPathPoint(w,end==='start'?0:1,side),w,end==='start'?0:1)*length);
  const lo=Math.max(0,...ends('start')),hi=Math.min(length,...ends('end'));
  return [0,...samples.filter(x=>x>lo+1e-8&&x<hi-1e-8),length];
}
function boundaryParameter(p:PlanPoint,w:Wall,near:number){const t=pathParameter(p,w),turn=360/Math.abs(w.curve!.sweepAngle);return t+Math.round((near-t)/turn)*turn;}
function lineBoundaryHits(w:Wall,lateral:number,host:Wall,face:number,walls:Wall[]):PlanPoint[]{
  const points=curveBoundary(host,face,walls),origin=wallPathPoint(w,0,lateral),d=wallTangent(w,0),hits:PlanPoint[]=[];
  for(let i=1;i<points.length;i++){const a=points[i-1],v=pathSub(points[i],a),den=pathCross(d,v);if(Math.abs(den)<1e-10)continue;const delta=pathSub(a,origin),t=pathCross(delta,v)/den,u=pathCross(delta,d)/den;if(u>=-1e-7&&u<=1+1e-7)hits.push([origin[0]+t*d[0],origin[1]+t*d[1]]);}
  return hits;
}
/** Offset-curve intersections give both thicknesses a common cap, without changing either wall. */
export function mixedWallCap(w:Wall,end:'start'|'end',lateral:number,walls:Wall[]):PlanPoint|null{
  if(!w.joins||isCircularWall(w))return null;
  const host=junctionHost(w,end,walls),other=host??endpointNeighbor(w,end,walls);
  if(!other||!w.curve&&!other.curve)return null;
  if(w.curve&&other.curve)return null;
  let face:number;
  if(host)face=hostFace(w,end,host);
  else {
    if(Math.abs(Math.abs(lateral)-w.thickness/2)>1e-8){const a=mixedWallCap(w,end,-w.thickness/2,walls),b=mixedWallCap(w,end,w.thickness/2,walls),t=lateral/w.thickness+.5;return a&&b?[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]:null;}
    const otherEnd=wallEnds(other).find(e=>near(other[e],w[end]))!;
    if(pathDot(away(w,end),away(other,otherEnd))< -0.999999)return wallPathPoint(w,end==='start'?0:1,lateral); // Tangent continuation: a thickness step.
    face=lateral*(end===otherEnd?-1:1)*other.thickness/w.thickness;
  }
  const hits=host?.curve&&!w.curve?lineBoundaryHits(w,lateral,host,face,walls):offsetIntersections(w,lateral,other,face);
  return hits.sort((a,b)=>pathDistance(a,w[end])-pathDistance(b,w[end]))[0]??null;
}
/** Nonuniform depth slices include host polygon vertices, preventing cracks at curved T caps. */
export function curvedCapSlices(w:Wall,walls:Wall[]):number[]{
  const half=w.thickness/2,values=[-half,half],d=wallTangent(w,0),normal:PlanPoint=[-d[1],d[0]];
  if(w.curve)return values;
  for(const end of wallEnds(w)){const host=junctionHost(w,end,walls);if(!host?.curve)continue;
    for(const p of curveBoundary(host,hostFace(w,end,host),walls)){
      const offset=pathDot(pathSub(p,w.start),normal);
      if(offset> -half+1e-8&&offset<half-1e-8&&pathDistance(p,w[end])<Math.max(w.thickness,host.thickness)*4)values.push(offset);
    }
  }
  return [...new Set(values)].sort((a,b)=>a-b);
}
export function attachWallJunctions(w:Wall,walls:Wall[]):Wall{
  const junctions:Wall['junctions']={};
  for(const end of wallEnds(w)){const hosts=walls.filter(o=>o.id!==w.id&&o.joins&&o.parentId===w.parentId&&onWallInterior(w[end],o));if(hosts.length>1)throw new Error('Choose a single host wall for this connection.');if(hosts[0])junctions[end]=hosts[0].id;}
  return {...w,junctions:Object.keys(junctions).length?junctions:undefined};
}
export function connectCurvedWall(project:Project,wall:Wall):Wall{
  if(!wall.joins)return wall;
  const walls=project.entities.filter((e):e is Wall=>e.kind==='wall'&&e.parentId===wall.parentId&&!!e.joins);
  const profile=walls.find(o=>wallEnds(wall).some(end=>onWallInterior(wall[end],o)||wallEnds(o).some(e=>near(wall[end],o[e]))));
  const next=attachWallJunctions({...wall,...(profile?{height:profile.height,elevation:profile.elevation}:{})},walls);
  for(const other of walls)if(wallCrossings(next,other).some(p=>onWallInterior(p,next)&&onWallInterior(p,other)))throw new Error('Crossing walls are not supported. End the arc on an existing wall instead.');
  return next;
}
/** End directions snap to actual line/circle intersections, retaining the authored radius. */
export function snapArcEndPoint(point:PlanPoint,center:PlanPoint,start:PlanPoint,walls:Wall[]):PlanPoint{
  const radius=pathDistance(center,start),direction=pathSub(point,center),length=Math.hypot(...direction);
  if(length<.2||radius<.25)return point;
  const projected:PlanPoint=[center[0]+direction[0]*radius/length,center[1]+direction[1]*radius/length];
  const hits=walls.filter(w=>!w.curve).flatMap(w=>offsetIntersections(w,0,{...w,curve:{center,radius,startAngle:0,sweepAngle:360}},0).filter(p=>pathParameter(p,w)>=-1e-6&&pathParameter(p,w)<=1+1e-6&&pathDistance(p,projected)<=w.thickness/2+.4));
  return hits.sort((a,b)=>pathDistance(a,projected)-pathDistance(b,projected))[0]??point;
}
export function mixedJoinIssue(w:Wall,walls:Wall[]):string|null{
  if(isCircularWall(w)&&Object.keys(w.junctions??{}).length)return 'A circular wall is a host, not an endpoint branch.';
  if(w.curve&&!isCircularWall(w)&&w.joins)for(const side of [-w.thickness/2,w.thickness/2]){
    const a=mixedWallCap(w,'start',side,walls)??wallPathPoint(w,0,side),b=mixedWallCap(w,'end',side,walls)??wallPathPoint(w,1,side);
    if(boundaryParameter(b,w,1)-boundaryParameter(a,w,0)<.2/pathLength(w))return 'The joins leave too little arc between its ends. Increase the radius or arc length.';
  }
  for(const end of wallEnds(w)){
    const neighbors=walls.filter(o=>o.id!==w.id&&o.joins&&o.parentId===w.parentId&&wallEnds(o).some(e=>near(o[e],w[end]))),host=junctionHost(w,end,walls),other=host??neighbors[0];
    if(!w.joins||!other||!w.curve&&!other.curve)continue;
    if(w.curve&&other.curve)return 'Curve-to-curve joins are not supported yet. Connect a straight wall to the curve.';
    if(neighbors.length>1||host&&neighbors.length)return 'A shared endpoint supports two walls. Connect a straight wall to the side for a T junction.';
    if(Math.abs(w.height-other.height)>1e-6||Math.abs(w.elevation-other.elevation)>1e-6)return 'Joined walls must share their height and base elevation; their thicknesses may differ.';
    if(host){if(Math.abs(pathCross(away(w,end),wallTangent(host,pathParameter(w[end],host))))<.5-1e-6)return 'Interior wall joins must meet the host at an angle of at least 30°.';}
    else {const oe=wallEnds(other).find(e=>near(other[e],w[end]))!;if(pathDot(away(w,end),away(other,oe))>Math.cos(Math.PI/6)+1e-8)return 'Joined wall angles must be at least 30°.';}
    const caps=[-w.thickness/2,w.thickness/2].map(side=>mixedWallCap(w,end,side,walls));
    if(caps.some(p=>!p||!p.every(Number.isFinite)))return 'These wall thicknesses cannot form a clean join at this radius and angle.';
    if(caps.some(p=>pathDistance(p!,w[end])>Math.min(pathLength(w),pathLength(other))*.45))return 'The joined corner is too tight for this wall length, radius and thickness.';
    if(host){
      const t=pathParameter(w[end],host),length=pathLength(host),span=caps.map(p=>{let dt=pathParameter(p!,host)-t;if(isCircularWall(host))dt=((dt+.5)%1+1)%1-.5;return (t+dt)*length;}),lo=Math.min(...span),hi=Math.max(...span);
      if(!isCircularWall(host)&&(lo<.1||hi>length-.1))return 'Move the interior wall farther from the host corner.';
      if(host.openings?.some(o=>openingIntersectsSpan(host,o,lo,hi)))return 'The wall junction would intersect a door or window. Move the connection or the opening.';
      for(const branch of walls)for(const e of wallEnds(branch))if(branch.id!==w.id&&branch.joins&&branch.junctions?.[e]===host.id&&Math.sign(hostFace(branch,e,host))===Math.sign(hostFace(w,end,host))){
        const center=pathParameter(branch[e],host)*length;let delta=center-t*length;if(isCircularWall(host))delta=((delta+length/2)%length+length)%length-length/2;
        const reach=branch.thickness/(2*Math.max(.5,Math.abs(pathCross(away(branch,e),wallTangent(host,pathParameter(branch[e],host))))));
        if(t*length+delta+reach>lo+1e-6&&t*length+delta-reach<hi-1e-6)return 'These interior wall connections overlap. Move them farther apart.';
      }
    }
  }
  return null;
}
/** Mixed networks resolve against the original document; each authored wall keeps its identity. */
export function replaceMixedJoinedWall(entities:Entity[],previous:Wall,next:Wall):Entity[]{
  const walls=entities.filter((e):e is Wall=>e.kind==='wall'&&e.parentId===previous.parentId),joinChange=!!previous.joins!==!!next.joins;
  const connected=new Set([previous.id]);
  const related=(a:Wall,b:Wall)=>wallEnds(a).some(e=>wallEnds(b).some(f=>near(a[e],b[f])))||Object.values(a.junctions??{}).includes(b.id)||Object.values(b.junctions??{}).includes(a.id);
  for(let pass=0;pass<walls.length;pass++)for(const a of walls)if((joinChange||a.joins)&&!connected.has(a.id)&&walls.some(b=>connected.has(b.id)&&related(a,b)))connected.add(a.id);
  const profile=joinChange&&next.joins||previous.height!==next.height||previous.elevation!==next.elevation;
  const moved=new Map(walls.map(w=>[w.id,w.id===previous.id?next:connected.has(w.id)?{...w,...(joinChange?{joins:next.joins}:{}),...(profile?{height:next.height,elevation:next.elevation}:{})}:w]));
  const targets=new Map<string,Partial<Record<'start'|'end',PlanPoint>>>(),queue=[previous.id];let steps=0;
  while(queue.length){
    if(++steps>walls.length*8)throw new Error('These joined walls cannot follow this edit consistently. Detach a connection first.');
    const id=queue.shift()!,before=walls.find(w=>w.id===id)!,after=moved.get(id)!;
    for(const branch of walls){if(branch.id===previous.id||!connected.has(branch.id)||!branch.joins)continue;
      const requested=targets.get(branch.id)??{};let changed=false;
      for(const end of wallEnds(branch)){
        let point:PlanPoint|undefined;
        const shared=wallEnds(before).find(e=>near(branch[end],before[e]));
        if(shared)point=after[shared];
        if(branch.junctions?.[end]===id&&onWallInterior(branch[end],before))point=wallPathPoint(after,pathParameter(branch[end],before));
        if(point&&!near(point,requested[end]??branch[end])){requested[end]=point;changed=true;}
      }
      if(changed){targets.set(branch.id,requested);const current=moved.get(branch.id)!,fitted=fitArcEndpoints(branch,requested.start??branch.start,requested.end??branch.end);moved.set(branch.id,{...current,start:fitted.start,end:fitted.end,...(fitted.curve?{curve:fitted.curve,openings:fitted.openings}:{})});queue.push(branch.id);}
    }
  }
  return entities.map(e=>e.kind==='wall'?(moved.get(e.id)??e):e);
}
