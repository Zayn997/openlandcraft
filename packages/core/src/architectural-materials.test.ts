import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {serializeProject,deserializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {ARCHITECTURAL_MATERIAL_DEFAULTS,architecturalMaterials,architecturalMaterialFor,architecturalMaterialTargets,applyCommand,copySelection,pasteSelection,createSite,createCurvedWall,createStairs,duplicateAbove,Editor,parseProject,type BuildingPart,type Entity,type Level} from './index';
const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[0,0,0],rotation:0,storeyHeight:10};
const wall=createCurvedWall('level','circle',[[0,0],[6,0]],.6,10,false,0,'tower');
const stairs=createStairs('level',[-3,0],[3,0],{width:1.5,rise:3,run:6,steps:16},0,false,'stairs');
const scene=()=>parseProject({...createSite({name:'Materials',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,wall,stairs]});
const part=(p:ReturnType<typeof scene>,id='tower')=>p.entities.find((e):e is BuildingPart=>e.id===id&&(e.kind==='wall'||e.kind==='slab'||e.kind==='roof'))!;
const assign=(p:ReturnType<typeof scene>,ids=['tower','stairs'],materialId:string|null='castle-stone')=>applyCommand(p,{type:'assignArchitecturalMaterial',ids,materialId});
describe('shared architectural materials',()=>{
 it('assigns a shared definition without altering geometry or object color; resource edits reach every user',()=>{
  const p=scene(),a=assign(p),old=part(a),m=architecturalMaterials(a)[0],updated=applyCommand(a,{type:'architecturalMaterial',material:{...m,scale:3,color:'#aa9988',roughness:.6}});
  expect(part(a)).toEqual({...part(p),materialId:m.id});expect(part(updated)).toBe(old);expect(updated.site.terrain).toBe(a.site.terrain);expect(architecturalMaterialFor(updated,part(updated))).toEqual({...m,scale:3,color:'#aa9988',roughness:.6});expect(architecturalMaterialFor(updated,part(updated,'stairs'))).toEqual(architecturalMaterialFor(updated,old));
  const detached=assign(updated,['tower'],null);expect(architecturalMaterialFor(detached,part(detached))).toBeUndefined();expect(part(detached).color).toBe(wall.color);expect(part(detached,'stairs').materialId).toBe(m.id);
 });
 it('previews/cancels and undoes/redoes one shared edit with independent unique definitions',()=>{
  const editor=new Editor(assign(scene())),before=editor.getSnapshot().project,m=architecturalMaterials(before)[0],command={type:'architecturalMaterial' as const,material:{...m,scale:4}};
  editor.begin('Material');editor.preview(command);expect(architecturalMaterialFor(editor.getSnapshot().preview!,part(before))!.scale).toBe(4);expect(editor.getSnapshot().project).toBe(before);editor.cancel();expect(editor.getSnapshot().project).toBe(before);
  editor.execute(command,'Shared size');editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(architecturalMaterialFor(editor.getSnapshot().project,part(before))!.scale).toBe(4);
  editor.execute({type:'batch',commands:[{type:'architecturalMaterial',material:{...m,id:'unique',name:'My stone'}},{type:'assignArchitecturalMaterial',ids:['tower'],materialId:'unique'}]},'Unique');const unique=editor.getSnapshot().project;expect(part(unique).materialId).toBe('unique');expect(part(unique,'stairs').materialId).toBe(m.id);editor.execute({type:'architecturalMaterial',material:{...m,scale:8}},'Shared');expect(architecturalMaterialFor(editor.getSnapshot().project,part(unique))!.scale).toBe(m.scale);
 });
 it('expands building, level, unit and multi-selection scopes with no duplicate members',()=>{
  let p=scene();const entities:Entity[]=[...p.entities,{id:'building',kind:'building',parentId:'site',name:'Castle',visible:true},{id:'unit',kind:'unit',parentId:'level',name:'Tower assembly',visible:true,memberIds:['tower','stairs']}];p=parseProject({...p,entities:entities.map(e=>e.id==='level'?{...level,buildingId:'building'}:e)});
  for(const ids of [['level'],['building'],['unit'],['tower','unit']])expect(architecturalMaterialTargets(p,ids).map(e=>e.id)).toEqual(['tower','stairs']);expect(architecturalMaterialTargets(p,['terrain'])).toEqual([]);
 });
 it('protects locked material users and rejects malformed resources or dangling references atomically',()=>{
  const p=assign(scene()),editor=new Editor(p),m=architecturalMaterials(p)[0],before=editor.getSnapshot();for(const patch of [{scale:0},{scale:Infinity},{roughness:2},{color:'red'},{name:''}])expect(()=>editor.execute({type:'architecturalMaterial',material:{...m,...patch}},'Invalid')).toThrow();expect(editor.getSnapshot()).toBe(before);
  expect(()=>assign(p,['level'])).toThrow('existing');expect(()=>assign(p,['tower'],'missing')).toThrow('existing');expect(()=>parseProject({...p,architecturalMaterials:[m,m]})).toThrow('unique');expect(()=>parseProject({...p,architecturalMaterials:[]})).toThrow('reference');
  const locked=parseProject({...p,layers:[...p.layers,{id:'locked',name:'Locked',parentId:null,visible:true,locked:true,color:'#ffffff'}],objectLayers:{...p.objectLayers,stairs:'locked'}});expect(()=>applyCommand(locked,{type:'architecturalMaterial',material:{...m,scale:3}})).toThrow('Unlock');
  const hidden=parseProject({...p,entities:p.entities.map(e=>e.id==='stairs'?{...e,visible:false}:e)});expect(architecturalMaterials(applyCommand(hidden,{type:'architecturalMaterial',material:{...m,scale:3}}))[0].scale).toBe(3);
 });
 it('keeps shared links on copies/storeys and imports definitions without overwriting destination collisions',()=>{
  const p=assign(scene()),clip=copySelection(p,'tower'),copied=applyCommand(p,pasteSelection(p,clip,'level','same').command);expect(part(copied,'same-0').materialId).toBe('castle-stone');expect(architecturalMaterials(copied)).toHaveLength(3);
  const destination=applyCommand(scene(),{type:'architecturalMaterial',material:{...ARCHITECTURAL_MATERIAL_DEFAULTS[0],color:'#123456'}}),pasted=applyCommand(destination,pasteSelection(destination,clip,'level','cross').command);expect(part(pasted,'cross-0').materialId).toBe('cross-material-0');expect(architecturalMaterialFor(pasted,part(pasted,'cross-0'))!.color).toBe(ARCHITECTURAL_MATERIAL_DEFAULTS[0].color);expect(architecturalMaterials(pasted)[0].color).toBe('#123456');
  const above=duplicateAbove(p,'level',12,'above').project;expect(above.entities.filter(e=>(e.kind==='wall'||e.kind==='slab')&&e.materialId==='castle-stone')).toHaveLength(4);expect(parseProject(above)).toEqual(above);
 });
 it('migrates strict format 29 without touching colors and retains standalone local/portable material data',async()=>{
  const p=scene(),old={...p,version:29},snapshot=structuredClone(old);expect(parseProject(old)).toEqual(p);expect(old).toEqual(snapshot);const textured=assign(p);expect(()=>parseProject({...textured,version:29})).toThrow();expect(deserializeProject(serializeProject(textured))).toEqual(textured);await saveLocal(textured);expect(await loadLocal()).toEqual(textured);
 });
});
