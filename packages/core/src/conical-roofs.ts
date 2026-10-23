import {roofSchema,type Entity,type Roof,type Wall} from './model';
import type {PlanPoint} from './architecture';
import {isCircularWall} from './curved-walls';

export type RoofShape='flat'|'conical';
export const roofEavesRadius=(roof:Roof)=>roof.cone?roof.cone.radius+roof.cone.overhang:0;
export function conicalRoofIssue(roof:Roof,entities?:Entity[]):string|null{
  if(!roof.cone)return roof.width>100||roof.depth>100?'Keep rectangular roofs within 100 m width and depth.':null;
  const radius=roofEavesRadius(roof),diameter=radius*2;
  if(roof.outline)return 'A conical roof uses a circular radius, not an outline.';
  if(Math.abs(roof.width-diameter)>1e-6||Math.abs(roof.depth-diameter)>1e-6)return 'Conical roof width and depth must follow its radius and overhang.';
  if(radius>100||roof.center.some(v=>Math.abs(v)+radius>100+1e-6))return 'Keep the roof eaves within ±100 m of the level origin.';
  if(roof.cone.wallId&&entities){
    const wall=entities.find((e):e is Wall=>e.id===roof.cone!.wallId&&e.kind==='wall');
    if(!wall||!isCircularWall(wall)||wall.parentId!==roof.parentId)return 'A linked roof must follow an existing circular wall on the same level. Detach it before changing the tower shape or level.';
    if(!roofMatchesTower(roof,wall))return 'A linked roof must follow its tower radius, center and wall-top elevation.';
  }
  return null;
}
function checked(roof:Roof):Roof{
  const issue=conicalRoofIssue(roof);if(issue)throw new Error(issue);
  if(!roofSchema.safeParse(roof).success)throw new Error('Use a radius of 0.25–100 m, height of 0.1–15 m, overhang of 0–10 m and eaves elevation of −10–40 m.');
  return roof;
}
export function updateConicalRoof(roof:Roof,patch:Partial<Pick<Roof,'center'|'rise'|'elevation'>> & Partial<Pick<NonNullable<Roof['cone']>,'radius'|'overhang'>>):Roof{
  if(!roof.cone)throw new Error('Choose a conical roof.');
  if(roof.cone.wallId&&(patch.radius!==undefined&&Math.abs(patch.radius-roof.cone.radius)>1e-8||patch.center!==undefined&&patch.center.some((v,i)=>Math.abs(v-roof.center[i])>1e-8)||patch.elevation!==undefined&&Math.abs(patch.elevation-roof.elevation)>1e-8))throw new Error('Detach the roof from its tower before changing radius, center or eaves elevation. Roof height and overhang remain editable.');
  const {radius=roof.cone.radius,overhang=roof.cone.overhang,...profile}=patch,diameter=2*(radius+overhang);
  return checked({...roof,...profile,cone:{...roof.cone,radius,overhang},width:diameter,depth:diameter});
}
/** The radius is measured to the supporting wall's outer face; overhang extends beyond it. */
export function createConicalRoof(parentId:string,points:PlanPoint[],height:number,overhang:number,elevation:number,id:string=crypto.randomUUID()):Roof{
  if(points.length!==2||!points.flat().every(Number.isFinite))throw new Error('Click a center and a radius point for the conical roof.');
  const center:PlanPoint=[...points[0]],radius=Math.hypot(points[1][0]-center[0],points[1][1]-center[1]),diameter=2*(radius+overhang);
  return checked({id,parentId,kind:'roof',name:'Conical roof',visible:true,color:'#667869',center,rise:height,elevation,width:diameter,depth:diameter,cone:{radius,overhang}});
}
/** Fitted roofs follow the tower, retaining their own height and overhang. */
export function conicalRoofForTower(wall:Wall,height:number,overhang:number,id:string=crypto.randomUUID()):Roof{
  if(!isCircularWall(wall))throw new Error('Choose a circular wall on the drawing level.');
  const center=wall.curve!.center,radius=wall.curve!.radius+wall.thickness/2;
  return setConicalRoofTower(createConicalRoof(wall.parentId,[center,[center[0]+radius,center[1]]],height,overhang,wall.elevation+wall.height,id),wall);
}
function roofMatchesTower(roof:Roof,wall:Wall):boolean{
  return !!wall.curve&&Math.abs(roof.cone!.radius-wall.curve.radius-wall.thickness/2)<1e-8&&roof.center.every((v,i)=>Math.abs(v-wall.curve!.center[i])<1e-8)&&Math.abs(roof.elevation-wall.elevation-wall.height)<1e-8;
}
/** Attach explicitly, or detach while preserving the current geometry. */
export function setConicalRoofTower(roof:Roof,wall:Wall|null):Roof{
  if(!roof.cone)throw new Error('Choose a conical roof.');
  if(!wall){const {wallId,...cone}=roof.cone;return {...roof,cone};}
  if(!isCircularWall(wall)||wall.parentId!==roof.parentId)throw new Error('Choose a circular wall on the same level as the roof.');
  const radius=wall.curve!.radius+wall.thickness/2,diameter=2*(radius+roof.cone.overhang);
  return checked({...roof,center:[...wall.curve!.center],elevation:wall.elevation+wall.height,cone:{...roof.cone,wallId:wall.id,radius},width:diameter,depth:diameter});
}
export function remapRoofTower(roof:Roof,ids:Map<string,string>):Roof{
  if(!roof.cone?.wallId)return roof;
  const wallId=ids.get(roof.cone.wallId);return wallId?{...roof,cone:{...roof.cone,wallId}}:setConicalRoofTower(roof,null);
}
/** Run after joined walls resolve, before validation/locks, for preview and commit alike. */
export function followRoofTowers(before:Entity[],after:Entity[]):Entity[]{
  return after.map(entity=>{
    if(entity.kind!=='roof'||!entity.cone?.wallId)return entity;
    const host=after.find((e):e is Wall=>e.kind==='wall'&&e.id===entity.cone!.wallId);
    if(!host&&before.some(e=>e.kind==='wall'&&e.id===entity.cone!.wallId))return setConicalRoofTower(entity,null);
    if(!host||!isCircularWall(host)||host.parentId!==entity.parentId||roofMatchesTower(entity,host))return entity;
    return setConicalRoofTower(entity,host);
  });
}
export function snapRoofDrawingPoint(point:PlanPoint,points:PlanPoint[],snapping:boolean):PlanPoint{
  if(!snapping)return [...point];
  if(!points.length)return point.map(v=>Math.round(v*4)/4) as PlanPoint;
  const center=points[0],dx=point[0]-center[0],dz=point[1]-center[1],length=Math.hypot(dx,dz);if(length<1e-8)return [...point];
  const radius=Math.round(length*4)/4;return [center[0]+dx*radius/length,center[1]+dz*radius/length];
}
export type ConicalRoofDragMode='move'|'radius'|'height'|'overhang';
export function dragConicalRoof(roof:Roof,mode:ConicalRoofDragMode,delta:PlanPoint,snapping:boolean):Roof{
  if(!roof.cone||!delta.every(Number.isFinite))throw new Error('Keep the pointer on the roof editing plane.');
  if(roof.cone.wallId&&(mode==='move'||mode==='radius'))throw new Error('Move or resize the tower, or detach this roof first. Roof height and overhang remain editable.');
  const snap=(v:number)=>Number((snapping?Math.round(v*4)/4:v).toFixed(10));
  if(mode==='move')return updateConicalRoof(roof,{center:[snap(roof.center[0]+delta[0]),snap(roof.center[1]+delta[1])]});
  if(mode==='height')return updateConicalRoof(roof,{rise:snap(roof.rise+delta[0])});
  if(mode==='radius')return updateConicalRoof(roof,{radius:snap(Math.hypot(roof.cone.radius+delta[0],delta[1]))});
  return updateConicalRoof(roof,{overhang:snap(Math.hypot(delta[0],roofEavesRadius(roof)+delta[1])-roof.cone.radius)});
}
