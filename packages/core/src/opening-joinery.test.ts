import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {architecturalMaterials,architecturalMaterialUsers,applyCommand,copySelection,createCurvedWall,createSite,defaultOpeningJoinery,dragOpening,duplicateAbove,editOpening,Editor,openingAtPoint,openingCenter,parseProject,pasteSelection,updateCurvedWall,wallLength,wallPathPoint,type Level,type Opening,type Wall} from './index';
const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[0,0,0],rotation:0,storeyHeight:8};
const ring=(clockwise=false)=>{const w=createCurvedWall('level','circle',[[0,0],[6,0]],.6,7,false,1,'wall');return clockwise?updateCurvedWall(w,{sweepAngle:-360}):w;};
const gate:Opening={id:'gate',kind:'door',offset:2,width:2,height:3,sill:0,shape:'arch',archRise:1,joinery:defaultOpeningJoinery('door')};
const window:Opening={id:'window',kind:'window',offset:7,width:1.4,height:1.8,sill:2,shape:'arch',archRise:.6,joinery:defaultOpeningJoinery('window')};
const scene=(w:Wall={...ring(),openings:[gate,window]})=>parseProject({...createSite({name:'Joinery',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,w]});
const wall=(p:ReturnType<typeof scene>,id='wall')=>p.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===id)!;
describe('editable hosted frames, door panels and glass',()=>{
 it('uses the existing placement workflow for rectangles, arches, both arc directions and the circular seam',()=>{
  for(const clockwise of [false,true])for(const shape of ['rectangle','arch'] as const)for(const kind of ['door','window'] as const){const w=ring(clockwise),q=wallPathPoint(w,0),result=openingAtPoint(w,level,[q[0],2,q[1]],{kind,width:1.4,height:2,sill:1,shape,archRise:.6,joinery:defaultOpeningJoinery(kind),snapping:false},'opening',[w]);expect(result.issue).toBeNull();expect(result.opening!.joinery).toEqual(defaultOpeningJoinery(kind));expect(result.opening!.offset).toBeCloseTo(wallLength(w)-.7);expect(()=>scene({...w,openings:[result.opening!]})).not.toThrow();}
 });
 it('retains one opening identity and component dimensions while radius, center, height and width change',()=>{
  const p=scene(),w=wall(p),next=updateCurvedWall({...w,height:9},{radius:8,center:[2,3]});for(const o of next.openings!){const before=w.openings!.find(old=>old.id===o.id)!;expect(o.joinery).toEqual(before.joinery);expect((o.offset+o.width/2)/8).toBeCloseTo((before.offset+before.width/2)/6);}
  const edited=editOpening(next,'gate',{width:2.4,height:3.4,archRise:1.1});expect(edited.openings![0].joinery).toEqual(gate.joinery);expect(dragOpening(edited,'gate','move',.3,false).openings![0].id).toBe('gate');expect(edited.openings![1]).toBe(next.openings![1]);expect(()=>applyCommand(p,{type:'replace',entity:edited})).not.toThrow();
 });
 it('previews, cancels, commits and undoes joinery edits without detaching openings or changing wall cuts',()=>{
  const p=scene(),editor=new Editor(p),changed=editOpening(wall(p),'gate',{joinery:{...gate.joinery,frame:{...gate.joinery!.frame!,width:.12}}});editor.begin('Frame');editor.preview({type:'replace',entity:changed});expect(wall(editor.getSnapshot().preview!).openings![0].joinery!.frame!.width).toBe(.12);editor.cancel();expect(editor.getSnapshot().project).toEqual(p);
  editor.execute({type:'replace',entity:changed},'Frame');editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();expect(wall(editor.getSnapshot().project)).toEqual(changed);const empty=editOpening(changed,'gate',{joinery:undefined});expect(empty.openings![0].joinery).toBeUndefined();expect(empty.openings![0].width).toBe(2);
 });
 it('rejects collapsed frames, invalid infill kinds, optical settings and missing materials atomically',()=>{
  const p=scene(),editor=new Editor(p),before=editor.getSnapshot();expect(()=>editOpening(wall(p),'gate',{joinery:{...gate.joinery,frame:{...gate.joinery!.frame!,width:.5}},archRise:.3})).toThrow('frame width');
  for(const joinery of [{glass:defaultOpeningJoinery('window').glass},{panel:{...gate.joinery!.panel!,thickness:NaN}},{frame:{...gate.joinery!.frame!,materialId:'missing'}}])expect(()=>editor.execute({type:'replace',entity:{...wall(p),openings:[{...gate,joinery}] }},'Bad details')).toThrow();expect(editor.getSnapshot()).toBe(before);
  expect(()=>scene({...ring(),openings:[{...window,joinery:{glass:{...window.joinery!.glass!,opacity:2}}}]})).toThrow();
 });
 it('shares material updates and locks with hosted components and remaps materials in whole-wall and opening copies',()=>{
  const shared={...gate,joinery:{frame:{...gate.joinery!.frame!,materialId:'castle-timber'},panel:{...gate.joinery!.panel!,materialId:'castle-timber'}}},p=scene({...ring(),openings:[shared]});expect(architecturalMaterialUsers(p,'castle-timber').map(w=>w.id)).toEqual(['wall']);
  const complete=applyCommand(p,pasteSelection(p,copySelection(p,'wall'),'level','copy').command);expect(wall(complete,'copy-0').openings![0].joinery).toEqual(shared.joinery);const upper=duplicateAbove(p,'level',9,'above').project;expect(upper.entities.filter(e=>e.kind==='wall'&&e.openings?.[0].joinery?.frame?.materialId==='castle-timber')).toHaveLength(2);
  const destination=applyCommand(scene({...ring(),openings:[]}),{type:'architecturalMaterial',material:{...architecturalMaterials(p)[1],color:'#123456'}}),clip=copySelection(p,'wall',[],{wallId:'wall',openingId:'gate'}),copied=pasteSelection(destination,clip,'wall','opening');const result=applyCommand(destination,copied.command);expect(wall(result).openings![0].joinery!.frame!.materialId).toBe('opening-material-0');expect(architecturalMaterials(result).find(m=>m.id==='opening-material-0')!.color).toBe(architecturalMaterials(p)[1].color);
  const locked={...p,layers:p.layers.map(l=>({...l,locked:true}))};expect(()=>applyCommand(locked,{type:'architecturalMaterial',material:{...architecturalMaterials(p)[1],scale:3}})).toThrow('Unlock');
 });
 it('migrates strict format 30 with empty openings unchanged and persists all authored details',async()=>{
  const p=scene(),{joinery,...oldGate}=gate,old={...p,version:30,entities:[level,{...ring(),openings:[oldGate]}]},snapshot=structuredClone(old),upgraded=parseProject(old);expect(upgraded.version).toBe(31);expect(wall(upgraded).openings![0].joinery).toBeUndefined();expect(old).toEqual(snapshot);expect(()=>parseProject({...p,version:30})).toThrow();expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);expect(openingCenter(wall(p),gate)).toEqual(openingCenter(wall(deserializeProject(serializeProject(p))),gate));
 });
});
