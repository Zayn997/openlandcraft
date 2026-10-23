import {footprint,type PlanPoint} from './architecture';
import type {Level,Project,Slab} from './model';
import {stairAxes,stairEndpoints} from './stairs';
import {spiralSweep} from './spiral-stairs';
import {levelToWorld,worldToLevel,type StairEnd,type StairLanding} from './stair-connections';
import {floorContainsPath,ccwPlan} from './floor-cuts';
import {canEditObject,objectOwners} from './layers';
const r=(n:number)=>Number(n.toFixed(9));
const add=(a:PlanPoint,b:PlanPoint,k=1):PlanPoint=>[r(a[0]+b[0]*k),r(a[1]+b[1]*k)];
const level=(project:Project,p:Slab)=>project.entities.find((e):e is Level=>e.kind==='level'&&e.id===p.parentId)!;
export function stairFloorTargets(project:Project,isolatedLayerId:string|null=null):Slab[]{
 const visible=(id:string,seen=new Set<string>()):boolean=>{if(seen.has(id))return true;seen.add(id);return project.entities.find(e=>e.id===id)?.visible!==false&&objectOwners(project,id).every(p=>visible(p,seen));};
 return project.entities.filter((e):e is Slab=>e.kind==='slab'&&!e.stairs&&visible(e.id)&&canEditObject(project,e.id,isolatedLayerId));
}
function context(project:Project,part:Slab,end:StairEnd){
 const c=part.stairs!.connections![end]!,floor=project.entities.find((e):e is Slab=>e.kind==='slab'&&!e.stairs&&e.id===c.floorId);if(!floor||floor.id===part.id)throw new Error('Choose an existing floor slab for the stair connection.');
 const own=level(project,part),host=level(project,floor),local=add(floor.center,c.point!),anchor=worldToLevel(own,levelToWorld(host,local)),y=host.position[1]+floor.elevation+floor.thickness-own.position[1];
 return {floor,own,host,anchor,y,c,toHost:(p:PlanPoint)=>worldToLevel(host,levelToWorld(own,p))};
}
export function floorAttachmentPoint(project:Project,part:Slab,floor:Slab,end:StairEnd,depth=1.2):PlanPoint{
 const {up}=stairAxes(part),ends=stairEndpoints(part),point=end==='bottom'?ends.start:add(ends.end,up,depth),world=levelToWorld(level(project,part),point),local=worldToLevel(level(project,floor),world);
 return floorContainsPath(footprint(floor),[local],false,0)?world:levelToWorld(level(project,floor),floor.center);
}
export function connectStairFloor(project:Project,part:Slab,floor:Slab,end:StairEnd,world?:PlanPoint,depth=1.2):Slab{
 if(!part.stairs||floor.stairs||floor.id===part.id)throw new Error('Choose stairs and an ordinary floor slab.');
 let point=worldToLevel(level(project,floor),world??floorAttachmentPoint(project,part,floor,end,depth));
 let next=part;if(end==='bottom'&&part.stairs.spiral&&world){const own=worldToLevel(level(project,part),world);if(part.stairs.spiral.towerId)next={...part,stairs:{...part.stairs,direction:r(Math.atan2(own[1]-part.center[1],own[0]-part.center[0])*180/Math.PI)}};else{const start=stairEndpoints(part).start;next={...part,center:add(part.center,add(own,start,-1))};}}
 if(next.stairs!.spiral&&end==='bottom'&&world)point=worldToLevel(level(project,floor),levelToWorld(level(project,next),stairEndpoints(next).start));
 return {...next,stairs:{...next.stairs!,connections:{...next.stairs!.connections,[end]:{floorId:floor.id,point:add(point,floor.center,-1),depth}}}};
}
const pad=(points:PlanPoint[],y:number,thickness:number,paths:NonNullable<StairLanding>['railPaths']):NonNullable<StairLanding>=>({points,elevation:r(y),base:r(y-thickness),railPaths:paths});
function straightPad(part:Slab,start:PlanPoint,up:PlanPoint,depth:number,y:number,back=false){
 const across:PlanPoint=[-up[1],up[0]],end=add(start,up,back?-depth:depth),side=(p:PlanPoint,s:number,inset=0)=>add(p,across,s*(part.width/2-inset));
 return pad([side(start,-1),side(start,1),side(end,1),side(end,-1)],y,part.thickness,[{side:'left',points:[side(start,1,.02),side(end,1,.02)]},{side:'right',points:[side(start,-1,.02),side(end,-1,.02)]}]);
}
function arc(part:Slab,a:number,b:number,radius:number):PlanPoint[]{const n=Math.max(1,Math.ceil(Math.abs(a-b)*180/Math.PI/3));return Array.from({length:n+1},(_,i)=>{const t=a+(b-a)*i/n;return add(part.center,[Math.cos(t),Math.sin(t)],radius);});}
export function resolveStairFloors(project:Project,input:Slab,previous?:Slab):Slab{
 let part=input;
 // Radius/width edits move the walking-line start radially, without moving the tower's center.
 const bottom=part.stairs?.connections?.bottom,old=previous?.stairs?.connections?.bottom;
 if(bottom?.floorId&&old?.floorId===bottom.floorId&&part.stairs?.spiral&&previous?.stairs?.spiral&&JSON.stringify(bottom)===JSON.stringify(old)&&(part.width!==previous.width||part.stairs.spiral.radius!==previous.stairs.spiral.radius)){
  const c=context(project,part,'bottom'),start=stairEndpoints(part).start,prior=stairEndpoints(previous).start,shift=add(c.toHost(start),c.toHost(prior),-1);
  part={...part,stairs:{...part.stairs,connections:{...part.stairs.connections,bottom:{...bottom,point:add(bottom.point,shift)}}}};
 }
 const s=part.stairs!,connections=s.connections;if(!connections?.bottom?.floorId&&!connections?.top?.floorId)return part;
 const landings:NonNullable<typeof s.landings>={};
 if(connections.bottom?.floorId){const c=context(project,part,'bottom'),start=stairEndpoints(part).start,delta=add(c.anchor,start,-1);if(part.stairs!.spiral){if(part.stairs!.spiral!.towerId&&Math.hypot(...delta)>1e-5)throw new Error('Keep the lower floor and tower stair start aligned, or reattach the stair bottom.');part={...part,center:add(part.center,delta)};}else part={...part,center:add(part.center,delta)};part={...part,elevation:r(c.y)};}
 if(connections.top?.floorId){
  const c=context(project,part,'top');
  if(part.stairs!.spiral){const spiral=part.stairs!.spiral!,mean=spiral.radius-part.width/2,angle=Math.max(c.c.depth/mean,part.width/spiral.radius),sign=Math.sign(spiralSweep(part));if(angle>Math.PI/2)throw new Error('Reduce landing depth or width for the spiral floor landing.');
   const dx=c.anchor[0]-part.center[0],dz=c.anchor[1]-part.center[1],start=part.stairs!.direction*Math.PI/180,bearing=Math.hypot(dx,dz)<.1?start+spiralSweep(part)+sign*angle/2:Math.atan2(dz,dx),desired=(bearing-sign*angle/2-start)/sign/(2*Math.PI),turns=desired+Math.round(spiral.turns-desired);if(turns<.25||turns>4)throw new Error('Choose a floor arrival that leaves 0.25–4 spiral turns.');
   part={...part,stairs:{...part.stairs!,spiral:{...spiral,turns:r(turns)}}};const from=start+spiralSweep(part),to=from+sign*angle,inner=spiral.radius-part.width,outer=spiral.radius+.16,inside=arc(part,from,to,inner+.02),outerEnd=arc(part,to,to,outer-.02)[0];
   landings.top=pad([...arc(part,from,to,outer),...arc(part,to,from,inner)],c.y,part.thickness,[{side:sign>0?'left':'right',points:[...inside,outerEnd]},{side:sign>0?'right':'left',points:[arc(part,from,from,spiral.radius-.02)[0],arc(part,from,from,outer-.02)[0]]}]);
   if(!floorContainsPath(footprint(c.floor),arc(part,from,to,outer-.02).map(c.toHost),false))throw new Error('Keep the spiral landing exit on the selected floor. Move or enlarge the floor.');
  }else{
   const start=connections.bottom?.floorId?stairEndpoints(part).start:connections.bottom?.point??stairEndpoints(part).start,dx=c.anchor[0]-start[0],dz=c.anchor[1]-start[1],length=Math.hypot(dx,dz);if(length<c.c.depth+.5)throw new Error('Choose a floor arrival farther from the lower stair start.');const up:PlanPoint=[dx/length,dz/length],end=add(c.anchor,up,-c.c.depth);part={...part,center:[r((start[0]+end[0])/2),r((start[1]+end[1])/2)],depth:r(length-c.c.depth),stairs:{...part.stairs!,direction:r(Math.atan2(up[1],up[0])*180/Math.PI)}};landings.top=straightPad(part,end,up,c.c.depth,c.y);
   const across:PlanPoint=[-up[1],up[0]];if(!floorContainsPath(footprint(c.floor),[-1,1].map(n=>c.toHost(add(c.anchor,across,n*part.width/2))),false))throw new Error('Keep the landing entrance on the selected floor. Move the arrival inward or increase floor width.');
  }
  part={...part,stairs:{...part.stairs!,rise:r(c.y-part.elevation)}};
 }
 if(connections.bottom?.floorId){const c=context(project,part,'bottom');if(part.stairs!.spiral){const spiral=part.stairs!.spiral!,a=part.stairs!.direction*Math.PI/180,sign=Math.sign(spiralSweep(part)),angle=Math.max(c.c.depth/(spiral.radius-part.width/2),part.width/spiral.radius);if(angle>Math.PI/2)throw new Error('Reduce depth or width for this spiral landing.');const b=a-sign*angle,inner=spiral.radius-part.width;landings.bottom=pad([...arc(part,a,b,spiral.radius),...arc(part,b,a,inner)],c.y,part.thickness,[{side:sign>0?'left':'right',points:arc(part,a,b,inner+.02)},{side:sign>0?'right':'left',points:arc(part,a,b,spiral.radius-.02)}]);}
  else landings.bottom=straightPad(part,stairEndpoints(part).start,stairAxes(part).up,c.c.depth,c.y,true);
  if(!floorContainsPath(footprint(c.floor),landings.bottom.points.map(c.toHost),true))throw new Error('Keep the whole bottom landing on the selected floor. Move it inward or enlarge the floor.');
 }
 return {...part,stairs:{...part.stairs!,landings}};
}
/** Owned shaft in floor-level space. A straight shaft clears 2 m above each tread. */
export function stairFloorOpening(project:Project,part:Slab):{floor:Slab;points:PlanPoint[]}|null{
 if(!part.stairs?.connections?.top?.floorId)return null;const c=context(project,part,'top'),s=part.stairs;let points:PlanPoint[];
 if(s.spiral){const radius=s.spiral.radius+.08;points=Array.from({length:120},(_,i)=>add(part.center,[Math.cos(i*Math.PI/60),Math.sin(i*Math.PI/60)],radius));}
 else{const {start,end}=stairEndpoints(part),{up,across}=stairAxes(part),clearance=Math.max(2,(s.railings?.height??0)+.15),floorBottom=c.y-c.floor.thickness,first=Math.max(0,Math.floor((floorBottom-part.elevation-clearance)/(s.rise/s.steps))),from=add(start,up,Math.max(0,first*part.depth/s.steps-.08)),to=add(end,up,.04),half=part.width/2+.08;points=[add(from,across,-half),add(to,across,-half),add(to,across,half),add(from,across,half)];}
 return {floor:c.floor,points:ccwPlan(points.map(p=>c.toHost(p).map(r) as PlanPoint))};
}
