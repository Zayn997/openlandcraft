import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {applyCommand,conicalRoofForTower,copySelection,createCurvedWall,createSite,createWallChain,dragOutline,duplicateAbove,Editor,parseProject,pasteSelection,setConicalRoofTower,updateConicalRoof,updateCurvedWall,type Entity,type Level,type Roof,type Wall} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Tower',position:[5,3,-6],rotation:37,visible:true};
const tower=():Wall=>({...createCurvedWall(level.id,'circle',[[0,0],[4,0]],.6,6,false,1,'wall'),openings:[{id:'gate',kind:'door',offset:3,width:2,height:3,sill:0,shape:'arch',archRise:1}]});
const roof=()=>conicalRoofForTower(tower(),4,.5,'roof');
const scene=(...entities:Entity[])=>parseProject({...createSite({name:'Tower roof follow',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...entities]});
const getRoof=(p:ReturnType<typeof scene>,id='roof')=>p.entities.find((e):e is Roof=>e.kind==='roof'&&e.id===id)!;
const getWall=(p:ReturnType<typeof scene>,id='wall')=>p.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===id)!;

describe('persistent circular tower roof attachments',()=>{
  it('fitted roofs follow radius, thickness, center, wall height and base without changing roof height or overhang',()=>{
    const wall=tower(),r=roof(),editor=new Editor(scene(wall,r));expect(r.cone!.wallId).toBe(wall.id);
    const changed={...updateCurvedWall(wall,{radius:6,center:[2,-1]}),height:9,elevation:2,thickness:1};editor.execute({type:'replace',entity:changed},'Resize tower');
    const next=getRoof(editor.getSnapshot().project);expect(next.id).toBe(r.id);expect(next.cone).toEqual({wallId:wall.id,radius:6.5,overhang:.5});expect(next.center).toEqual([2,-1]);expect(next.elevation).toBe(11);expect(next.rise).toBe(4);expect(next.width).toBe(14);expect(getWall(editor.getSnapshot().project).openings![0].id).toBe('gate');
  });
  it('edits roof height and overhang independently and rejects direct or gesture edits to tower-controlled geometry',()=>{
    const r=roof(),p=scene(tower(),r),next=updateConicalRoof(r,{rise:7,overhang:1.2}),saved=applyCommand(p,{type:'replace',entity:next});expect(getRoof(saved).cone!.wallId).toBe('wall');expect(getWall(saved)).toEqual(tower());
    for(const mode of ['move','radius'] as const)expect(()=>dragOutline(r,mode,0,[1,0],false)).toThrow('detach');
    expect((dragOutline(r,'height',0,[1,0],false) as Roof).rise).toBe(5);expect((dragOutline(r,'overhang',0,[0,.5],false) as Roof).cone!.overhang).toBeCloseTo(1);
    expect(()=>updateConicalRoof(r,{radius:7})).toThrow('Detach');expect(()=>applyCommand(p,{type:'replace',entity:{...r,elevation:8}})).toThrow('Detach');
  });
  it('previews/cancels and commits a tower plus its roof in one undo/redo step, including local and portable reopening',async()=>{
    const wall=tower(),editor=new Editor(scene(wall,roof())),before=editor.getSnapshot().project,next=updateCurvedWall(wall,{radius:5});
    editor.begin('Resize');editor.preview({type:'replace',entity:next});expect(getRoof(editor.getSnapshot().preview!).cone!.radius).toBeCloseTo(5.3);expect(editor.getSnapshot().project).toBe(before);editor.cancel();expect(editor.getSnapshot().past).toHaveLength(0);
    editor.execute({type:'replace',entity:{...next,height:8}},'Resize');const saved=editor.getSnapshot().project;expect(editor.getSnapshot().past).toHaveLength(1);expect(getRoof(saved).elevation).toBe(9);await saveLocal(saved);expect(await loadLocal()).toEqual(saved);expect(deserializeProject(serializeProject(saved))).toEqual(saved);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(editor.getSnapshot().project).toEqual(saved);
  });
  it('attaches existing independent roofs, detaches at the current fit and lets them be edited freely again',()=>{
    const wall=tower(),independent=setConicalRoofTower(roof(),null),p=scene(wall,independent),attached=applyCommand(p,{type:'replace',entity:setConicalRoofTower(independent,wall)});expect(getRoof(attached).cone!.wallId).toBe(wall.id);
    const detached=setConicalRoofTower(getRoof(attached),null);expect(detached.center).toEqual(independent.center);expect(detached.elevation).toBe(independent.elevation);const next=applyCommand(attached,{type:'replace',entity:detached}),resized=applyCommand(next,{type:'replace',entity:updateCurvedWall(wall,{radius:6})});expect(getRoof(resized)).toEqual(detached);expect(()=>updateConicalRoof(detached,{radius:6,elevation:8,center:[1,2]})).not.toThrow();
  });
  it('follows profile changes propagated through a joined straight wall, with opening and wall IDs intact',()=>{
    const wall=tower(),r=roof(),p=scene(wall,r),branch=createWallChain(p,level.id,[[9,0],[4,0]],false,'branch',false,.2)[0],editor=new Editor(scene(wall,r,branch));editor.execute({type:'replace',entity:{...branch,height:8,elevation:2}},'Joined height');const next=editor.getSnapshot().project;expect(getRoof(next).elevation).toBe(10);expect(getRoof(next).rise).toBe(4);expect(getWall(next).height).toBe(8);expect(getWall(next).openings).toEqual(wall.openings);
  });
  it('copies the roof with its tower and remaps the link; a roof-only copy detaches instead of following the original',()=>{
    const p=scene(tower(),roof()),clipboard=copySelection(p,'wall');expect(clipboard.kind==='entities'&&clipboard.entities.map(e=>e.id)).toEqual(['wall','roof']);
    const copy=applyCommand(p,pasteSelection(p,clipboard,'level','copy',0,{worldDelta:[14,0],snapping:false}).command),r=copy.entities.find((e):e is Roof=>e.kind==='roof'&&e.id!=='roof')!,w=copy.entities.find((e):e is Wall=>e.kind==='wall'&&e.id!=='wall')!;expect(r.cone!.wallId).toBe(w.id);
    const next=applyCommand(copy,{type:'replace',entity:updateCurvedWall(w,{radius:5})});expect(getRoof(next,r.id).cone!.radius).toBeCloseTo(5.3);expect(getRoof(next)).toEqual(roof());
    const only=applyCommand(p,pasteSelection(p,copySelection(p,'roof'),'level','roof-copy').command);expect(getRoof(only,'roof-copy-0').cone!.wallId).toBeUndefined();
  });
  it('carries the roof to the new tower wall when duplicating a storey',()=>{
    const p=scene(tower(),roof()),upper=duplicateAbove(p,'level',6,'upper'),next=parseProject(upper.project),r=getRoof(next),w=getWall(next,r.cone!.wallId);expect(r.parentId).toBe(upper.levelId);expect(w.parentId).toBe(upper.levelId);expect(w.id).not.toBe('wall');expect(r.rise).toBe(4);expect(r.cone!.overhang).toBe(.5);
    const resized=applyCommand(next,{type:'replace',entity:{...w,height:8}});expect(getRoof(resized).elevation).toBe(9);expect(getWall(resized).height).toBe(6);
  });
  it('preserves the roof when its tower is deleted, undo restores the link, and invalid host shapes reject atomically',()=>{
    const wall=tower(),editor=new Editor(scene(wall,roof())),before=editor.getSnapshot().project;editor.execute({type:'remove',id:wall.id},'Delete tower');const r=getRoof(editor.getSnapshot().project);expect(r.cone!.wallId).toBeUndefined();expect(r.center).toEqual(roof().center);editor.undo();expect(editor.getSnapshot().project).toEqual(before);
    const arc={...wall,curve:{...wall.curve!,sweepAngle:180},end:[-4,0] as [number,number]};expect(()=>editor.execute({type:'replace',entity:arc},'Change host')).toThrow('circular');expect(editor.getSnapshot().project).toEqual(before);
  });
  it('rejects tower edits if their roof would exceed bounds or its layer is locked, without partial updates',()=>{
    const wall=tower(),p=scene(wall,roof()),editor=new Editor(p),before=editor.getSnapshot();expect(()=>editor.execute({type:'replace',entity:{...wall,height:30,elevation:15}},'Too high')).toThrow();expect(editor.getSnapshot()).toBe(before);
    p.layers.push({id:'locked',name:'Locked',visible:true,locked:true,parentId:null,color:'#333333'});p.objectLayers.roof='locked';const locked=new Editor(p),snapshot=locked.getSnapshot();expect(()=>locked.execute({type:'replace',entity:updateCurvedWall(wall,{radius:5})},'Locked roof')).toThrow('Unlock');expect(locked.getSnapshot()).toBe(snapshot);expect(()=>locked.execute({type:'remove',id:wall.id},'Delete host')).toThrow('Unlock');
  });
  it('leaves format-21 roofs independent and rejects missing, cross-level or inconsistent persisted host references',()=>{
    const independent=setConicalRoofTower(roof(),null),p=scene(tower(),independent),old={...p,version:21},snapshot=structuredClone(old);expect(parseProject(old)).toEqual({...p,version:33});expect(old).toEqual(snapshot);
    expect(()=>parseProject({...old,entities:[level,tower(),roof()]})).toThrow();expect(()=>scene({...roof(),cone:{...roof().cone!,wallId:'missing'}})).toThrow('circular');expect(()=>scene(tower(),{...roof(),elevation:8})).toThrow('follow');
    const other:Level={...level,id:'other'};expect(()=>parseProject({...p,entities:[level,other,tower(),{...roof(),parentId:'other'}]})).toThrow('same level');
  });
});
