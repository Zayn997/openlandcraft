import {resolveStairFloors,stairFloorOpening} from './stair-floors';
import {clipPathPolygon,polygonArea} from '@openlandcraft/landscape';
import {ccwPlan} from './floor-cuts';
import {canEditObject,objectOwners} from './layers';
import {type Level,type Project,type Slab,type Wall} from './model';
import type {PlanPoint} from './architecture';
import {stairEndpoints,stairsIssue} from './stairs';
import {spiralSweep} from './spiral-stairs';
import {isCircularWall} from './curved-walls';
import {wallWalkProfile} from './wall-walks';
import {pathLength,pathParameter,wallPathPoint,wallTangent} from './wall-path';
import {evaluateProject} from './surface';
import {lakeDistance,sampleRiver,pointSegmentDistance} from '@openlandcraft/landscape';

export type StairEnd='bottom'|'top';
export type StairLanding=NonNullable<NonNullable<Slab['stairs']>['landings']>['top'];
type ConnectionProject=Pick<Project,'site'|'entities'>;
const r=(v:number)=>Number(v.toFixed(9)),p=(x:number,z:number):PlanPoint=>[r(x),r(z)];
const add=(a:PlanPoint,b:PlanPoint,k=1):PlanPoint=>p(a[0]+b[0]*k,a[1]+b[1]*k);
const dot=(a:PlanPoint,b:PlanPoint)=>a[0]*b[0]+a[1]*b[1];
const unit=(a:PlanPoint):PlanPoint=>{const n=Math.hypot(...a);if(n<.1)throw new Error('Move the lower stair start away from the upper landing.');return [a[0]/n,a[1]/n];};
export function levelToWorld(level:Level,point:PlanPoint):PlanPoint{const a=level.rotation*Math.PI/180;return p(level.position[0]+point[0]*Math.cos(a)+point[1]*Math.sin(a),level.position[2]-point[0]*Math.sin(a)+point[1]*Math.cos(a));}
export function worldToLevel(level:Level,point:PlanPoint):PlanPoint{const a=level.rotation*Math.PI/180,x=point[0]-level.position[0],z=point[1]-level.position[2];return p(x*Math.cos(a)-z*Math.sin(a),x*Math.sin(a)+z*Math.cos(a));}
const owner=(project:ConnectionProject,part:{parentId:string})=>{const level=project.entities.find((e):e is Level=>e.kind==='level'&&e.id===part.parentId);if(!level)throw new Error('Stair connections need an existing level.');return level;};
const landing=(points:PlanPoint[],elevation:number,base:number,railPaths:NonNullable<StairLanding>['railPaths']):NonNullable<StairLanding>=>({points,elevation:r(elevation),base:r(base),railPaths});
export function detachStairEnd(part:Slab,end:StairEnd):Slab{
  if(!part.stairs)return part;const connections={...part.stairs.connections};delete connections[end];
  const landings={...part.stairs.landings};delete landings[end];
  return {...part,stairs:{...part.stairs,connections:Object.keys(connections).length?connections:undefined,landings:Object.keys(landings).length?landings:undefined}};
}
/** Shared target eligibility for the scene picker and its keyboard alternative. */
export function stairWalkTargets(project:Project,stairId?:string,isolatedLayerId:string|null=null):Wall[]{
  const stairs=project.entities.find((e):e is Slab=>e.kind==='slab'&&e.id===stairId);
  const visible=(id:string,seen=new Set<string>()):boolean=>{if(seen.has(id))return true;seen.add(id);return project.entities.find(e=>e.id===id)?.visible!==false&&objectOwners(project,id).every(p=>visible(p,seen));};
  return project.entities.filter((e):e is Wall=>{if(e.kind!=='wall'||!e.walk||!visible(e.id)||!canEditObject(project,e.id,isolatedLayerId))return false;if(!stairs?.stairs?.spiral)return true;if(!isCircularWall(e))return false;const a=levelToWorld(owner(project,stairs),stairs.center),b=levelToWorld(owner(project,e),e.curve!.center);return Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5;});
}
/** Pick a broad walking surface; the nearest band edge defines the approach side. */
export function stairWalkTarget(project:ConnectionProject,wall:Wall,world:PlanPoint){
  if(!wall.walk)throw new Error('Choose a wall with a wall walk.');
  const point=worldToLevel(owner(project,wall),world),position=Math.max(0,Math.min(1,pathParameter(point,wall))),profile=wallWalkProfile(wall);
  const a=wallPathPoint(wall,position,profile.side*profile.inner),b=wallPathPoint(wall,position,profile.side*profile.outer);
  return {wallId:wall.id,position:r(position),edge:Math.hypot(point[0]-a[0],point[1]-a[1])<=Math.hypot(point[0]-b[0],point[1]-b[1])?'inner' as const:'outer' as const,depth:1.2};
}
export function connectStairBottom(project:Project,part:Slab,world?:PlanPoint,depth=1.2):Slab{
  if(!part.stairs)throw new Error('Choose stairs first.');
  const point=world?worldToLevel(owner(project,part),world):stairEndpoints(part).start;
  let next=part;
  if(part.stairs.spiral&&world){
    const dx=point[0]-part.center[0],dz=point[1]-part.center[1];
    if(part.stairs.spiral.towerId){next={...part,stairs:{...part.stairs,direction:r(Math.atan2(dz,dx)*180/Math.PI)}};}
    else {const start=stairEndpoints(part).start;next={...part,center:add(part.center,add(point,start,-1))};}
  }
  return {...next,stairs:{...next.stairs!,connections:{...next.stairs!.connections,bottom:{point,depth}}}};
}
export function connectStairTop(project:Project,part:Slab,wall:Wall,world:PlanPoint,depth=1.2):Slab{
  if(!part.stairs)throw new Error('Choose stairs first.');const target=stairWalkTarget(project,wall,world);
  if(part.stairs.spiral)target.edge='inner';
  return {...part,stairs:{...part.stairs,connections:{...part.stairs.connections,top:{...target,depth}}}};
}
/** Match the rendered heightfield triangles, rather than bilinear placement sampling. */
function terrainTriangleHeight(site:Project['site'],q:PlanPoint):number{
  const f=site.terrain,x=(q[0]/site.width+.5)*(f.columns-1),z=(q[1]/site.depth+.5)*(f.rows-1),col=Math.min(f.columns-2,Math.max(0,Math.floor(x))),row=Math.min(f.rows-2,Math.max(0,Math.floor(z))),u=x-col,v=z-row,i=row*f.columns+col;
  const a=f.heights[i],b=f.heights[i+1],c=f.heights[i+f.columns],d=f.heights[i+f.columns+1];return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
function terrainLanding(project:Project,part:Slab,points:PlanPoint[],paths:NonNullable<StairLanding>['railPaths']):NonNullable<StairLanding>{
  const level=owner(project,part),surface=evaluateProject(project),world=points.map(q=>levelToWorld(level,q)),samples:PlanPoint[]=[...world];
  const {terrain,width,depth}=surface.site,gx=width/(terrain.columns-1),gz=depth/(terrain.rows-1);
  // Extrema of the clipped triangle mesh occur at pad corners, crossed grid/diagonal
  // edges, or terrain vertices inside the pad. This also catches narrow steep peaks.
  for(let i=0;i<world.length;i++){const a=world[i],b=world[(i+1)%world.length],u=[(a[0]+width/2)/gx,(a[1]+depth/2)/gz],v=[(b[0]+width/2)/gx,(b[1]+depth/2)/gz];for(const [from,to] of [[u[0],v[0]],[u[1],v[1]],[u[0]+u[1],v[0]+v[1]]]){if(Math.abs(to-from)<1e-10)continue;for(let k=Math.ceil(Math.min(from,to));k<=Math.floor(Math.max(from,to));k++){const t=(k-from)/(to-from);if(t>0&&t<1)samples.push(add(a,add(b,a,-1),t));}}}
  for(let row=Math.max(0,Math.floor((Math.min(...world.map(q=>q[1]))+depth/2)/gz));row<=Math.min(terrain.rows-1,Math.ceil((Math.max(...world.map(q=>q[1]))+depth/2)/gz));row++)for(let col=Math.max(0,Math.floor((Math.min(...world.map(q=>q[0]))+width/2)/gx));col<=Math.min(terrain.columns-1,Math.ceil((Math.max(...world.map(q=>q[0]))+width/2)/gx));col++){const q:PlanPoint=[col*gx-width/2,row*gz-depth/2];if(lakeDistance(world,...q)>=-1e-8)samples.push(q);}
  if(samples.some(q=>Math.abs(q[0])>width/2+1e-8||Math.abs(q[1])>depth/2+1e-8))throw new Error('Keep the bottom landing on the site terrain.');
  const river=project.entities.find(e=>e.kind==='river'),riverPath=river?.kind==='river'?sampleRiver(river.points):[];
  const heights=samples.map(q=>{
    const y=terrainTriangleHeight(surface.site,q);
    for(const water of project.entities){
      if(water.kind==='ocean'&&y<water.level+.02||water.kind==='lake'&&lakeDistance(water.points,...q)>=0&&y<water.level+.02)throw new Error('Choose dry ground for the bottom landing.');
      if(water.kind==='river'&&riverPath.some((a,i)=>i>0&&pointSegmentDistance(q,[riverPath[i-1].x,riverPath[i-1].z],[a.x,a.z])<=water.width/2&&y<Math.max(a.y,riverPath[i-1].y)))throw new Error('Choose dry ground outside the river for the bottom landing.');
    }
    return y-level.position[1];
  });
  return landing(points,Math.max(...heights)+.08,Math.min(...heights)-.08,paths);
}
function straightBottom(project:Project,part:Slab,start:PlanPoint,up:PlanPoint,depth:number){
  const across:PlanPoint=[-up[1],up[0]],front=[add(start,across,-part.width/2),add(start,across,part.width/2)],back=front.map(q=>add(q,up,-depth));
  const side=(sign:number)=>[add(start,across,sign*(part.width/2-.02)),add(add(start,up,-depth+.02),across,sign*(part.width/2-.02))];
  return terrainLanding(project,part,[front[0],front[1],back[1],back[0]],[{side:'left',points:side(1)},{side:'right',points:side(-1)}]);
}
function arcPoints(part:Slab,from:number,to:number,radius:number):PlanPoint[]{const count=Math.max(1,Math.ceil(Math.abs(to-from)*180/Math.PI/3));return Array.from({length:count+1},(_,i)=>{const a=from+(to-from)*i/count;return add(part.center,[Math.cos(a),Math.sin(a)],radius);});}
function spiralLandingAngle(part:Slab,depth:number){const mean=part.stairs!.spiral!.radius-part.width/2,angle=Math.max(depth/mean,part.width/part.stairs!.spiral!.radius);if(angle>Math.PI/2+1e-8)throw new Error('Reduce landing depth or width, or increase spiral radius, to keep the landing within a quarter turn.');return angle;}
function spiralBottom(project:Project,part:Slab,depth:number){
  const spiral=part.stairs!.spiral!,angle=part.stairs!.direction*Math.PI/180,sign=Math.sign(spiralSweep(part)),end=angle-sign*spiralLandingAngle(part,depth),inner=spiral.radius-part.width;
  const outer=arcPoints(part,angle,end,spiral.radius),inside=arcPoints(part,end,angle,inner),left=sign>0?'left':'right',right=sign>0?'right':'left';
  return terrainLanding(project,part,[...outer,...inside],[{side:left,points:arcPoints(part,angle,end,inner+.02)},{side:right,points:arcPoints(part,angle,end,spiral.radius-.02)}]);
}
type Access=NonNullable<NonNullable<Wall['walk']>['stairOpenings']>[number];
function wallContext(project:Project,part:Slab){
  const source=part.stairs!.connections!.top!,top={...source,wallId:source.wallId!,position:source.position!,edge:source.edge!},wall=project.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===top.wallId);
  if(!wall?.walk)throw new Error('The attached wall must keep its wall walk. Detach the stair top before removing it.');
  const level=owner(project,part),hostLevel=owner(project,wall),profile=wallWalkProfile(wall),tangent=wallTangent(wall,top.position),inward:PlanPoint=[-tangent[1]*profile.side,tangent[0]*profile.side],normal=top.edge==='inner'?inward.map(v=>-v) as PlanPoint:inward;
  const local=wallPathPoint(wall,top.position,profile.side*(top.edge==='inner'?profile.inner:profile.outer)),anchor=worldToLevel(level,levelToWorld(hostLevel,local));
  const rotation=(hostLevel.rotation-level.rotation)*Math.PI/180,rotate=(q:PlanPoint):PlanPoint=>[q[0]*Math.cos(rotation)+q[1]*Math.sin(rotation),-q[0]*Math.sin(rotation)+q[1]*Math.cos(rotation)];
  return {wall,level,hostLevel,profile,normal:rotate(normal),tangent:rotate(tangent),anchor,y:hostLevel.position[1]+wall.elevation+profile.deckTop-level.position[1],top};
}
function checkAccess(wall:Wall,access:Access){
  const radius=wall.curve?wall.curve.radius-(access.edge==='inner'?wallWalkProfile(wall).inner:wallWalkProfile(wall).outer):0,length=radius?radius*Math.abs(wall.curve!.sweepAngle)*Math.PI/180:pathLength(wall);
  if(access.width>length-.1)throw new Error('The stair entrance is wider than the wall walk. Reduce stair width or choose a longer walk.');
  if(!isCircularWall(wall)&&(access.position*length<access.width/2+.05||(1-access.position)*length<access.width/2+.05))throw new Error('Choose an entrance farther from the wall-walk ends, or reduce stair width.');
}
/** Recompute all dependent geometry before validation and lock checks, for commits and previews alike. */
export function resolveStairConnections(before:Project,project:Project):Project{
  const accesses=new Map<string,Access[]>(),floorCuts=new Map<string,NonNullable<Slab['stairOpenings']>>();
  const entities=project.entities.map(entity=>{
    if(entity.kind!=='slab'||!entity.stairs)return entity;
    let part=entity,connections=part.stairs!.connections;
    for(const end of ['bottom','top'] as const){const c=part.stairs!.connections?.[end],id=c?.floorId??(end==='top'?part.stairs!.connections?.top?.wallId:undefined);if(id&&!project.entities.some(e=>e.id===id)&&before.entities.some(e=>e.id===id))part=detachStairEnd(part,end);}
    part=resolveStairFloors(project,part,before.entities.find((e):e is Slab=>e.kind==='slab'&&e.id===part.id));
    connections=part.stairs!.connections;
    if(!connections?.top&&!connections?.bottom)return {...part,stairs:{...part.stairs!,connections:undefined,landings:undefined}};
    const level=owner(project,part),landings:NonNullable<NonNullable<Slab['stairs']>['landings']>={...(connections.bottom?.floorId?{bottom:part.stairs!.landings!.bottom}:{}),...(connections.top?.floorId?{top:part.stairs!.landings!.top}:{})};let access:Access|undefined;
    if(part.stairs!.spiral){
      if(connections.top?.wallId){
        const c=wallContext(project,part),center=worldToLevel(level,levelToWorld(c.hostLevel,c.wall.curve?.center??[0,0]));
        if(!isCircularWall(c.wall)||connections.top.edge!=='inner'||Math.hypot(part.center[0]-center[0],part.center[1]-center[1])>1e-5)throw new Error('Fit spiral stairs to a circular tower before attaching to its inner wall walk.');
        const angle=spiralLandingAngle(part,connections.top.depth),sign=Math.sign(spiralSweep(part)),target=worldToLevel(level,levelToWorld(c.hostLevel,wallPathPoint(c.wall,c.top.position))),bearing=Math.atan2(target[1]-part.center[1],target[0]-part.center[0]),start=part.stairs!.direction*Math.PI/180;
        const desired=(bearing-sign*angle/2-start)/sign/(Math.PI*2),turns=desired+Math.round(part.stairs!.spiral!.turns-desired);
        if(turns<.25||turns>4)throw new Error('Choose a wall-walk point that leaves between a quarter turn and four spiral turns.');
        part={...part,stairs:{...part.stairs!,spiral:{...part.stairs!.spiral!,turns:r(turns)}}};
        const from=start+spiralSweep(part),to=from+sign*angle,inner=part.stairs!.spiral!.radius-part.width,outer=c.wall.curve!.radius-c.profile.inner+.08;
        const innerPath=arcPoints(part,from,to,inner+.02),outerStart=arcPoints(part,from,from,part.stairs!.spiral!.radius-.02)[0],entry=arcPoints(part,from,from,outer-.02)[0],outerEnd=arcPoints(part,to,to,outer-.02)[0];
        landings.top=landing([...arcPoints(part,from,to,outer),...arcPoints(part,to,from,inner)],c.y,c.y-part.thickness,[{side:sign>0?'left':'right',points:[...innerPath,outerEnd]},{side:sign>0?'right':'left',points:[outerStart,entry]}]);
        access={stairId:part.id,position:c.top.position,width:r((c.wall.curve!.radius-c.profile.inner)*angle+.08),edge:'inner'};
        part={...part,stairs:{...part.stairs!,rise:r(c.y-part.elevation)}};
      }
      if(connections.bottom&&!connections.bottom.floorId){landings.bottom=spiralBottom(project,part,connections.bottom.depth);part={...part,elevation:landings.bottom.elevation,stairs:{...part.stairs!,connections:{...connections,bottom:{...connections.bottom,point:stairEndpoints(part).start}}}};if(landings.top)part={...part,stairs:{...part.stairs!,rise:r(landings.top.elevation-part.elevation)}};}
    }else{
      const start=connections.bottom&&!connections.bottom.floorId?connections.bottom.point:stairEndpoints(part).start,c=connections.top?.wallId?wallContext(project,part):null,end=c?add(c.anchor,c.normal,-c.top.depth):stairEndpoints(part).end,up=unit(add(end,start,-1)),across:PlanPoint=[-up[1],up[0]];
      if(c){
        const cosine=dot(up,c.normal);if(cosine<Math.SQRT1_2-1e-8)throw new Error('Choose ground facing this walk edge. Approach the landing within 45° of the wall normal.');
        if(c.top.depth<part.width/2*Math.sqrt(1-cosine*cosine)+.15)throw new Error('Increase landing depth to keep the stair flight clear of the wall.');
        const width=part.width/cosine+.08;let inset=c.top.edge==='outer'?c.wall.walk!.parapetThickness+.08:.08;
        if(c.wall.curve){const inner=c.wall.curve.radius-c.profile.inner,parapet=c.wall.curve.radius-c.profile.parapetInner,half=width/2;
          if(c.top.edge==='outer'){const radius=parapet-.08;if(radius<=half)throw new Error('Reduce stair width for this curved landing.');const center=Math.sqrt(radius*radius-half*half);if(center<inner+.02)throw new Error('Increase walk width or wall radius for this landing.');inset=c.wall.curve.radius-c.profile.outer-center;}
          else if(Math.hypot(inner+.08,half)>parapet-.02)throw new Error('Increase walk width or wall radius for this landing.');
        }
        const entryAcross=c.tangent.map(v=>v*(dot(across,c.tangent)<0?-1:1)) as PlanPoint,entry=add(c.anchor,c.normal,inset),a=add(end,across,-part.width/2),b=add(end,across,part.width/2),d=add(entry,entryAcross,-width/2),e=add(entry,entryAcross,width/2);
        landings.top=landing([a,b,e,d],c.y,c.y-part.thickness,[{side:'left',points:[add(end,across,part.width/2-.02),add(entry,entryAcross,width/2-.02)]},{side:'right',points:[add(end,across,-part.width/2+.02),add(entry,entryAcross,-width/2+.02)]}]);
        const edgeRadius=c.wall.curve?c.wall.curve.radius-(c.top.edge==='inner'?c.profile.inner:c.profile.outer):0;
        if(edgeRadius&&(width+.08)/(2*edgeRadius)>=.95)throw new Error('Reduce stair width or increase wall radius for this entrance.');
        const openingWidth=edgeRadius?2*edgeRadius*Math.asin((width+.08)/(2*edgeRadius)):width+.08;
        access={stairId:part.id,position:c.top.position,width:r(openingWidth),edge:c.top.edge};
      }
      if(connections.bottom&&!connections.bottom.floorId)landings.bottom=straightBottom(project,part,start,up,connections.bottom.depth);
      const elevation=landings.bottom?.elevation??part.elevation;
      part={...part,center:p((start[0]+end[0])/2,(start[1]+end[1])/2),depth:r(Math.hypot(end[0]-start[0],end[1]-start[1])),elevation,stairs:{...part.stairs!,direction:r(Math.atan2(up[1],up[0])*180/Math.PI),rise:landings.top?r(landings.top.elevation-elevation):part.stairs!.rise}};
    }
    const issue=stairsIssue(part);if(issue)throw new Error(issue);
    for(const pad of Object.values(landings))if(pad.points.some(q=>q.some(v=>Math.abs(v)>100)))throw new Error('Keep all landings within ±100 m of the stair level origin.');
    if(access&&connections.top){const wall=project.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===connections!.top!.wallId)!;checkAccess(wall,access);accesses.set(wall.id,[...(accesses.get(wall.id)??[]),access]);}
    const result={...part,stairs:{...part.stairs!,landings}},cut=stairFloorOpening(project,result);if(cut)floorCuts.set(cut.floor.id,[...(floorCuts.get(cut.floor.id)??[]),{stairId:part.id,points:cut.points}]);
    return result;
  }).map(entity=>entity.kind==='wall'&&entity.walk?{...entity,walk:{...entity.walk,stairOpenings:accesses.get(entity.id)?.sort((a,b)=>a.stairId.localeCompare(b.stairId))}}:entity.kind==='slab'?{...entity,stairOpenings:entity.stairs?undefined:floorCuts.get(entity.id)?.sort((a,b)=>a.stairId.localeCompare(b.stairId))}:entity);
  for(const [id,cuts] of floorCuts){if(cuts.length>32)throw new Error('Keep at most 32 stair openings in a floor.');for(let i=0;i<cuts.length;i++)for(let j=0;j<i;j++)if(polygonArea(clipPathPolygon(cuts[i].points,ccwPlan(cuts[j].points)))>1e-7)throw new Error('Separate floor stair openings or reduce stair width or radius.');}
  for(const [id,gaps] of accesses){const wall=entities.find((e):e is Wall=>e.kind==='wall'&&e.id===id)!;if(gaps.length>32)throw new Error('Keep at most 32 stair entrances on each wall walk.');for(let i=0;i<gaps.length;i++)for(let j=0;j<i;j++){const a=gaps[i],b=gaps[j],d=Math.abs(a.position-b.position),length=wall.curve?(wall.curve.radius-(a.edge==='inner'?wallWalkProfile(wall).inner:wallWalkProfile(wall).outer))*Math.abs(wall.curve.sweepAngle)*Math.PI/180:pathLength(wall);if(a.edge===b.edge&&(isCircularWall(wall)?Math.min(d,1-d):d)*length<(a.width+b.width)/2+.05)throw new Error('Separate the stair entrances or reduce their widths.');}}
  return {...project,entities};
}
const near=(a:unknown,b:unknown):boolean=>{if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<1e-6;if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const x=Object.entries(a).filter(([,v])=>v!==undefined),y=Object.entries(b).filter(([,v])=>v!==undefined);return x.length===y.length&&x.every(([k,v])=>near(v,(b as Record<string,unknown>)[k]));};
export function stairConnectionsIssue(project:Project):string|null{
  if(!project.entities.some(e=>e.kind==='slab'&&(e.stairs?.connections||e.stairs?.landings||e.stairOpenings)||e.kind==='wall'&&e.walk?.stairOpenings))return null;
  try{const resolved=resolveStairConnections(project,project);for(let i=0;i<project.entities.length;i++)if(!near(project.entities[i],resolved.entities[i]))return 'Stair connections, landing geometry and floor/walk openings must match their attached surfaces.';}catch(error){return error instanceof Error?error.message:'Invalid stair connection.';}return null;
}
export function remapStairConnections(part:Slab,ids:Map<string,string>,shift:PlanPoint=[0,0],detachGround=false):Slab{
  if(!part.stairs?.connections)return part;let next=part;
  const bottom=part.stairs.connections.bottom;if(bottom?.floorId){const floorId=ids.get(bottom.floorId);next=floorId?{...next,stairs:{...next.stairs!,connections:{...next.stairs!.connections,bottom:{...bottom,floorId}}}}:detachStairEnd(next,'bottom');}else if(bottom){if(detachGround)next=detachStairEnd(next,'bottom');else next={...next,stairs:{...next.stairs!,connections:{...next.stairs!.connections,bottom:{...bottom,point:add(bottom.point,shift)}}}};}
  const top=part.stairs.connections.top;if(top){const id=ids.get(top.floorId??top.wallId!);next=id?{...next,stairs:{...next.stairs!,connections:{...next.stairs!.connections,top:top.floorId?{...top,floorId:id}:{...top,wallId:id}}}}:detachStairEnd(next,'top');}
  return next;
}
/** Cut ranges normalized to each selected band, including circular seam crossings. */
export function wallAccessRanges(wall:Wall,edge:'inner'|'outer',includeManual=false):[number,number][]{
  if(!wall.walk)return [];const profile=wallWalkProfile(wall),radius=wall.curve?wall.curve.radius-(edge==='inner'?profile.inner:profile.outer)+(includeManual?.02:0):0,length=radius?radius*Math.abs(wall.curve!.sweepAngle)*Math.PI/180:pathLength(wall),circle=isCircularWall(wall);
  const gaps=(wall.walk.stairOpenings??[]).filter(g=>g.edge===edge).map(g=>({position:g.position,width:g.width}));if(includeManual&&edge==='inner'&&wall.walk.railings?.gap)gaps.push(wall.walk.railings.gap);
  const ranges:[number,number][]=[];for(const gap of gaps){const half=(gap.width+.04)/length/2;for(const shift of circle?[-1,0,1]:[0]){const a=gap.position-half+shift,b=gap.position+half+shift;if(b>0&&a<1)ranges.push([Math.max(0,a),Math.min(1,b)]);}}
  return ranges.sort((a,b)=>a[0]-b[0]);
}
export function subtractRanges(start:number,end:number,cuts:[number,number][]):[number,number][]{let intervals:[number,number][]=[[start,end]];for(const [a,b] of cuts)intervals=intervals.flatMap(([x,y])=>b<=x||a>=y?[[x,y] as [number,number]]:[[x,Math.min(y,a)],[Math.max(x,b),y]].filter(([c,d])=>d-c>1e-8) as [number,number][]);return intervals;}
