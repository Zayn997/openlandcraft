import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import tree from '../../../examples/demo-tree.asset.json';
import {applyCommand,copySelection,createSite,Editor,parseProject,pasteSelection,repeatLayout,repeatOwner,repeatPathFromPoints,repeatSources,type Block,type Instance,type Project,type RepeatPattern} from './index';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
const source:Block={id:'column',name:'Column',kind:'block',parentId:'site',visible:true,position:[-20,2,-20],rotation:0,size:[.5,3,.5],color:'#b6b0a4'};
const rule=(patch:Partial<RepeatPattern>={}):RepeatPattern=>({id:'row',name:'Colonnade',sourceId:source.id,path:{kind:'line',start:[-10,0],end:[10,0]},mode:'count',count:5,spacing:3,orientation:'fixed',rotation:0,clearance:0,...patch});
const base=()=>applyCommand(createSite({name:'Repeats',width:80,depth:80,resolution:129,preset:'flat'}),{type:'add',entity:source});
const scene=(pattern=rule())=>applyCommand(base(),{type:'repeat',pattern});
const block=(p:Project,id='row:0')=>p.entities.find(e=>e.id===id) as Block;

describe('editable repeat rules',()=>{
 it('places bounded copies on a line without moving the source; supports exact spacing, clearance and source-relative rotation',()=>{
  const p=scene();expect(p.entities).toHaveLength(6);expect(block(p,'column')).toEqual(source);expect(block(p).position).toEqual([-10,2,0]);expect(block(p,'row:4').position).toEqual([10,2,0]);
  const pattern=rule({mode:'spacing',spacing:3,clearance:2,orientation:'tangent',rotation:90});const next=applyCommand(p,{type:'repeat',pattern});expect(repeatLayout(pattern)).toMatchObject({count:6,spacing:3,start:2.5});expect(block(next).position).toEqual([-7.5,2,0]);expect(block(next).rotation).toBe(90);expect(next.entities.filter(e=>e.id.startsWith('row:'))).toHaveLength(6);
 });
 it('draws clockwise and counterclockwise arcs, including full circles without a duplicate endpoint',()=>{
  for(const clockwise of [false,true]){
   const path=repeatPathFromPoints('arc',[[0,0],[8,0],[0,8]],clockwise),p=scene(rule({path,orientation:'radial'}));
   expect(path.kind==='arc'&&Math.sign(path.sweepAngle)).toBe(clockwise?-1:1);expect(block(p).position).toEqual([8,2,0]);expect(block(p,'row:4').position[0]).toBeCloseTo(0);expect(block(p,'row:4').position[2]).toBeCloseTo(8);
  }
  const pattern=rule({path:repeatPathFromPoints('arc',[[0,0],[8,0],[8,0]]),count:8}),p=scene(pattern);expect(new Set(p.entities.filter(e=>e.id.startsWith('row:')).map(e=>e.kind==='block'&&e.position.map(n=>n.toFixed(6)).join(','))).size).toBe(8);expect(repeatLayout(pattern).spacing).toBeCloseTo(Math.PI*2);
  const spaced=repeatLayout({...pattern,mode:'spacing',spacing:3});expect(spaced.count).toBe(16);expect(spaced.spacing).toBeGreaterThanOrEqual(3);expect(()=>repeatLayout({...pattern,mode:'spacing',spacing:100})).toThrow('2–128');
 });
 it('uses the Three.js Y rotation convention for tangent and outward radial orientation',()=>{
  const path={kind:'line' as const,start:[0,0] as [number,number],end:[0,10] as [number,number]};expect(block(scene(rule({path,orientation:'tangent'}))).rotation).toBe(-90);
  const arc={kind:'arc' as const,center:[0,0] as [number,number],radius:8,startAngle:0,sweepAngle:180};expect(block(scene(rule({path:arc,orientation:'tangent'}))).rotation).toBe(-90);expect(block(scene(rule({path:{...arc,sweepAngle:-180},orientation:'tangent'}))).rotation).toBe(90);
 });
 it('updates shared source fields while preserving per-axis dimensions, position offsets, names and colors',()=>{
  const editor=new Editor(scene()),member=block(editor.getSnapshot().project,'row:2');
  editor.execute({type:'replace',entity:{...member,name:'Special column',size:[.9,3,.5],color:'#112233',position:[1,3,2],rotation:15}},'Override');
  editor.execute({type:'replace',entity:{...source,size:[.6,4,.7],color:'#ffffff',position:[-19,3,-19],rotation:20}},'Source');
  const p=editor.getSnapshot().project;expect(block(p,'row:2')).toMatchObject({name:'Special column',size:[.9,4,.7],color:'#112233',position:[1,4,2],rotation:35});expect(block(p)).toMatchObject({size:[.6,4,.7],color:'#ffffff',position:[-10,3,0],rotation:20});expect(repeatOwner(p,'row:2')?.id).toBe('row');
 });
 it('preserves IDs and dormant overrides when count shrinks and grows, or the path radius changes',()=>{
  let p=scene(rule({path:{kind:'arc',center:[0,0],radius:8,startAngle:0,sweepAngle:180}}));p=applyCommand(p,{type:'replace',entity:{...block(p,'row:4'),color:'#123456'}});const pattern=p.repeatPatterns![0];
  p=applyCommand(p,{type:'repeat',pattern:{...pattern,count:3}});expect(p.entities.some(e=>e.id==='row:4')).toBe(false);
  p=applyCommand(p,{type:'repeat',pattern:{...p.repeatPatterns![0],count:5,path:{kind:'arc',center:[2,1],radius:10,startAngle:0,sweepAngle:180}}});expect(block(p,'row:4').color).toBe('#123456');expect(block(p,'row:4').position[0]).toBeCloseTo(-8);expect(block(p,'row:4').position[2]).toBeCloseTo(1);
 });
 it('resets overrides, detaches members, excludes deleted members and explodes without losing independent edits',()=>{
  let p=scene();p=applyCommand(p,{type:'replace',entity:{...block(p),size:[1,3,.5]}});p=applyCommand(p,{type:'resetRepeatMember',id:'row:0'});expect(block(p).size).toEqual(source.size);
  p=applyCommand(p,{type:'detachRepeatMember',id:'row:1'});expect(repeatOwner(p,'row:1')).toBeUndefined();expect(repeatSources(p).some(e=>e.id==='row:1')).toBe(true);
  p=applyCommand(p,{type:'remove',id:'row:2'});p=applyCommand(p,{type:'replace',entity:{...source,color:'#ffffff'}});expect(block(p,'row:1').color).toBe(source.color);expect(p.entities.some(e=>e.id==='row:2')).toBe(false);
  const objects=p.entities;p=applyCommand(p,{type:'removeRepeat',id:'row'});expect(p.entities).toEqual(objects);expect(p.repeatPatterns).toEqual([]);
 });
 it('removes only linked copies and detaches surviving copies when their source is deleted',()=>{
  const editor=new Editor(scene());editor.execute({type:'detachRepeatMember',id:'row:1'},'Detach');editor.execute({type:'removeRepeat',id:'row',deleteObjects:true},'Remove');expect(editor.getSnapshot().project.entities.map(e=>e.id)).toEqual(['column','row:1']);editor.undo();expect(editor.getSnapshot().project.entities).toHaveLength(6);
  const next=applyCommand(scene(),{type:'remove',id:'column'});expect(next.repeatPatterns).toEqual([]);expect(next.entities).toHaveLength(5);
 });
 it('uses existing terrain-anchored model sources and keeps local scale edits during shared model/scale updates',()=>{
  const seed=createSite({name:'Shrubs',width:80,depth:80,resolution:129,preset:'flat'}),shrub:Instance={id:'shrub',kind:'instance',parentId:'site',name:'Shrub source',visible:true,assetId:tree.id,position:[-20,.1,-20],rotation:0,scale:[1,1,1],anchor:'terrain'};
  let p=applyCommand(seed,{type:'insert',entities:[shrub],assets:[tree]});p=applyCommand(p,{type:'repeat',pattern:rule({sourceId:'shrub'})});const member=p.entities.find(e=>e.id==='row:1') as Instance;
  p=applyCommand(p,{type:'replace',entity:{...member,scale:[2,1,1]}});p=applyCommand(p,{type:'replace',entity:{...shrub,scale:[1.2,1.3,1.4]}});expect(p.entities.find(e=>e.id===member.id)).toMatchObject({scale:[2,1.3,1.4],anchor:'terrain',assetId:tree.id});expect(p.assets).toHaveLength(1);
 });
 it('rejects invalid paths, excessive counts, out-of-site centers, ID collisions, member sources and locked dependents atomically',()=>{
  const editor=new Editor(scene()),before=editor.getSnapshot();
  for(const pattern of [rule({count:129}),rule({spacing:.01}),rule({clearance:11}),rule({path:{kind:'line',start:[0,0],end:[0,0]}}),rule({path:{kind:'line',start:[0,0],end:[100,0]}}),rule({sourceId:'row:0'})])expect(()=>editor.execute({type:'repeat',pattern},'Invalid')).toThrow();expect(editor.getSnapshot()).toBe(before);
  let p=applyCommand(before.project,{type:'layer',layer:{id:'locked',name:'Locked',parentId:null,color:'#ffffff',visible:true,locked:false}});p=applyCommand(p,{type:'assignLayer',ids:['row:0'],layerId:'locked'});p=applyCommand(p,{type:'layer',layer:{...p.layers.find(l=>l.id==='locked')!,locked:true}});
  expect(()=>applyCommand(p,{type:'replace',entity:{...source,color:'#ffffff'}})).toThrow('Unlock');expect(()=>applyCommand(p,{type:'detachRepeatMember',id:'row:0'})).toThrow('Unlock');expect(()=>applyCommand(p,{type:'removeRepeat',id:'row'})).toThrow('Unlock');
  expect(()=>applyCommand(p,{type:'repeat',pattern:rule({name:'Locked rename'})})).toThrow('Unlock');
  expect(()=>applyCommand(base(),{type:'repeat',pattern:rule({id:'column'})})).toThrow();
 });
 it('previews/cancels as one edit, retains rule-only history and saves strict format 32 with overrides',async()=>{
  const p=scene(),editor=new Editor(p);editor.begin('Repeat');editor.preview({type:'repeat',pattern:rule({count:7})});expect(editor.getSnapshot().preview!.entities).toHaveLength(8);editor.cancel();expect(editor.getSnapshot().project).toEqual(p);
  editor.execute({type:'repeat',pattern:rule({name:'New rule name'})},'Rename repeat');expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();expect(editor.getSnapshot().project.repeatPatterns![0].name).toBe('New rule name');
  const saved=editor.getSnapshot().project;expect(deserializeProject(serializeProject(saved))).toEqual(saved);await saveLocal(saved);expect(await loadLocal()).toEqual(saved);
  const legacy={...base(),version:31};expect(parseProject(legacy).version).toBe(32);expect(legacy.version).toBe(31);expect(()=>parseProject({...p,version:31})).toThrow();expect(()=>parseProject({...p,version:33})).toThrow();
 });
 it('copies individual members as independent objects without changing the original rule',()=>{
  const p=scene(),result=pasteSelection(p,copySelection(p,'row:0'),'site','copied'),next=applyCommand(p,result.command);expect(next.repeatPatterns).toEqual(p.repeatPatterns);expect(repeatOwner(next,result.selectedIds[0])).toBeUndefined();expect(next.entities).toHaveLength(7);
 });
 it('shares one source across multiple rules, with separate overrides and editable source-layer inheritance',()=>{
  let p=scene();p=applyCommand(p,{type:'repeat',pattern:rule({id:'arc',path:{kind:'arc',center:[0,10],radius:8,startAngle:0,sweepAngle:180},count:3})});
  p=applyCommand(p,{type:'replace',entity:{...block(p,'arc:0'),size:[.8,3,.5]}});p=applyCommand(p,{type:'replace',entity:{...source,size:[.7,5,.6]}});
  expect(block(p).size).toEqual([.7,5,.6]);expect(block(p,'arc:0').size).toEqual([.8,5,.6]);expect(block(p,'arc:1').size).toEqual([.7,5,.6]);
  p=applyCommand(p,{type:'layer',layer:{id:'columns',name:'Columns',parentId:null,color:'#ffffff',visible:true,locked:false}});p=applyCommand(p,{type:'assignLayer',ids:['column'],layerId:'columns'});
  p=applyCommand(p,{type:'repeat',pattern:{...p.repeatPatterns![0],count:6}});expect(p.objectLayers['row:5']).toBe('columns');
 });
});
