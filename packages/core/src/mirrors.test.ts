import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import tree from '../../../examples/demo-tree.asset.json';
import {createSite,applyCommand,Editor,mirrorMemberId,mirrorOwner,reflectPoint,mirrorSources,parseProject,copySelection,pasteSelection,type Block,type Instance,type MirrorRule,type Project} from './index';
import {serializeProject,deserializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
const source:Block={id:'shrub-block',parentId:'site',kind:'block',name:'Garden block',visible:true,position:[-8,2,4],rotation:25,size:[1,2,3],color:'#668844'};
const rule=(patch:Partial<MirrorRule>={}):MirrorRule=>({id:'garden-mirror',name:'Garden symmetry',sourceIds:[source.id],start:[0,-20],end:[0,20],...patch});
const base=()=>applyCommand(createSite({name:'Mirrors',width:80,depth:80,resolution:129,preset:'flat'}),{type:'add',entity:source});
const scene=()=>applyCommand(base(),{type:'mirror',rule:rule()});
const copy=(p:Project,r=rule(),id=source.id)=>p.entities.find(e=>e.id===mirrorMemberId(r,id)) as Block;
describe('editable garden symmetry',()=>{
 it('reflects offset and diagonal axes, retains originals, and uses the Y-rotation convention',()=>{
  const p=scene();expect(p.entities.find(e=>e.id===source.id)).toEqual(source);expect(copy(p).position).toEqual([8,2,4]);expect(copy(p).rotation).toBeCloseTo(-25);
  expect(reflectPoint({start:[3,-20],end:[3,20]},[-8,4])).toEqual([14,4]);const diagonalPoint=reflectPoint({start:[0,0],end:[10,10]},[-8,4]);expect(diagonalPoint[0]).toBeCloseTo(4);expect(diagonalPoint[1]).toBeCloseTo(-8);
  const diagonal=rule({start:[0,0],end:[10,10]});expect(copy(applyCommand(base(),{type:'mirror',rule:diagonal}),diagonal).rotation).toBeCloseTo(65);
 });
 it('follows source transforms and dimensions; copy names/visibility stay local and other edits need detaching',()=>{
  let named=scene();named=applyCommand(named,{type:'replace',entity:{...copy(named),name:'Named mirror'}});named=applyCommand(named,{type:'replace',entity:{...source,visible:false}});expect(copy(named).visible).toBe(false);
  let p=scene();p=applyCommand(p,{type:'replace',entity:{...copy(p),name:'Special mirror',visible:false}});p=applyCommand(p,{type:'replace',entity:{...source,position:[-9,3,6],size:[2,4,1],rotation:40}});
  expect(copy(p)).toMatchObject({name:'Special mirror',visible:false,position:[9,3,6],size:[2,4,1],rotation:-40});
  expect(()=>applyCommand(p,{type:'replace',entity:{...copy(p),position:[12,3,6]}})).toThrow('Detach');
  p=applyCommand(p,{type:'detachMirrorMember',id:copy(p).id});expect(mirrorOwner(p,copy(p).id)).toBeUndefined();const detached=copy(p);p=applyCommand(p,{type:'replace',entity:{...source,color:'#ffffff'}});expect(copy(p)).toEqual(detached);
 });
 it('mirrors whole repeats dynamically, retaining stable copy IDs across count, path and source edits',()=>{
  const repeat={id:'row',name:'Shrub row',sourceId:source.id,path:{kind:'line' as const,start:[-10,-10] as [number,number],end:[-10,10] as [number,number]},mode:'count' as const,count:5,spacing:2,orientation:'tangent' as const,rotation:0,clearance:0},r=rule({sourceIds:undefined,repeatId:'row'});
  let p=applyCommand(base(),{type:'repeat',pattern:repeat});p=applyCommand(p,{type:'mirror',rule:r});expect(p.entities).toHaveLength(11);const id=mirrorMemberId(r,'row:0');expect(p.entities.find(e=>e.id===id)).toMatchObject({position:[10,2,-10]});
  p=applyCommand(p,{type:'repeat',pattern:{...repeat,count:3}});expect(p.entities).toHaveLength(7);expect(p.entities.some(e=>e.id===mirrorMemberId(r,'row:4'))).toBe(false);
  p=applyCommand(p,{type:'repeat',pattern:{...repeat,count:6,path:{...repeat.path,start:[-12,-10]}}});expect(p.entities.find(e=>e.id===id)).toMatchObject({position:[12,2,-10]});expect(p.entities).toHaveLength(13);
 });
 it('shares model bytes and reflects handedness, including mirroring an already reflected independent model',()=>{
  const seed=createSite({name:'Plants',width:80,depth:80,resolution:129,preset:'flat'}),plant:Instance={id:'plant',parentId:'site',kind:'instance',name:'Plant',assetId:tree.id,visible:true,position:[-8,.1,4],rotation:30,scale:[1,2,3],anchor:'terrain'},r=rule({sourceIds:['plant']});
  let p=applyCommand(seed,{type:'insert',entities:[plant],assets:[tree]});p=applyCommand(p,{type:'mirror',rule:r});expect(p.assets).toHaveLength(1);expect(copy(p,r,'plant')).toMatchObject({mirrored:true,anchor:'terrain',position:[8,.1,4],scale:[1,2,3]});
  p=applyCommand(p,{type:'replace',entity:{...plant,mirrored:true}});expect((copy(p,r,'plant') as unknown as Instance).mirrored).toBeUndefined();
  const pasted=pasteSelection(p,copySelection(p,mirrorMemberId(r,'plant')),null,'independent');p=applyCommand(p,pasted.command);expect(mirrorOwner(p,pasted.selectedIds[0])).toBeUndefined();
 });
 it('skips objects on the axis, excludes deleted copies, and makes surviving copies independent on source removal',()=>{
  let p=scene();const id=copy(p).id;p=applyCommand(p,{type:'remove',id});p=applyCommand(p,{type:'replace',entity:{...source,color:'#ffffff'}});expect(p.entities.some(e=>e.id===id)).toBe(false);
  p=applyCommand(scene(),{type:'remove',id:source.id});expect(p.mirrorRules).toEqual([]);expect(p.entities).toHaveLength(1);expect(mirrorOwner(p,id)).toBeUndefined();
  p=applyCommand(scene(),{type:'replace',entity:{...source,position:[0,2,4]}});expect(p.entities).toHaveLength(1);p=applyCommand(p,{type:'replace',entity:source});expect(copy(p).id).toBe(id);
 });
 it('rejects invalid axes, dependency cycles, excessive sources, out-of-site results and locked dependents atomically',()=>{
  const editor=new Editor(scene()),snapshot=editor.getSnapshot();for(const r of [rule({end:[0,-20]}),rule({start:[100,0],end:[100,10]}),rule({id:'other',sourceIds:[copy(snapshot.project).id]}),rule({id:'huge',sourceIds:Array.from({length:129},(_,i)=>String(i))})]){expect(()=>editor.execute({type:'mirror',rule:r},'Bad mirror')).toThrow();expect(editor.getSnapshot()).toBe(snapshot);}
  let p=applyCommand(snapshot.project,{type:'layer',layer:{id:'locked',name:'Locked',parentId:null,color:'#ffffff',visible:true,locked:false}});p=applyCommand(p,{type:'assignLayer',ids:[copy(p).id],layerId:'locked'});p=applyCommand(p,{type:'layer',layer:{...p.layers.find(l=>l.id==='locked')!,locked:true}});
  expect(()=>applyCommand(p,{type:'replace',entity:{...source,color:'#ffffff'}})).toThrow('Unlock');expect(()=>applyCommand(p,{type:'mirror',rule:rule({name:'Renamed'})})).toThrow('Unlock');expect(()=>applyCommand(p,{type:'removeMirror',id:rule().id})).toThrow('Unlock');
  expect(mirrorSources(snapshot.project).some(e=>e.id===copy(snapshot.project).id)).toBe(false);
 });
 it('previews, cancels, undoes, reopens and migrates without adding symmetry to old projects',async()=>{
  const p=scene(),editor=new Editor(p);editor.begin('Mirror preview');editor.preview({type:'mirror',rule:rule({start:[2,-20],end:[2,20]})});expect(copy(editor.getSnapshot().preview!).position[0]).toBe(12);editor.cancel();expect(editor.getSnapshot().project).toEqual(p);
  editor.execute({type:'mirror',rule:rule({name:'Formal garden'})},'Rename symmetry');editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();const saved=editor.getSnapshot().project;expect(deserializeProject(serializeProject(saved))).toEqual(saved);await saveLocal(saved);expect(await loadLocal()).toEqual(saved);
  const old={...base(),version:36};expect(parseProject(old)).toEqual({...old,version:39});expect(()=>parseProject({...p,version:36})).toThrow('format 37');expect(()=>parseProject({...p,version:40})).toThrow();
 });
});
