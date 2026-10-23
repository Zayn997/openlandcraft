import {slabSchema,type Slab} from './model';
import type {PlanPoint} from './architecture';
import {railingIssue} from './railings';
import {spiralIssue,spiralPoint,updateSpiralStairs} from './spiral-stairs';

export const DEFAULT_STAIRS={width:1.5,rise:3.4,run:5.6,steps:18};
export function stairAxes(part:Slab){const a=(part.stairs?.direction??0)*Math.PI/180;return {up:[Math.cos(a),Math.sin(a)] as PlanPoint,across:[-Math.sin(a),Math.cos(a)] as PlanPoint};}
export function stairEndpoints(part:Slab):{start:PlanPoint;end:PlanPoint}{if(part.stairs?.spiral)return {start:spiralPoint(part,0),end:spiralPoint(part,1)};const {up}=stairAxes(part),half=part.depth/2;return {start:[part.center[0]-up[0]*half,part.center[1]-up[1]*half],end:[part.center[0]+up[0]*half,part.center[1]+up[1]*half]};}
export function stairFootprint(part:Slab):PlanPoint[]{if(part.stairs?.spiral)return Array.from({length:120},(_,i)=>[part.center[0]+part.stairs!.spiral!.radius*Math.cos(i*Math.PI/60),part.center[1]+part.stairs!.spiral!.radius*Math.sin(i*Math.PI/60)]);const {up,across}=stairAxes(part);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([width,run])=>[part.center[0]+across[0]*width*part.width/2+up[0]*run*part.depth/2,part.center[1]+across[1]*width*part.width/2+up[1]*run*part.depth/2]);}
export function stairsIssue(part:Slab):string|null{
  const s=part.stairs;if(!s)return null;
  if(part.outline)return 'Stairs use their dimensions, not a custom floor outline.';
  if(!Number.isFinite(s.rise)||s.rise<.2||s.rise>30||!Number.isInteger(s.steps)||s.steps<1||s.steps>128||!Number.isFinite(s.direction))return 'Use total rise 0.2–30 m and a whole step count from 1–128.';
  if(s.spiral)return s.rise/s.steps<.02-1e-8?'Keep each step at least 0.02 m high.':spiralIssue(part)??railingIssue(part);
  if(part.width<.5||part.width>8||part.depth<.5||part.depth>40)return 'Use stair width 0.5–8 m and total run 0.5–40 m.';
  if(s.rise/s.steps<.02-1e-8||part.depth/s.steps<.05-1e-8)return 'Keep each step at least 0.02 m high and 0.05 m deep. Reduce step count or increase rise/run.';
  if(stairFootprint(part).some(p=>p.some(v=>!Number.isFinite(v)||Math.abs(v)>100+1e-6)))return 'Keep the whole stair flight within ±100 m of the level origin.';
  return railingIssue(part);
}
function checked(part:Slab):Slab{const issue=stairsIssue(part);if(issue)throw new Error(issue);if(!slabSchema.safeParse(part).success)throw new Error('Keep stair dimensions, base elevation and direction within the supported limits.');return part;}
export type StairPatch={start?:PlanPoint;width?:number;rise?:number;run?:number;steps?:number;direction?:number;elevation?:number;thickness?:number};
/** Run and direction edits keep the lower landing fixed. */
export function updateStairs(part:Slab,patch:StairPatch):Slab{
  if(!part.stairs||part.stairs.spiral)throw new Error('Choose straight stairs.');
  const start=patch.start??stairEndpoints(part).start,run=patch.run??part.depth,direction=patch.direction??part.stairs.direction,a=direction*Math.PI/180;
  return checked({...part,width:patch.width??part.width,depth:run,elevation:patch.elevation??part.elevation,thickness:patch.thickness??part.thickness,center:[start[0]+Math.cos(a)*run/2,start[1]+Math.sin(a)*run/2],stairs:{...part.stairs,rise:patch.rise??part.stairs.rise,steps:patch.steps??part.stairs.steps,direction}});
}
export function createStairs(parentId:string,start:PlanPoint,aim:PlanPoint,dimensions:typeof DEFAULT_STAIRS,elevation=0,snapping=false,id:string=crypto.randomUUID()):Slab{
  const dx=aim[0]-start[0],dz=aim[1]-start[1];if(![...start,...aim].every(Number.isFinite)||Math.hypot(dx,dz)<.2)throw new Error('Choose an uphill direction away from the lower start.');
  const angle=Math.atan2(dz,dx)*180/Math.PI,direction=snapping?Math.round(angle/15)*15:angle;
  const part:Slab={id,kind:'slab',parentId,name:'Straight stairs',visible:true,color:'#d0c7b4',center:[0,0],width:dimensions.width,depth:dimensions.run,thickness:.2,elevation,stairs:{rise:dimensions.rise,steps:dimensions.steps,direction}};
  return updateStairs(part,{start,direction});
}
export type StairDragMode='move'|'run'|'width'|'height'|'radius';
export function dragStairs(part:Slab,mode:StairDragMode,delta:PlanPoint,snapping:boolean):Slab{
  if(!part.stairs||!delta.every(Number.isFinite))throw new Error('Keep the pointer on the stair editing plane.');
  if(part.stairs.connections?.top&&['move','run','height'].includes(mode)||part.stairs.connections?.bottom&&mode==='move')throw new Error('Use Attach bottom or Attach top to move the connection, or detach it first.');
  const snap=(v:number)=>Number((snapping?Math.round(v*4)/4:v).toFixed(10));
  if(part.stairs.spiral){
    if(mode==='move')return updateSpiralStairs(part,{center:[part.center[0]+snap(delta[0]),part.center[1]+snap(delta[1])]});
    if(mode==='height')return updateSpiralStairs(part,{rise:snap(part.stairs.rise+delta[0])});
    if(mode==='radius')return updateSpiralStairs(part,{radius:snap(Math.hypot(part.stairs.spiral.radius+delta[0],delta[1]))});
    if(mode==='width')return updateSpiralStairs(part,{width:snap(part.width-delta[1])});
    throw new Error('Use Radius, Width and Rise to edit spiral stairs.');
  }
  if(mode==='radius')throw new Error('Choose spiral stairs for the Radius handle.');
  if(mode==='move'){const {start}=stairEndpoints(part);return updateStairs(part,{start:[start[0]+snap(delta[0]),start[1]+snap(delta[1])]});}
  if(mode==='height')return updateStairs(part,{rise:snap(part.stairs.rise+delta[0])});
  if(mode==='width'){const {across}=stairAxes(part);return updateStairs(part,{width:snap(part.width+2*(delta[0]*across[0]+delta[1]*across[1]))});}
  const {start,end}=stairEndpoints(part),dx=end[0]+snap(delta[0])-start[0],dz=end[1]+snap(delta[1])-start[1];return updateStairs(part,{run:Math.hypot(dx,dz),direction:Math.atan2(dz,dx)*180/Math.PI});
}
