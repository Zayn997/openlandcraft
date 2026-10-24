import { footprint, outlineIssue, type PlanPoint } from './architecture';
import { slabSchema, roofSchema, type Slab, type Roof } from './model';
import {conicalRoofIssue,dragConicalRoof} from './conical-roofs';
import {dragStairs} from './stairs';
import {circularFloorIssue,dragCircularFloor} from './circular-floors';
export type OutlinePart = Slab | Roof;
export type OutlineDragMode = 'move' | 'vertex' | 'edge' | 'radius' | 'height' | 'overhang' | 'run' | 'width';
const round = (n: number) => Number(n.toFixed(10));
function checked<T extends OutlinePart>(part: T): T {
  if(part.kind==='slab'&&part.disk){const issue=circularFloorIssue(part);if(issue)throw new Error(issue);if(!slabSchema.safeParse(part).success)throw new Error('Keep circular floor dimensions within their supported limits.');return part;}
  if (!(part.kind === 'slab' ? slabSchema : roofSchema).safeParse(part).success) throw new Error('Keep dimensions and outline coordinates within their supported limits.');
  if(part.kind==='roof'&&part.cone){const issue=conicalRoofIssue(part);if(issue)throw new Error(issue);return part;}
  const issue = outlineIssue(footprint(part)); if (issue) throw new Error(issue);
  return part;
}
function indexOf(points: PlanPoint[], index: number) { if (!Number.isInteger(index) || index < 0 || index >= points.length) throw new Error('Select an existing corner or edge.'); }
export function withOutline(part: OutlinePart, points: PlanPoint[]): OutlinePart {
  if(part.kind==='slab'&&part.disk)throw new Error('Use radius to edit a circular floor.');
  if(part.kind==='slab'&&part.stairs)throw new Error('Use width, total rise and total run to edit straight stairs.');
  if(part.kind==='roof'&&part.cone)throw new Error('Use radius, height and overhang to edit a conical roof.');
  if (part.kind === 'roof' && !part.outline) throw new Error('Convert the gable to a flat outline before adding custom corners.');
  return checked({ ...part, outline: points.map(p => [round(p[0]-part.center[0]), round(p[1]-part.center[1])] as PlanPoint) });
}
/** All deltas are in level coordinates from the original grab. */
export function dragOutline(part: OutlinePart, mode: OutlineDragMode, index: number, delta: PlanPoint, snapping: boolean): OutlinePart {
  if (!delta.every(Number.isFinite)) throw new Error('Keep the pointer on the outline editing plane.');
  if(part.kind==='slab'&&part.disk){if(mode!=='move'&&mode!=='radius')throw new Error('Use Center or Radius to edit a circular floor.');return checked(dragCircularFloor(part,mode,delta,snapping));}
  if(part.kind==='slab'&&part.stairs){if(mode==='vertex'||mode==='edge'||mode==='overhang')throw new Error('Use the stair dimension handles.');return dragStairs(part,mode,delta,snapping);}
  if(part.kind==='roof'&&part.cone){if(mode==='vertex'||mode==='edge'||mode==='run'||mode==='width')throw new Error('Use the conical roof radius or overhang handle.');return dragConicalRoof(part,mode,delta,snapping);}
  if(mode==='run'||mode==='width')throw new Error('Choose straight stairs to use this handle.');
  if(mode==='radius'||mode==='height'||mode==='overhang')throw new Error('Choose a conical roof to use this handle.');
  const snap = (n: number) => round(snapping ? Math.round(n*4)/4 : n);
  if (mode === 'move') {
    const shift = delta.map(snap);
    if (!shift.some(Boolean)) return part;
    return checked({ ...part, center: [round(part.center[0]+shift[0]), round(part.center[1]+shift[1])] });
  }
  const points = footprint(part); indexOf(points,index);
  if (!delta.some(Boolean)) return part;
  const next = points.map(p=>[...p] as PlanPoint), other=(index+1)%points.length;
  if (part.kind === 'roof' && !part.outline) {
    let [left,top]=points[0], [right,bottom]=points[2];
    if (mode==='vertex') {
      const x=snap(points[index][0]+delta[0]), z=snap(points[index][1]+delta[1]);
      if(index===0||index===3)left=x;else right=x;
      if(index===0||index===1)top=z;else bottom=z;
    } else {
      if(index===0)top=snap(top+delta[1]); if(index===1)right=snap(right+delta[0]);
      if(index===2)bottom=snap(bottom+delta[1]); if(index===3)left=snap(left+delta[0]);
    }
    if(right-left<0.5||bottom-top<0.5)throw new Error('Keep the gable footprint at least 0.5 m wide and deep.');
    return checked({...part,center:[round((left+right)/2),round((top+bottom)/2)],width:round(right-left),depth:round(bottom-top)});
  }
  if(mode==='vertex') next[index]=[snap(points[index][0]+delta[0]),snap(points[index][1]+delta[1])];
  else {
    const dx=points[other][0]-points[index][0], dz=points[other][1]-points[index][1], length=Math.hypot(dx,dz);
    const normal:PlanPoint=[-dz/length,dx/length], distance=snap(delta[0]*normal[0]+delta[1]*normal[1]);
    for(const i of [index,other])next[i]=[round(points[i][0]+normal[0]*distance),round(points[i][1]+normal[1]*distance)];
  }
  if(JSON.stringify(points)===JSON.stringify(next))return part;
  return withOutline(part,next);
}
export function insertOutlineCorner(part: OutlinePart, edge: number): OutlinePart {
  const points=footprint(part);indexOf(points,edge);
  if(points.length>=16)throw new Error('An outline supports at most 16 corners.');
  const a=points[edge],b=points[(edge+1)%points.length];
  points.splice(edge+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);return withOutline(part,points);
}
export function removeOutlineCorner(part: OutlinePart, vertex: number): OutlinePart {
  const points=footprint(part);indexOf(points,vertex);
  if(points.length<=3)throw new Error('Keep at least three corners.');
  return withOutline(part,points.filter((_,i)=>i!==vertex));
}
export function flatRoofOutline(part: Roof): Roof {
  if(part.cone)throw new Error('Use radius, height and overhang to edit a conical roof.');
  if(part.outline)return part;
  return checked({...part,rise:0.2,outline:footprint({...part,center:[0,0]})});
}
