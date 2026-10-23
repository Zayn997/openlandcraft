import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {applyCommand,connectStairBottom,connectStairTop,copySelection,createLake,createSite,createStairs,DEFAULT_STAIRS,defaultWallWalk,detachStairEnd,duplicateAbove,Editor,levelToWorld,parseProject,partBounds,pasteSelection,railingRuns,resolveStairConnections,spiralStairsForTower,stairEndpoints,stairWalkTargets,updateCurvedWall,updateSpiralStairs,wallAccessRanges,wallPathPoint,wallWalkProfile,worldToLevel,type Entity,type Level,type Project,type Slab,type Wall} from './index';
const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[4,0,-3],rotation:23,storeyHeight:8};
const wall=():Wall=>{const w:Wall={id:'wall',kind:'wall',parentId:'level',name:'Curtain',visible:true,color:'#998877',start:[-10,0],end:[10,0],height:8,thickness:.6,elevation:0};return {...w,walk:{...defaultWallWalk(w),railings:{height:1.1,spacing:1}},battlements:{width:1,height:1.2,spacing:1}};};
const tower=():Wall=>{const w=updateCurvedWall({...wall(),id:'tower',curve:{center:[0,0],radius:7,startAngle:0,sweepAngle:360}},{radius:7});return w;};
const flight=()=>{const s=createStairs('level',[0,-14],[0,0],{...DEFAULT_STAIRS,rise:6,run:12,steps:32},0,false,'stairs');return {...s,stairs:{...s.stairs!,railings:{height:1.1,spacing:1,side:'both' as const}}};};
const scene=(...entities:Entity[]):Project=>parseProject({...createSite({name:'Connections',width:90,depth:90,resolution:129,preset:'flat'}),entities:[level,...entities]});
const stair=(p:Project)=>p.entities.find((e):e is Slab=>e.kind==='slab')!;
const host=(p:Project)=>p.entities.find((e):e is Wall=>e.kind==='wall')!;
const set=(p:Project,s:Slab)=>applyCommand(p,{type:'replace',entity:s});
const bottom=(p:Project)=>set(p,connectStairBottom(p,stair(p)));
const top=(p:Project,edge:'inner'|'outer'='outer')=>{const w=host(p),profile=wallWalkProfile(w),q=wallPathPoint(w,.5,profile.side*(edge==='inner'?profile.inner:profile.outer));return set(p,connectStairTop(p,stair(p),w,levelToWorld(level,q)));};
describe('stair surface attachments',()=>{
 it('attaches a rotated straight flight to dry terrain and a walk, with one editable stair and matching outer access',()=>{
  const p=top(bottom(scene(wall(),flight()))),s=stair(p),w=host(p),a=s.stairs!;
  expect(p.entities).toHaveLength(3);expect(a.connections?.bottom).toBeDefined();expect(a.connections?.top?.edge).toBe('outer');expect(s.elevation).toBeCloseTo(p.site.terrain.heights[0]+.08);expect(s.elevation+a.rise).toBeCloseTo(w.elevation+wallWalkProfile(w).deckTop);
  expect(a.landings?.top?.points).toHaveLength(4);expect(a.landings?.bottom?.base).toBeLessThan(s.elevation);expect(w.walk?.stairOpenings?.[0].stairId).toBe(s.id);expect(wallAccessRanges(w,'outer')).toHaveLength(1);expect(wallAccessRanges(w,'inner')).toHaveLength(0);expect(railingRuns(s)).toHaveLength(6);expect(parseProject(p)).toEqual(p);expect(resolveStairConnections(p,p)).toEqual(p);
 });
 it('follows terrain and walk height/length changes in previews, cancellation, undo and redo',()=>{
  const p=top(bottom(scene(wall(),flight()))),editor=new Editor(p),field={...p.site.terrain,heights:p.site.terrain.heights.map(h=>h+1)};
  editor.begin('Ground');editor.preview({type:'terrain',field});expect(stair(editor.getSnapshot().preview!).elevation).toBeCloseTo(stair(p).elevation+1);editor.cancel();expect(editor.getSnapshot().project).toEqual(p);
  editor.execute({type:'terrain',field},'Ground');const raised=editor.getSnapshot().project;expect(stair(raised).elevation+stair(raised).stairs!.rise).toBeCloseTo(stair(p).elevation+stair(p).stairs!.rise);editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();expect(editor.getSnapshot().project).toEqual(raised);
  const w=host(raised);editor.execute({type:'replace',entity:{...w,height:10,end:[14,0]}},'Walk');const s=stair(editor.getSnapshot().project);expect(s.stairs!.landings!.top!.elevation).toBeCloseTo(8.9);expect(stairEndpoints(s).start[0]).toBeCloseTo(0);expect(stairEndpoints(s).end[0]).toBeCloseTo(2);expect(parseProject(editor.getSnapshot().project)).toEqual(editor.getSnapshot().project);
 });
 it('restores generated openings on detach/delete, preserves manual gaps, and detaches when the host is deleted',()=>{
  const w=wall();w.walk!.railings!.gap={position:.1,width:1};let p=top(bottom(scene(w,flight())));
  p=set(p,detachStairEnd(stair(p),'top'));expect(host(p).walk!.stairOpenings).toBeUndefined();expect(stair(p).stairs!.landings!.top).toBeUndefined();expect(host(p).walk!.railings!.gap).toEqual(w.walk!.railings!.gap);
  p=top(p);const gone=applyCommand(p,{type:'remove',id:'stairs'});expect(host(gone).walk!.stairOpenings).toBeUndefined();
  const noHost=applyCommand(p,{type:'remove',id:'wall'});expect(stair(noHost).stairs!.connections!.top).toBeUndefined();expect(stair(noHost).stairs!.landings!.bottom).toBeDefined();
 });
 it('rejects invalid approaches, end entrances, wet ground, incompatible walk removal and locked dependent edits atomically',()=>{
  let p=top(bottom(scene(wall(),flight()))),editor=new Editor(p),before=editor.getSnapshot();
  expect(()=>editor.execute({type:'replace',entity:{...host(p),walk:undefined}},'Remove walk')).toThrow('Detach');expect(editor.getSnapshot()).toBe(before);
  expect(()=>set(p,connectStairTop(p,stair(p),host(p),levelToWorld(level,[-10,-.3])))).toThrow();
  expect(()=>set(p,{...stair(p),stairs:{...stair(p).stairs!,rise:7}})).toThrow('detach');
  const wet=scene(wall(),flight());wet.entities.push(createLake(wet,[[-20,-30],[20,-30],[20,10],[-20,10]]));parseProject(wet);expect(()=>bottom(wet)).toThrow('dry ground');
  const hidden=structuredClone(p);hidden.entities.find(e=>e.kind==='level')!.visible=false;expect(stairWalkTargets(hidden)).toHaveLength(0);
  const locked=structuredClone(p);locked.layers.push({id:'stairs-layer',name:'Stairs',parentId:null,color:'#999999',visible:true,locked:true});locked.objectLayers.stairs='stairs-layer';expect(()=>applyCommand(locked,{type:'replace',entity:{...host(locked),height:9}})).toThrow('Unlock');expect(()=>applyCommand(locked,{type:'terrain',field:{...p.site.terrain,heights:p.site.terrain.heights.map(h=>h+1)}})).toThrow('Unlock');
 });
 it('copies linked scopes with remapped targets and detaches an independently pasted stair',()=>{
  const p=top(bottom(scene(wall(),flight()))),copied=applyCommand(p,pasteSelection(p,copySelection(p,'level'),null,'copy').command),stairs=copied.entities.filter((e):e is Slab=>e.kind==='slab');expect(stairs).toHaveLength(2);expect(stairs[1].stairs!.connections!.top!.wallId).not.toBe('wall');expect(parseProject(copied)).toEqual(copied);
  const independent=applyCommand(p,pasteSelection(p,copySelection(p,'stairs'),'level','one').command);expect(independent.entities.filter((e):e is Slab=>e.kind==='slab')[1].stairs!.connections?.top).toBeUndefined();
 });
 it('fits spiral landings inside the tower and keeps rails, access and heights linked through radius, width and wall edits',()=>{
  const w=tower(),s=spiralStairsForTower(w,{width:1.3,rise:5,steps:36,radius:3,turns:1,clockwise:false},0,'stairs');s.stairs!.railings={height:1.1,spacing:1,side:'both'};
  expect(stairWalkTargets(scene(w,wall(),s),'stairs').map(w=>w.id)).toEqual(['tower']);
  let p=bottom(top(scene(w,s),'inner'));const before=stair(p);expect(before.stairs!.landings!.top!.points.length).toBeGreaterThan(8);expect(before.stairs!.connections!.top!.edge).toBe('inner');expect(wallAccessRanges(host(p),'inner')).toHaveLength(1);expect(railingRuns(before)).toHaveLength(6);const landingRails=railingRuns(before).slice(2);for(const run of landingRails){expect(run.posts.length).toBeLessThan(12);for(let i=1;i<run.posts.length;i++)expect(Math.hypot(run.posts[i].base[0]-run.posts[i-1].base[0],run.posts[i].base[2]-run.posts[i-1].base[2])).toBeLessThanOrEqual(1.00001);}
  p=set(p,updateSpiralStairs(before,{radius:before.stairs!.spiral!.radius-.2,width:1.5}));expect(host(p).walk!.stairOpenings![0].width).not.toBe(host(bottom(top(scene(w,s),'inner'))).walk!.stairOpenings![0].width);
  p=applyCommand(p,{type:'replace',entity:{...updateCurvedWall(host(p),{radius:8,center:[1,0]}),height:9}});expect(stair(p).center).toEqual([1,0]);expect(stair(p).elevation+stair(p).stairs!.rise).toBeCloseTo(7.9);expect(parseProject(p)).toEqual(p);
 });
 it('follows a wall walk on another rotated level without moving the ground anchor',()=>{
  const other:Level={...level,id:'upper',position:[-5,1,7],rotation:-55},w=wall(),original=scene(w,flight());
  const hostWall={...w,parentId:other.id,start:worldToLevel(other,levelToWorld(level,w.start)),end:worldToLevel(other,levelToWorld(level,w.end))};
  let p=parseProject({...original,entities:[level,other,hostWall,flight()]});p=bottom(p);p=set(p,connectStairTop(p,stair(p),hostWall,levelToWorld(level,[0,-.3])));
  const start=stairEndpoints(stair(p)).start,oldY=stair(p).stairs!.landings!.top!.elevation;
  p=applyCommand(p,{type:'replace',entity:{...other,position:[-5,2,7]}});expect(stairEndpoints(stair(p)).start[0]).toBeCloseTo(start[0]);expect(stairEndpoints(stair(p)).start[1]).toBeCloseTo(start[1]);expect(stair(p).stairs!.landings!.top!.elevation).toBeCloseTo(oldY+1);expect(parseProject(p)).toEqual(p);
 });
 it('duplicates a connected storey with remapped walk access and independent ground elevation',()=>{
  const p=top(bottom(scene(wall(),flight()))),copy=duplicateAbove(p,'level',12,'above'),s=copy.project.entities.find((e):e is Slab=>e.kind==='slab'&&e.id!=='stairs')!;
  expect(s.stairs!.connections!.bottom).toBeUndefined();expect(s.stairs!.landings!.bottom).toBeUndefined();expect(s.stairs!.connections!.top!.wallId).not.toBe('wall');expect(parseProject(copy.project)).toEqual(copy.project);
 });
 it('reserves and frames landing solids, validates derived data and migrates version 27 without altering it',async()=>{
  const old=scene(wall(),flight()),legacy={...old,version:27},snapshot=structuredClone(legacy);expect(parseProject(legacy)).toEqual(old);expect(legacy).toEqual(snapshot);
  const p=top(bottom(old)),bad=structuredClone(p);stair(bad).stairs!.landings!.top!.points[0][0]+=1;expect(()=>parseProject(bad)).toThrow('match');expect(()=>parseProject({...p,version:27})).toThrow();
  const box=partBounds(stair(p),level);for(const pad of Object.values(stair(p).stairs!.landings!))for(const q of pad.points){const world=levelToWorld(level,q);expect(world[0]).toBeGreaterThanOrEqual(box.min[0]);expect(world[0]).toBeLessThanOrEqual(box.max[0]);expect(world[1]).toBeGreaterThanOrEqual(box.min[2]);expect(world[1]).toBeLessThanOrEqual(box.max[2]);}
  expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);
 });
});
