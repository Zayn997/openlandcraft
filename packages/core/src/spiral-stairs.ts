import {slabSchema,type Entity,type Slab,type Wall} from './model';
import type {PlanPoint} from './architecture';
import {isCircularWall} from './curved-walls';
import {wallWalkProfile} from './wall-walks';
import {stairsIssue} from './stairs';

export type StairShape='straight'|'spiral';
export const DEFAULT_SPIRAL={radius:2,turns:1,clockwise:false};
export type SpiralDimensions={radius:number;turns:number;clockwise:boolean;width:number;rise:number;steps:number};
export type StairDrawingDimensions=SpiralDimensions&{run:number};
export const spiralSweep=(part:Slab)=>part.stairs!.spiral!.turns*Math.PI*2*(part.stairs!.spiral!.clockwise?-1:1);
export function spiralPoint(part:Slab,t:number,radius=part.stairs!.spiral!.radius-part.width/2):PlanPoint{
  const angle=part.stairs!.direction*Math.PI/180+spiralSweep(part)*t;return [part.center[0]+radius*Math.cos(angle),part.center[1]+radius*Math.sin(angle)];
}
export const spiralRun=(part:Slab)=>(part.stairs!.spiral!.radius-part.width/2)*Math.abs(spiralSweep(part));
export const spiralTowerClearRadius=(tower:Wall)=>Math.min(tower.curve!.radius-tower.thickness/2-.1,tower.walk?tower.curve!.radius-wallWalkProfile(tower).inner-.05:Infinity);
export function spiralIssue(part:Slab,entities?:Entity[]):string|null{
  const stair=part.stairs,spiral=stair?.spiral;if(!stair||!spiral)return null;
  const {radius,turns}=spiral;
  if(!Number.isFinite(radius)||radius<.75||radius>20||!Number.isFinite(turns)||turns<.25||turns>4)return 'Use spiral outer radius 0.75–20 m and 0.25–4 turns.';
  if(part.width<.5||part.width>8||radius-part.width<.15-1e-8)return 'Keep stair width 0.5–8 m and at least 0.15 m of open inner radius.';
  if(Math.abs(part.depth-radius*2)>1e-8)return 'Spiral footprint depth must follow twice its outer radius.';
  if(part.center.some(v=>!Number.isFinite(v)||Math.abs(v)+radius>100+1e-8))return 'Keep the whole spiral within ±100 m of the level origin.';
  if(stair.steps<Math.ceil(turns*8-1e-8)||spiralRun(part)/stair.steps<.05-1e-8)return 'Use at least eight steps per turn and at least 0.05 m of tread at the walking line.';
  if(turns>1&&stair.rise/turns-stair.rise/stair.steps-part.thickness<Math.max(1.8,(stair.railings?.height??0)+.04)-1e-8)return 'Increase stair height or reduce turns to keep headroom and railings clear below the next turn.';
  if(spiral.towerId&&entities){
    const tower=entities.find((e):e is Wall=>e.kind==='wall'&&e.id===spiral.towerId);
    if(!tower||!isCircularWall(tower)||tower.parentId!==part.parentId)return 'Choose an existing circular tower on the same level, or detach the stairs.';
    const offset=Math.hypot(part.center[0]-tower.curve!.center[0],part.center[1]-tower.curve!.center[1]);
    if(offset+radius>tower.curve!.radius-tower.thickness/2-.1+1e-8)return 'The spiral must fit inside the tower with 0.1 m wall clearance. Reduce stair radius or move its center inward.';
    if(offset+radius>spiralTowerClearRadius(tower)+1e-8)return 'Keep the spiral inside the tower walk’s central well with 0.05 m deck clearance. Reduce radius or move its center inward.';
    if(part.elevation<tower.elevation-1e-8||part.elevation+stair.rise+(stair.connections?.top?0:stair.railings?.height??0)>tower.elevation+tower.height+1e-8)return 'Keep the stairs and railings between the tower base and wall top. Reduce height or raise the tower.';
  }
  return null;
}
export function updateSpiralStairs(part:Slab,patch:Partial<SpiralDimensions>&{center?:PlanPoint;direction?:number;elevation?:number;thickness?:number}):Slab{
  if(!part.stairs?.spiral)throw new Error('Choose spiral stairs.');
  const radius=patch.radius??part.stairs.spiral.radius;
  const next:Slab={...part,center:patch.center??part.center,width:patch.width??part.width,depth:radius*2,elevation:patch.elevation??part.elevation,thickness:patch.thickness??part.thickness,stairs:{...part.stairs,rise:patch.rise??part.stairs.rise,steps:patch.steps??part.stairs.steps,direction:patch.direction??part.stairs.direction,spiral:{...part.stairs.spiral,radius,turns:patch.turns??part.stairs.spiral.turns,clockwise:patch.clockwise??part.stairs.spiral.clockwise}}};
  const issue=stairsIssue(next);if(issue)throw new Error(issue);if(!slabSchema.safeParse(next).success)throw new Error('Keep spiral dimensions, height, step count and direction within their supported limits.');return next;
}
export function createSpiralStairs(parentId:string,center:PlanPoint,aim:PlanPoint,dimensions:SpiralDimensions,elevation=0,snapping=false,id:string=crypto.randomUUID()):Slab{
  if(![...center,...aim].every(Number.isFinite)||Math.hypot(aim[0]-center[0],aim[1]-center[1])<.2)throw new Error('Choose a start direction away from the spiral center.');
  const angle=Math.atan2(aim[1]-center[1],aim[0]-center[0])*180/Math.PI,direction=snapping?Math.round(angle/15)*15:angle;
  const part:Slab={id,kind:'slab',parentId,name:'Spiral stairs',visible:true,color:'#d0c7b4',center,width:dimensions.width,depth:dimensions.radius*2,elevation,thickness:.2,stairs:{rise:dimensions.rise,steps:dimensions.steps,direction,spiral:{radius:dimensions.radius,turns:dimensions.turns,clockwise:dimensions.clockwise}}};
  return updateSpiralStairs(part,{});
}
export function spiralTowerDimensions(tower:Wall){
  if(!isCircularWall(tower))throw new Error('Choose a circular tower.');
  const radius=Math.max(.75,Math.min(20,spiralTowerClearRadius(tower)));
  const rise=Math.max(.2,tower.height-(tower.walk?.parapetHeight??1.2));
  return {...DEFAULT_SPIRAL,radius,width:Math.max(.5,Math.min(1.5,radius-.15)),rise,steps:Math.min(128,Math.max(8,Math.ceil(rise/.2)))};
}
export function spiralStairsForTower(tower:Wall,dimensions:SpiralDimensions,direction=0,id:string=crypto.randomUUID()):Slab{
  if(!isCircularWall(tower))throw new Error('Choose a circular tower.');
  const c=tower.curve!.center,a=direction*Math.PI/180;
  const part=createSpiralStairs(tower.parentId,[...c],[c[0]+Math.cos(a),c[1]+Math.sin(a)],dimensions,tower.elevation,false,id);
  part.stairs!.spiral!.towerId=tower.id;const issue=spiralIssue(part,[tower]);if(issue)throw new Error(issue);return part;
}
export function remapSpiralTower(part:Slab,ids:Map<string,string>):Slab{
  if(!part.stairs?.spiral?.towerId)return part;
  const towerId=ids.get(part.stairs.spiral.towerId);return {...part,stairs:{...part.stairs,spiral:{...part.stairs.spiral,towerId}}};
}
/** Tower movement carries the fit; radius/height stay stair-owned and are checked atomically. */
export function followSpiralTowers(before:Entity[],after:Entity[]):Entity[]{
  return after.map(e=>{
    if(e.kind!=='slab'||!e.stairs?.spiral?.towerId)return e;
    const id=e.stairs.spiral.towerId,old=before.find((w):w is Wall=>w.kind==='wall'&&w.id===id),tower=after.find((w):w is Wall=>w.kind==='wall'&&w.id===id);
    if(!tower&&old)return remapSpiralTower(e,new Map());
    if(!old?.curve||!tower?.curve||old.parentId!==tower.parentId)return e;
    const dx=tower.curve.center[0]-old.curve.center[0],dz=tower.curve.center[1]-old.curve.center[1],dy=tower.elevation-old.elevation;
    return dx||dz||dy?{...e,center:[e.center[0]+dx,e.center[1]+dz],elevation:e.elevation+dy}:e;
  });
}
