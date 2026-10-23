import type {Wall} from './model';
import {curvedWallPoints} from './curved-walls';
import {pathLength,wallPathPoint,wallTangent,pathParameter} from './wall-path';
import type {PlanPoint} from './architecture';

export function defaultWallWalk(wall:Wall):NonNullable<Wall['walk']>{
  return {width:2,thickness:.25,parapetHeight:1.1,parapetThickness:Math.min(.3,wall.thickness),side:'left'};
}
/** Inward is geometric for curves, and chosen relative to start → end on straight walls. */
export const wallWalkSide=(wall:Wall)=>wall.curve?Math.sign(wall.curve.sweepAngle):wall.walk?.side==='right'?-1:1;
export function wallWalkProfile(wall:Wall){
  const w=wall.walk!;
  const outer=-wall.thickness/2,parapetInner=outer+w.parapetThickness,inner=parapetInner+w.width;
  const deckTop=wall.height-w.parapetHeight,bottom=deckTop-w.thickness;
  return {outer,parapetInner,inner,deckTop,bottom,side:wallWalkSide(wall)};
}
/** Boundary extrema also support rotated-level framing without flattening a tower to its seam. */
export function wallWalkPlanPoints(wall:Wall,rotation=0):PlanPoint[]{
  if(!wall.walk)return [];
  const {outer,inner,side}=wallWalkProfile(wall);
  if(wall.curve)return [outer,inner].flatMap(offset=>curvedWallPoints({...wall,curve:{...wall.curve!,radius:wall.curve!.radius-offset}},rotation));
  return [outer,inner].flatMap(offset=>[wallPathPoint(wall,0,side*offset),wallPathPoint(wall,1,side*offset)]);
}
export function wallWalkContains(wall:Wall,p:PlanPoint,margin=0):boolean{
  if(!wall.walk)return false;
  const {outer,inner,side}=wallWalkProfile(wall),length=pathLength(wall);
  if(wall.curve){
    const c=wall.curve,r=Math.hypot(p[0]-c.center[0],p[1]-c.center[1]);
    if(r<c.radius-inner-margin||r>c.radius-outer+margin)return false;
    if(Math.abs(c.sweepAngle)===360||pathParameter(p,wall)<=1)return true;
    // Conservative end clearance for open arcs.
    return [0,1].some(t=>[outer,inner].some(d=>{const q=wallPathPoint(wall,t,side*d);return Math.hypot(p[0]-q[0],p[1]-q[1])<=margin;}));
  }
  const d=wallTangent(wall,0),dx=p[0]-wall.start[0],dz=p[1]-wall.start[1],along=dx*d[0]+dz*d[1],lateral=(-dx*d[1]+dz*d[0])*side;
  return along>=-margin&&along<=length+margin&&lateral>=outer-margin&&lateral<=inner+margin;
}
export function wallWalkIssue(wall:Wall):string|null{
  const w=wall.walk;if(!w)return null;
  if(![w.width,w.thickness,w.parapetHeight,w.parapetThickness].every(Number.isFinite)||w.width<.5||w.width>8||w.thickness<.1||w.thickness>1||w.parapetHeight<.3||w.parapetHeight>3||w.parapetThickness<.05||w.parapetThickness>2||!['left','right'].includes(w.side))return 'Use walk width 0.5–8 m, deck thickness 0.1–1 m, parapet height 0.3–3 m and parapet thickness 0.05–2 m.';
  if(w.parapetThickness>wall.thickness+1e-8)return 'Keep parapet thickness within the supporting wall thickness.';
  if(w.width+w.parapetThickness<wall.thickness-1e-8)return 'Increase walk width so the deck covers the supporting wall and extends behind the parapet.';
  const profile=wallWalkProfile(wall);
  if(profile.bottom<.2-1e-8)return 'The wall is too low for this parapet height and deck thickness. Keep at least 0.2 m of wall below the deck.';
  if(wall.curve&&wall.curve.radius-profile.inner<=.1)return 'Keep at least 0.1 m of open radius inside the tower walk. Reduce walk width or increase wall radius.';
  if(wallWalkPlanPoints(wall).some(p=>p.some(v=>Math.abs(v)>100+1e-6)))return 'Keep the whole wall walk within ±100 m of the level origin.';
  if(wall.openings?.some(o=>o.sill+o.height>profile.bottom-.1+1e-6))return 'Keep doors and windows at least 0.1 m below the wall-walk deck. Move or resize the opening, or raise the wall first.';
  return null;
}
