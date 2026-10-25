import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {createSite,createHedge,createMoat,applyCommand,Editor,evaluateProject,parseProject,copySelection,pasteSelection,groundHabitat,plantingObstacle,mirrorMemberId,type Hedge,type MirrorRule} from './index';
import {hedgeRoute,hedgeStrips,hedgeShapeIssue,lakeDistance} from '@openlandcraft/landscape';
import {serializeProject,deserializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
const base=()=>createSite({name:'Clipped garden',width:80,depth:80,resolution:129,preset:'flat'});
const run=(patch:Partial<Hedge>={}):Hedge=>({...createHedge(base(),[[-12,-8],[-12,8],[0,8]]),id:'hedge',...patch});
const scene=(h=run())=>applyCommand(base(),{type:'add',entity:h});
describe('native clipped hedge runs',()=>{
 it('retains one editable object for open and closed runs, bounded widths and softened corners',()=>{
  const p=scene(),h=run();expect(p.entities).toHaveLength(1);expect(p.entities[0]).toEqual(h);expect(hedgeStrips(h)).toHaveLength(2);
  const rounded=run({rounding:.5});expect(hedgeRoute(rounded).length).toBeGreaterThan(3);expect(hedgeShapeIssue(rounded,p.site)).toBeNull();
  const closed=run({closed:true,points:[[-8,-8],[8,-8],[8,8],[-8,8]]});expect(hedgeStrips(closed)).toHaveLength(4);expect(hedgeStrips(closed).some(p=>lakeDistance(p,0,0)>0)).toBe(false);expect(()=>scene(closed)).not.toThrow();
 });
 it('rejects crossings, narrow/inverted bends, bounds, invalid loops and excessive run counts atomically',()=>{
  const editor=new Editor(scene()),snapshot=editor.getSnapshot();
  for(const patch of [{width:5},{height:.1},{points:[[-12,-8],[-12,-8]]},{points:[[-12,-8],[12,8],[-12,8],[12,-8]]},{points:[[-40,-5],[-40,5]]},{closed:true,points:[[-5,0],[5,0]]},{closed:true,rounding:.5}]){expect(()=>editor.execute({type:'replace',entity:{...run(),...patch} as Hedge},'Invalid hedge')).toThrow();expect(editor.getSnapshot()).toBe(snapshot);}
  const template=run();expect(()=>parseProject({...base(),entities:Array.from({length:33},(_,i)=>({...template,id:`hedge-${i}`}))})).toThrow('32 hedge runs');
 });
 it('keeps terrain editable and checks explicit level tops after terrain and grade changes',()=>{
  const h=run({points:[[-10,0],[10,0]],topMode:'level',topElevation:4}),p=scene(h),editor=new Editor(p),before=editor.getSnapshot();
  expect(evaluateProject(p).site.terrain.heights).toEqual(p.site.terrain.heights);expect(()=>scene({...h,topElevation:2.1})).toThrow('0.3 and 5');expect(()=>scene({...h,topElevation:8})).toThrow('0.3 and 5');
  const field={...p.site.terrain,heights:p.site.terrain.heights.map(()=>4)};expect(()=>editor.execute({type:'terrain',field},'Raise roots')).toThrow('0.3 and 5');expect(editor.getSnapshot()).toBe(before);
  editor.execute({type:'replace',entity:{...h,visible:false}},'Hide hedge');expect(evaluateProject(editor.getSnapshot().project).site.terrain.heights).toEqual(p.site.terrain.heights);editor.undo();expect(editor.getSnapshot().project).toEqual(p);
 });
 it('keeps roots outside moat banks, allows dry-island planting, and revalidates water edits',()=>{
  const p=base(),moat=createMoat(p);p.entities.push(moat);const h=run({points:[[-8,0],[8,0]]});expect(()=>applyCommand(p,{type:'add',entity:h})).not.toThrow();
  expect(()=>applyCommand(p,{type:'add',entity:run({points:[[25,-5],[25,5]]})})).toThrow(/water|bank/);
  const q=applyCommand(p,{type:'add',entity:h}),editor=new Editor(q),snapshot=editor.getSnapshot();expect(()=>editor.execute({type:'replace',entity:{...moat,holes:[moat.holes![0].map(([x,z])=>[x*.2,z*.2])]}},'Flood hedge')).toThrow();expect(editor.getSnapshot()).toBe(snapshot);
 });
 it('reserves full hedge footprints for walking and seeded planting, including closed-loop interiors',()=>{
  const h=run({closed:true,points:[[-8,-8],[8,-8],[8,8],[-8,8]],height:.5}),p=scene(h),walk=groundHabitat(p),plants=plantingObstacle(p,{clearance:1,exclusions:{water:false,paths:false,buildings:false}});
  expect(walk.clear(8,0,.25)).toBe(false);expect(walk.clear(0,0,.25)).toBe(true);expect(plants(8,0)).toBe(true);expect(plants(0,0)).toBe(false);
  const hidden={...p,entities:[{...h,visible:false}]};expect(groundHabitat(hidden).clear(8,0,.25)).toBe(true);expect(plantingObstacle(hidden,{clearance:1,exclusions:{water:false,paths:false,buildings:false}})(8,0)).toBe(true);
 });
 it('mirrors whole hedge geometry with stable IDs and explicit detach, and copies independently',()=>{
  const h=run(),r:MirrorRule={id:'hedge-mirror',name:'Garden symmetry',sourceIds:[h.id],start:[2,-20],end:[2,20]},id=mirrorMemberId(r,h.id);
  let p=applyCommand(scene(h),{type:'mirror',rule:r});expect(p.entities.find(e=>e.id===id)).toMatchObject({kind:'hedge',points:h.points.map(([x,z])=>[4-x,z])});
  p=applyCommand(p,{type:'replace',entity:{...h,height:2,width:1.2,rounding:.4}});expect(p.entities.find(e=>e.id===id)).toMatchObject({height:2,width:1.2,rounding:.4});
  p=applyCommand(p,{type:'detachMirrorMember',id});const member=p.entities.find(e=>e.id===id) as Hedge;p=applyCommand(p,{type:'replace',entity:{...member,color:'#224422'}});expect(p.entities.find(e=>e.id===id)).toMatchObject({color:'#224422'});
  const paste=pasteSelection(p,copySelection(p,h.id),null,'hedge-copy'),q=applyCommand(p,paste.command);expect(q.entities.find(e=>e.id===paste.selectedIds[0])).toMatchObject({points:h.points.map(([x,z])=>[x+2,z+2])});
 });
 it('preserves preview/cancel, undo/redo, locks and strict format-38 portable/local persistence',async()=>{
  const p=scene(),editor=new Editor(p);editor.begin('Trim');editor.preview({type:'replace',entity:{...run(),height:2}});expect(editor.getSnapshot().preview!.entities[0]).toMatchObject({height:2});editor.cancel();expect(editor.getSnapshot().project).toEqual(p);
  editor.execute({type:'replace',entity:{...run(),height:2}},'Trim hedge');editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();const saved=editor.getSnapshot().project;expect(deserializeProject(serializeProject(saved))).toEqual(saved);await saveLocal(saved);expect(await loadLocal()).toEqual(saved);
  expect(()=>parseProject({...p,version:37})).toThrow('format 38');expect(parseProject({...base(),version:37})).toEqual({...base(),version:39});expect(()=>parseProject({...p,version:40})).toThrow();
  let locked=applyCommand(p,{type:'layer',layer:{id:'hedges',name:'Hedges',parentId:null,color:'#446633',visible:true,locked:false}});locked=applyCommand(locked,{type:'assignLayer',ids:['hedge'],layerId:'hedges'});locked=applyCommand(locked,{type:'layer',layer:{...locked.layers.find(l=>l.id==='hedges')!,locked:true}});expect(()=>applyCommand(locked,{type:'replace',entity:{...run(),height:2}})).toThrow('Unlock');
 });
});
