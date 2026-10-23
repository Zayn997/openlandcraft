import type {Wall} from './model';
import {isCircularWall} from './curved-walls';
import {pathLength} from './wall-path';

export const DEFAULT_BATTLEMENTS={width:1,height:1,spacing:1};
export const MAX_BATTLEMENTS=512;
export type BattlementLayout={count:number;gap:number;spans:[number,number][]};
/** Width and spacing are centerline distances. Rings absorb the remainder into equal gaps. */
export function battlementLayout(wall:Wall):BattlementLayout{
  const b=wall.battlements;if(!b)return {count:0,gap:0,spans:[]};
  const length=pathLength(wall),circle=isCircularWall(wall),pitch=b.width+b.spacing;
  if(![length,b.width,b.height,b.spacing,pitch].every(Number.isFinite)||b.width<=0||b.spacing<=0)return {count:0,gap:0,spans:[]};
  const count=Math.floor((length+(circle?0:b.spacing)+1e-9)/pitch);
  // Invalid patterns are rejected before generating an unbounded number of solids.
  if(count<1||count>MAX_BATTLEMENTS)return {count,gap:b.spacing,spans:[]};
  const gap=circle?length/count-b.width:b.spacing;
  const start=circle?gap/2:(length-(count*b.width+(count-1)*gap))/2;
  return {count,gap,spans:Array.from({length:count},(_,i)=>[start+i*(b.width+gap),start+i*(b.width+gap)+b.width])};
}
export function battlementIssue(wall:Wall):string|null{
  if(!wall.battlements)return null;
  const b=wall.battlements;
  if(![b.width,b.height,b.spacing].every(Number.isFinite)||b.width<.1||b.width>5||b.height<.1||b.height>5||b.spacing<.1||b.spacing>10)return 'Use battlement width and height of 0.1–5 m and spacing of 0.1–10 m.';
  const {count}=battlementLayout(wall);
  if(count<1)return 'The wall is too short for this battlement width and spacing. Reduce the width or spacing first.';
  if(count>MAX_BATTLEMENTS)return `Keep at most ${MAX_BATTLEMENTS} battlements per wall. Increase the width or spacing first.`;
  return null;
}
