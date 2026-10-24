import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {applyCommand,copySelection,createSite,DEFAULT_TOWER,defaultOpeningJoinery,Editor,newTower,parseProject,pasteSelection,towerOwner,towerParameters,updateCircularFloor,updateCurvedWall,type Project,type Slab,type TowerType,type Wall} from './index';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
export const type:TowerType={...DEFAULT_TOWER,id:'round',name:'Round keep'};
export const scene=(top:TowerType['top']='battlements')=>{const p=createSite({name:'Tower assemblies',width:120,depth:120,resolution:129,preset:'flat'}),a=newTower('round',[-20,2.2,0],'tower');return applyCommand(p,{type:'batch',commands:[{type:'towerType',definition:{...type,top}},{type:'tower',...a}]});};
const wall=(p:Project,id='tower-wall')=>p.entities.find(e=>e.id===id) as Wall;
const floor=(p:Project,id='tower-floor1')=>p.entities.find(e=>e.id===id) as Slab;
describe('reusable native tower assemblies',()=>{
 it('creates a real circular wall, circular floors and battlements on one named level',()=>{
  const p=scene();expect(p.entities).toHaveLength(5);expect(wall(p)).toMatchObject({curve:{radius:6,sweepAngle:360},height:12,thickness:.6,battlements:{spacing:1},materialId:'castle-stone'});expect(floor(p)).toMatchObject({disk:{radius:5.71},elevation:3.8,materialId:'castle-timber'});expect(towerOwner(p,'tower-floor1')?.id).toBe('tower');expect(p.entities.filter(e=>e.kind==='level')).toHaveLength(1);
 });
 it('updates radius, height, thickness, count and spacing while keeping component identities',()=>{
  const p=scene(),t=p.towerAssemblies![0],next=applyCommand(p,{type:'tower',tower:{...t,parameters:{radius:8,height:16,thickness:.8,floorCount:4,battlementSpacing:1.5}}});expect(wall(next)).toMatchObject({id:'tower-wall',curve:{radius:8},height:16,thickness:.8,battlements:{spacing:1.5}});expect(floor(next)).toMatchObject({id:'tower-floor1',disk:{radius:7.61},elevation:3.8});expect(next.entities.filter(e=>e.kind==='slab')).toHaveLength(4);expect(next.entities.find(e=>e.id==='tower-floor3')).toMatchObject({elevation:11.8});
 });
 it('retains arched openings, frames and materials through radius changes and local wall edits',()=>{
  let p=scene();const w={...wall(p),openings:[{id:'gate',kind:'door' as const,offset:2,width:2,height:3,sill:0,shape:'arch' as const,archRise:1,joinery:defaultOpeningJoinery('door')}]};p=applyCommand(p,{type:'replace',entity:w});
  p=applyCommand(p,{type:'tower',tower:{...p.towerAssemblies![0],parameters:{radius:9,height:15}}});const o=wall(p).openings![0];expect(o.joinery).toEqual(w.openings[0].joinery);expect((o.offset+1)/9).toBeCloseTo(3/6);expect(wall(p).height).toBe(15);
  p=applyCommand(p,{type:'replace',entity:{...wall(p),height:18}});p=applyCommand(p,{type:'towerType',definition:{...type,height:21,thickness:.9}});expect(wall(p).height).toBe(18);expect(wall(p).thickness).toBe(.9);expect(floor(p).elevation).toBeCloseTo(5.8);
 });
 it('keeps floor radius/elevation and roof height/overhang individually editable',()=>{
  let p=scene('roof'),f=updateCircularFloor(floor(p),{radius:4.5,elevation:5});p=applyCommand(p,{type:'replace',entity:f});const roof=p.entities.find(e=>e.kind==='roof')!;if(roof.kind!=='roof')throw new Error();p=applyCommand(p,{type:'replace',entity:{...roof,rise:5,cone:{...roof.cone!,overhang:1},width:14.6,depth:14.6}});
  p=applyCommand(p,{type:'towerType',definition:{...type,top:'roof',radius:8,height:18,roofHeight:3,overhang:.3}});expect(floor(p)).toMatchObject({disk:{radius:4.5},elevation:5});expect(p.entities.find(e=>e.kind==='roof')).toMatchObject({rise:5,cone:{radius:8.3,overhang:1,wallId:'tower-wall'},elevation:18,width:18.6});
 });
 it('duplicates complete assemblies and shares type updates while preserving local instance parameters',()=>{
  let p=scene('roof');const plan=pasteSelection(p,copySelection(p,'tower-level'),null,'copy',1,{worldDelta:[25,0],snapping:false});p=applyCommand(p,plan.command);expect(p.towerAssemblies).toHaveLength(2);expect(p.towerTypes).toHaveLength(1);
  const clone=p.towerAssemblies![1];p=applyCommand(p,{type:'tower',tower:{...clone,parameters:{radius:7}}});p=applyCommand(p,{type:'towerType',definition:{...type,top:'roof',radius:8,height:18,battlementSpacing:2}});expect(wall(p).curve!.radius).toBe(8);expect(wall(p,clone.parts.wall).curve!.radius).toBe(7);expect(wall(p,clone.parts.wall).height).toBe(18);expect(p.entities.find(e=>e.id===clone.parts.roof&&e.kind==='roof')).toMatchObject({cone:{wallId:clone.parts.wall}});
 });
 it('remaps conflicting type definitions when copying across projects; individual component copies remain independent',()=>{
  const p=scene(),other=applyCommand(createSite({name:'Destination',width:120,depth:120,resolution:129,preset:'flat'}),{type:'towerType',definition:{...type,radius:9}});const result=applyCommand(other,pasteSelection(other,copySelection(p,'tower-level'),null,'import',1,{worldDelta:[25,0],snapping:false}).command);expect(result.towerTypes).toHaveLength(2);expect(result.towerAssemblies![0].typeId).toBe('import-tower-type-0');
  const single=applyCommand(p,pasteSelection(p,copySelection(p,'tower-floor1'),'tower-level','floor-copy').command);expect(single.towerAssemblies).toHaveLength(1);expect(towerOwner(single,'floor-copy-0')).toBeUndefined();
 });
 it('updates two linked towers atomically while retaining component edits through undo and portable reopening',()=>{
  let p=scene('roof');p=applyCommand(p,pasteSelection(p,copySelection(p,'tower-level'),null,'linked',1,{worldDelta:[30,0],snapping:false}).command);
  const a=p.towerAssemblies![1],roof=p.entities.find(e=>e.id===a.parts.roof)!;if(roof.kind!=='roof')throw new Error();
  p=applyCommand(p,{type:'replace',entity:{...updateCircularFloor(floor(p,a.parts.floor1),{radius:4.5,elevation:4.3,thickness:.3}),name:'Gallery',materialId:'castle-stone'}});
  p=applyCommand(p,{type:'replace',entity:{...roof,rise:5,cone:{...roof.cone!,overhang:1},width:14.6,depth:14.6}});
  const ids=p.entities.map(e=>e.id),editor=new Editor(p);editor.execute({type:'towerType',definition:{...type,top:'roof',radius:8,height:16,thickness:.8,floorCount:4,roofHeight:3,overhang:.3}},'Update both towers');
  const next=editor.getSnapshot().project;
  for(const t of next.towerAssemblies!){expect(wall(next,t.parts.wall)).toMatchObject({curve:{radius:8},height:16,thickness:.8});expect(next.entities.find(e=>e.id===t.parts.floor3)).toMatchObject({disk:{radius:7.61},elevation:11.8});}
  expect(floor(next,a.parts.floor1)).toMatchObject({name:'Gallery',disk:{radius:4.5},elevation:4.3,thickness:.3,materialId:'castle-stone'});
  expect(next.entities.find(e=>e.id===a.parts.roof)).toMatchObject({rise:5,cone:{radius:8.4,overhang:1},elevation:16});
  expect(next.entities.find(e=>e.id==='tower-roof')).toMatchObject({rise:3,cone:{radius:8.4,overhang:.3},elevation:16});
  expect(next.entities.map(e=>e.id)).toEqual(expect.arrayContaining(ids));expect(deserializeProject(serializeProject(next))).toEqual(next);
  editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();expect(editor.getSnapshot().project).toEqual(next);
 });
 it('resets linked dimensions without deleting hosted details and detaches floors before count reduction',()=>{
  let p=scene();p=applyCommand(p,{type:'replace',entity:updateCircularFloor(floor(p,'tower-floor2'),{radius:4})});expect(()=>applyCommand(p,{type:'tower',tower:{...p.towerAssemblies![0],parameters:{floorCount:2}}})).toThrow('Detach');p=applyCommand(p,{type:'detachTowerPart',id:'tower-floor2'});p=applyCommand(p,{type:'tower',tower:{...p.towerAssemblies![0],parameters:{floorCount:2}}});expect(floor(p,'tower-floor2').disk!.radius).toBe(4);expect(towerOwner(p,'tower-floor2')).toBeUndefined();
  p=applyCommand(p,{type:'replace',entity:updateCurvedWall(wall(p),{radius:7})});p=applyCommand(p,{type:'resetTowerPart',id:'tower-wall'});expect(wall(p).curve!.radius).toBe(6);
 });
 it('makes a type unique, keeps native component editing after assembly detachment and excludes deleted floors',()=>{
  let p=scene();p=applyCommand(p,{type:'remove',id:'tower-floor1'});p=applyCommand(p,{type:'towerType',definition:{...type,height:15}});expect(p.entities.some(e=>e.id==='tower-floor1')).toBe(false);
  p=applyCommand(p,{type:'batch',commands:[{type:'towerType',definition:{...type,id:'unique',radius:7}},{type:'tower',tower:{...p.towerAssemblies![0],typeId:'unique'}}]});expect(wall(p).curve!.radius).toBe(7);p=applyCommand(p,{type:'detachTower',id:'tower'});expect(p.towerAssemblies).toEqual([]);p=applyCommand(p,{type:'replace',entity:{...wall(p),height:18}});expect(wall(p).height).toBe(18);
 });
 it('previews, cancels and undoes assembly/type changes, including type-only history',()=>{
  const p=scene(),editor=new Editor(p);editor.begin('Tower');editor.preview({type:'tower',tower:{...p.towerAssemblies![0],parameters:{radius:8}}});expect(wall(editor.getSnapshot().preview!).curve!.radius).toBe(8);editor.cancel();expect(editor.getSnapshot().project).toEqual(p);
  editor.execute({type:'towerType',definition:{...type,name:'Renamed type'}},'Rename type');expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();expect(editor.getSnapshot().project.towerTypes![0].name).toBe('Renamed type');
 });
 it('rejects invalid dimensions, missing references, bad circular floors and locked dependents atomically',()=>{
  const p=scene(),editor=new Editor(p),before=editor.getSnapshot();for(const parameters of [{radius:100},{height:3,floorCount:8},{radius:1.5,thickness:2}])expect(()=>editor.execute({type:'tower',tower:{...p.towerAssemblies![0],parameters}},'Bad tower')).toThrow();expect(editor.getSnapshot()).toBe(before);
  const locked={...p,layers:[...p.layers,{id:'locked',name:'Locked',parentId:null,color:'#ffffff',visible:true,locked:true}],objectLayers:{...p.objectLayers,'tower-floor1':'locked'}};expect(()=>applyCommand(locked,{type:'towerType',definition:{...type,radius:8}})).toThrow('Unlock');expect(()=>applyCommand(p,{type:'replace',entity:{...floor(p),width:9}})).toThrow();expect(()=>parseProject({...p,towerTypes:[]})).toThrow();
 });
 it('preserves format-32 projects unchanged and persists reusable types, overrides and components in format 33',async()=>{
  let p=scene('roof');p=applyCommand(p,{type:'replace',entity:{...floor(p),color:'#123456'}});expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);const old={...createSite({name:'Legacy',width:80,depth:80,resolution:129,preset:'flat'}),version:32};expect(parseProject(old).version).toBe(33);expect(old.version).toBe(32);expect(()=>parseProject({...p,version:32})).toThrow();
 });
});
