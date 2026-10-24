import type {Slab} from './model';
import type {PlanPoint} from './architecture';
export function circularFloorIssue(floor:Slab):string|null{
 if(!floor.disk)return null;
 const radius=floor.disk.radius;
 if(floor.stairs||floor.outline)return 'A circular floor uses a radius rather than stairs or polygon corners.';
 if(Math.abs(floor.width-2*radius)>1e-6||Math.abs(floor.depth-2*radius)>1e-6)return 'Circular floor width and depth must follow its radius.';
 if(floor.center.some(v=>Math.abs(v)+radius>100))return 'Keep the circular floor within ±100 m of its level origin.';
 return null;
}
export function updateCircularFloor(floor:Slab,patch:Partial<Pick<Slab,'center'|'elevation'|'thickness'>> & {radius?:number}):Slab{
 if(!floor.disk)throw new Error('Choose a circular floor.');
 const {radius=floor.disk.radius,...rest}=patch;
 if(!Number.isFinite(radius)||radius<.25||radius>50)throw new Error('Use a circular floor radius of 0.25–50 m.');
 const next={...floor,...rest,disk:{radius},width:2*radius,depth:2*radius},issue=circularFloorIssue(next);if(issue)throw new Error(issue);return next;
}
export function dragCircularFloor(floor:Slab,mode:'move'|'radius',delta:PlanPoint,snapping:boolean):Slab{
 const snap=(n:number)=>Number((snapping?Math.round(n*4)/4:n).toFixed(10));
 return updateCircularFloor(floor,mode==='move'?{center:[snap(floor.center[0]+delta[0]),snap(floor.center[1]+delta[1])]}:{radius:snap(Math.hypot(floor.disk!.radius+delta[0],delta[1]))});
}
