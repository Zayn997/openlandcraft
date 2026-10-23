import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {applyCommand,connectStairBottom,connectStairFloor,copySelection,createSite,createStairs,createSpiralStairs,createCurvedWall,spiralStairsForTower,detachStairEnd,duplicateAbove,Editor,levelToWorld,parseProject,pasteSelection,stairEndpoints,stairFloorTargets,updateSpiralStairs,updateStairs,worldToLevel,type Entity,type Level,type Project,type Slab} from './index';
const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[0,0,0],rotation:0,storeyHeight:10};
const floor=(id='upper'):Slab=>({id,kind:'slab',parentId:'level',name:id,visible:true,color:'#998877',center:id==='lower'?[-7,0]:[1,0],width:id==='lower'?6:14,depth:10,elevation:id==='lower'?1.75:7.7,thickness:id==='lower'?.25:.3});
const flight=()=>{const p=createStairs('level',[-6,0],[6,0],{width:1.5,rise:6,run:10,steps:30},2,false,'stairs');return {...p,stairs:{...p.stairs!,railings:{height:1.1,spacing:1.5,side:'both' as const}}};};
const scene=(...entities:Entity[])=>parseProject({...createSite({name:'Floor connections',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...entities]});
const stairs=(p:Project)=>p.entities.find((e):e is Slab=>e.kind==='slab'&&!!e.stairs)!,slab=(p:Project,id='upper')=>p.entities.find((e):e is Slab=>e.kind==='slab'&&e.id===id)!;
const replace=(p:Project,e:Entity)=>applyCommand(p,{type:'replace',entity:e});
const linked=()=>{let p=scene(floor(),floor('lower'),flight());p=replace(p,connectStairFloor(p,stairs(p),slab(p),'top',[6,0]));return replace(p,connectStairFloor(p,stairs(p),slab(p,'lower'),'bottom',[-6,0]));};
describe('editable stair-to-floor attachments',()=>{
 it('attaches both ends with owned landings and one automatic upper shaft, retaining all editable objects',()=>{
  const p=linked(),s=stairs(p);expect(p.entities).toHaveLength(4);expect(s.elevation).toBe(2);expect(s.stairs!.rise).toBe(6);expect(s.stairs!.landings!.top!.elevation).toBe(8);expect(s.stairs!.landings!.bottom!.elevation).toBe(2);expect(stairEndpoints(s).end[0]).toBeCloseTo(4.8);expect(slab(p).stairOpenings).toHaveLength(1);expect(slab(p).stairOpenings![0].stairId).toBe(s.id);expect(slab(p,'lower').stairOpenings).toBeUndefined();expect(parseProject(p)).toEqual(p);expect(stairFloorTargets(p)).toHaveLength(2);
 });
 it('follows floor elevation, thickness and center while keeping the lower floor anchor fixed',()=>{
  let p=linked();p=replace(p,{...slab(p),elevation:9.7,center:[2,1],thickness:.5});const s=stairs(p);expect(s.elevation+s.stairs!.rise).toBeCloseTo(10.2);expect(stairEndpoints(s).start[0]).toBeCloseTo(-6);expect(stairEndpoints(s).start[1]).toBeCloseTo(0);expect(s.stairs!.landings!.top!.points).not.toEqual(stairs(linked()).stairs!.landings!.top!.points);
  const hole=slab(p).stairOpenings;p=replace(p,{...slab(p,'lower'),elevation:2.75});expect(stairs(p).elevation).toBeCloseTo(3);expect(stairs(p).elevation+stairs(p).stairs!.rise).toBeCloseTo(10.2);expect(slab(p).stairOpenings).not.toEqual(hole);expect(parseProject(p)).toEqual(p);
 });
 it('updates opening width and clear headroom through stair edits; detach/delete restores the floor',()=>{
  let p=linked(),before=slab(p).stairOpenings;p=replace(p,updateStairs(stairs(p),{width:2,steps:35}));expect(slab(p).stairOpenings).not.toEqual(before);expect(stairs(p).stairs!.landings!.top!.points).not.toEqual(stairs(linked()).stairs!.landings!.top!.points);
  p=replace(p,detachStairEnd(stairs(p),'top'));expect(slab(p).stairOpenings).toBeUndefined();expect(stairs(p).stairs!.landings!.top).toBeUndefined();expect(stairs(p).stairs!.connections!.bottom!.floorId).toBe('lower');
  const removed=applyCommand(linked(),{type:'remove',id:'stairs'});expect(slab(removed).stairOpenings).toBeUndefined();const noFloor=applyCommand(linked(),{type:'remove',id:'upper'});expect(stairs(noFloor).stairs!.connections!.top).toBeUndefined();expect(stairs(noFloor).stairs!.rise).toBe(6);
 });
 it('supports terrain-to-floor and rotated cross-level floor attachment',()=>{
  let p=scene(floor(),flight());p=replace(p,connectStairBottom(p,stairs(p)));p=replace(p,connectStairFloor(p,stairs(p),slab(p),'top',[6,0]));expect(stairs(p).elevation).toBeCloseTo(2.08);expect(stairs(p).stairs!.rise).toBeCloseTo(5.92);
  const upper:Level={...level,id:'upper-level',position:[3,1,-2],rotation:37},f={...floor(),parentId:upper.id,center:worldToLevel(upper,[1,0]),outline:[[-7,-5],[7,-5],[7,5],[-7,5]].map(q=>{const p=worldToLevel(upper,[q[0]+1,q[1]]);return [p[0]-worldToLevel(upper,[1,0])[0],p[1]-worldToLevel(upper,[1,0])[1]] as [number,number];})};
  p=scene(upper,f,flight());p=replace(p,connectStairFloor(p,stairs(p),slab(p),'top',[6,0]));expect(stairs(p).elevation+stairs(p).stairs!.rise).toBeCloseTo(9);p=replace(p,{...upper,position:[3,2,-2]});expect(stairs(p).elevation+stairs(p).stairs!.rise).toBeCloseTo(10);expect(parseProject(p)).toEqual(p);
 });
 it('uses the existing preview, cancel and atomic undo/redo workflow',()=>{
  const editor=new Editor(linked()),before=editor.getSnapshot().project,command={type:'replace' as const,entity:{...slab(before),elevation:8.7}};editor.begin('Floor height');editor.preview(command);expect(stairs(editor.getSnapshot().preview!).stairs!.rise).toBeCloseTo(7);editor.cancel();expect(editor.getSnapshot().project).toBe(before);editor.execute(command,'Floor height');expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(stairs(editor.getSnapshot().project).stairs!.rise).toBeCloseTo(7);
 });
 it('retains constraints and editable spiral geometry in both windings when radius, width and floor height change',()=>{
  for(const clockwise of [false,true]){const f={...floor(),center:[0,0] as [number,number],width:14,depth:14},s=createSpiralStairs('level',[0,0],[3,0],{radius:3,width:1.3,rise:6,steps:40,turns:1,clockwise},2,false,'stairs');let p=scene(f,s);p=replace(p,connectStairFloor(p,stairs(p),slab(p),'top',[3,0]));const cut=slab(p).stairOpenings;p=replace(p,updateSpiralStairs(stairs(p),{radius:3.5,width:1.5}));expect(slab(p).stairOpenings).not.toEqual(cut);expect(stairs(p).stairs!.landings!.top!.points.length).toBeGreaterThan(8);p=replace(p,{...slab(p),elevation:8.7});expect(stairs(p).elevation+stairs(p).stairs!.rise).toBeCloseTo(9);expect(parseProject(p)).toEqual(p);}
 });
 it('keeps a tower-fitted spiral centered when both floor attachments follow radius, width and elevation edits',()=>{
  const tower=createCurvedWall('level','circle',[[0,0],[6,0]],.6,12,false,0,'tower'),upper={...floor(),center:[0,0] as [number,number],width:12,depth:12},lower={...floor('lower'),center:[0,0] as [number,number],width:12,depth:12};
  const s=spiralStairsForTower(tower,{radius:3,width:1.3,rise:6,steps:40,turns:1,clockwise:false},0,'stairs');let p=scene(tower,upper,lower,s);
  p=replace(p,connectStairFloor(p,stairs(p),slab(p),'top',[3,0]));p=replace(p,connectStairFloor(p,stairs(p),slab(p,'lower'),'bottom'));
  const editor=new Editor(p);editor.execute({type:'replace',entity:updateSpiralStairs(stairs(p),{radius:3.5,width:1.5})},'Resize fitted spiral');p=editor.getSnapshot().project;
  expect(stairs(p).center).toEqual([0,0]);expect(stairs(p).stairs!.connections!.bottom!.point[0]).toBeCloseTo(2.75);expect(stairs(p).stairs!.landings!.bottom!.elevation).toBe(2);expect(parseProject(p)).toEqual(p);
  p=replace(p,{...slab(p,'lower'),elevation:2.25});p=replace(p,{...slab(p),elevation:8.7});expect(stairs(p).elevation).toBe(2.5);expect(stairs(p).stairs!.rise).toBeCloseTo(6.5);expect(stairs(p).center).toEqual([0,0]);expect(parseProject(p)).toEqual(p);
  editor.undo();expect(stairs(editor.getSnapshot().project).stairs!.spiral!.radius).toBe(3);editor.redo();expect(stairs(editor.getSnapshot().project).center).toEqual([0,0]);
 });
 it('rejects invalid entrances, overlap, missing/self hosts, locked dependencies and forged cuts without partial edits',()=>{
  const p=linked(),editor=new Editor(p),before=editor.getSnapshot();expect(()=>editor.execute({type:'replace',entity:{...slab(p),width:.5}},'Too narrow')).toThrow('landing');expect(editor.getSnapshot()).toBe(before);expect(()=>replace(p,connectStairFloor(p,stairs(p),stairs(p),'top',[0,0]))).toThrow('ordinary');
  const duplicate={...stairs(p),id:'other'};expect(()=>applyCommand(p,{type:'add',entity:duplicate})).toThrow('Separate');const bad=structuredClone(p);slab(bad).stairOpenings![0].points[0][0]+=1;expect(()=>parseProject(bad)).toThrow('match');const unknown=structuredClone(p);stairs(unknown).stairs!.connections!.top!.floorId='missing';expect(()=>parseProject(unknown)).toThrow('floor');
  const locked=structuredClone(p);locked.layers.push({id:'locked',name:'Upper floor',parentId:null,visible:true,locked:true,color:'#998877'});locked.objectLayers.upper='locked';expect(()=>replace(locked,updateStairs(stairs(locked),{width:2}))).toThrow('Unlock');
 });
 it('remaps complete copies, detaches standalone copies, and retains local/portable data through format 28 migration',async()=>{
  const p=linked(),copy=applyCommand(p,pasteSelection(p,copySelection(p,'level'),null,'copy').command),copied=copy.entities.find((e):e is Slab=>e.kind==='slab'&&!!e.stairs&&e.id!=='stairs')!;expect(copied.stairs!.connections!.top!.floorId).not.toBe('upper');expect(copied.stairs!.connections!.bottom!.floorId).not.toBe('lower');expect(parseProject(copy)).toEqual(copy);
  const alone=applyCommand(p,pasteSelection(p,copySelection(p,'stairs'),'level','one').command),single=alone.entities.find((e):e is Slab=>e.kind==='slab'&&!!e.stairs&&e.id!=='stairs')!;expect(single.stairs!.connections).toBeUndefined();const above=duplicateAbove(p,'level',12,'above').project;expect(parseProject(above)).toEqual(above);
  const old={...scene(floor(),flight()),version:28},snapshot=structuredClone(old);expect(parseProject(old).version).toBe(31);expect(old).toEqual(snapshot);expect(()=>parseProject({...p,version:28})).toThrow();expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);
 });
});
