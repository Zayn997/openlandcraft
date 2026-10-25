import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {applyCommand,conicalRoofForTower,copySelection,createCurvedWall,createSite,createWallChain,defaultWallWalk,duplicateAbove,Editor,parseProject,partBounds,pasteSelection,plantingObstacle,updateCurvedWall,wallWalkContains,wallWalkPlanPoints,wallWalkProfile,type Entity,type Level,type Wall} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',position:[0,3,0],rotation:0,visible:true};
const tower=():Wall=>{const w=createCurvedWall('level','circle',[[0,0],[5,0]],.8,6,false,1,'tower');return {...w,walk:defaultWallWalk(w),battlements:{width:1,height:1.2,spacing:1},openings:[{id:'gate',kind:'door',offset:3,width:2,height:3,sill:0,shape:'arch',archRise:1}]};};
const straight=():Wall=>({...tower(),id:'curtain',name:'Curtain',curve:undefined,start:[-5,-12],end:[5,-12],junctions:undefined,joins:false});
const scene=(...entities:Entity[])=>parseProject({...createSite({name:'Wall walks',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...entities]});
const getWall=(p:ReturnType<typeof scene>,id='tower')=>p.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===id)!;

describe('hosted wall walks and parapets',()=>{
  it('defines a clear inward walk behind the parapet without changing the authored wall top',()=>{
    for(const sweepAngle of [360,-360]){const w=tower();w.curve!.sweepAngle=sweepAngle;const p=wallWalkProfile(w);expect(p.deckTop).toBeCloseTo(4.9);expect(p.bottom).toBeCloseTo(4.65);expect(p.inner-p.parapetInner).toBe(2);expect(p.parapetInner-p.outer).toBeCloseTo(.3);expect(p.side).toBe(Math.sign(sweepAngle));expect(w.height).toBe(6);expect(wallWalkContains(w,[4,0])).toBe(true);expect(wallWalkContains(w,[0,0])).toBe(false);}
  });
  it('switches straight walking sides without moving the supporting wall or changing the clear width',()=>{
    const w=straight(),right={...w,walk:{...w.walk!,side:'right' as const}};expect(wallWalkContains(w,[0,-10.5])).toBe(true);expect(wallWalkContains(w,[0,-13.5])).toBe(false);expect(wallWalkContains(right,[0,-13.5])).toBe(true);expect(right.start).toEqual(w.start);expect(right.end).toEqual(w.end);expect(wallWalkPlanPoints(right)).toContainEqual([-5,-13.9]);
  });
  it('preserves walk sizes, battlements and opening IDs through tower radius/center/profile edits with a linked roof',()=>{
    const w=tower(),r=conicalRoofForTower(w,4,.6,'roof'),editor=new Editor(scene(w,r));editor.execute({type:'replace',entity:{...updateCurvedWall(w,{radius:7,center:[2,-1]}),height:9,elevation:2,thickness:1}},'Tower');const next=getWall(editor.getSnapshot().project);expect(next.walk).toEqual(w.walk);expect(next.battlements).toEqual(w.battlements);expect(next.openings![0].id).toBe('gate');expect(wallWalkProfile(next).deckTop).toBeCloseTo(7.9);const roof=editor.getSnapshot().project.entities.find(e=>e.id==='roof');expect(roof?.kind==='roof'&&roof.elevation).toBe(11);expect(roof?.kind==='roof'&&roof.cone!.radius).toBe(7.5);
  });
  it('follows joined straight-wall length/height edits while preserving each host’s own deck dimensions',()=>{
    const w=tower(),p=scene(w),source=createWallChain(p,'level',[[12,0],[5,0]],false,'branch',false,.4)[0],branch={...source,walk:{...defaultWallWalk(source),width:1.5,thickness:.2}},editor=new Editor(scene(w,branch));editor.execute({type:'replace',entity:{...branch,start:[15,0],height:8}},'Extend curtain');const next=editor.getSnapshot().project;expect(getWall(next).height).toBe(8);expect(getWall(next).walk).toEqual(w.walk);expect(getWall(next,branch.id).walk).toEqual(branch.walk);expect(wallWalkPlanPoints(getWall(next,branch.id)).some(p=>p[0]===15)).toBe(true);
  });
  it('rejects radius collapse, low decks, unsupported thickness, uncovered supports, bounds and opening conflicts atomically',()=>{
    const w=tower(),editor=new Editor(scene(w)),before=editor.getSnapshot();
    for(const candidate of [updateCurvedWall(w,{radius:1.5}),{...w,height:1.2},{...w,walk:{...w.walk!,parapetThickness:1}},{...w,thickness:2,walk:{...w.walk!,width:.5}},{...w,walk:{...w.walk!,thickness:NaN}},{...w,openings:[{...w.openings![0],sill:3}]}])expect(()=>editor.execute({type:'replace',entity:candidate},'Invalid')).toThrow();
    expect(editor.getSnapshot()).toBe(before);
    const nearEdge={...straight(),start:[-5,99] as [number,number],end:[5,99] as [number,number]};expect(()=>scene(nearEdge)).toThrow('±100');
    const locked=scene(w);locked.layers[0].locked=true;expect(()=>applyCommand(locked,{type:'replace',entity:{...w,walk:undefined}})).toThrow('Unlock');
  });
  it('previews/cancels and edits/removes in single undo steps without removing other wall features',()=>{
    const w=tower(),editor=new Editor(scene(w)),before=editor.getSnapshot().project,next={...w,walk:{...w.walk!,width:2.5,thickness:.4}};editor.begin('Walk');editor.preview({type:'replace',entity:next});expect(getWall(editor.getSnapshot().preview!).walk!.width).toBe(2.5);editor.cancel();expect(editor.getSnapshot().project).toBe(before);
    editor.execute({type:'replace',entity:next},'Walk');expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();editor.execute({type:'replace',entity:{...getWall(editor.getSnapshot().project),walk:undefined}},'Remove walk');expect(getWall(editor.getSnapshot().project).battlements).toEqual(w.battlements);expect(getWall(editor.getSnapshot().project).openings).toEqual(w.openings);editor.undo();expect(getWall(editor.getSnapshot().project).walk).toEqual(next.walk);
  });
  it('retains hosted walk parameters in copies and duplicated storeys, without extra entities',()=>{
    const p=scene(tower()),copied=applyCommand(p,pasteSelection(p,copySelection(p,'tower'),'level','copy').command),walls=copied.entities.filter((e):e is Wall=>e.kind==='wall');expect(walls).toHaveLength(2);expect(walls[1].walk).toEqual(walls[0].walk);const upper=duplicateAbove(p,'level',8,'upper');expect(getWall(upper.project,'upper-part-0').walk).toEqual(tower().walk);
  });
  it('includes deck projections in rotated framing and planting clearance',()=>{
    const w=straight(),l={...level,position:[4,3,-2] as [number,number,number],rotation:37},box=partBounds(w,l),angle=37*Math.PI/180;for(const [x,z] of wallWalkPlanPoints(w,37)){const px=4+x*Math.cos(angle)+z*Math.sin(angle),pz=-2-x*Math.sin(angle)+z*Math.cos(angle);expect(px).toBeGreaterThanOrEqual(box.min[0]);expect(px).toBeLessThanOrEqual(box.max[0]);expect(pz).toBeGreaterThanOrEqual(box.min[2]);expect(pz).toBeLessThanOrEqual(box.max[2]);}
    const p=scene(w),blocked=plantingObstacle(p,{clearance:0,exclusions:{water:false,paths:false,buildings:true}});expect(blocked(0,-10.5)).toBe(true);expect(blocked(0,-9)).toBe(false);
    const ringBlocked=plantingObstacle(scene(tower()),{clearance:0,exclusions:{water:false,paths:false,buildings:true}});expect(ringBlocked(4,0)).toBe(true);expect(ringBlocked(0,0)).toBe(false);
  });
  it('migrates format 23 without adding walks and retains walks in local and portable saving',async()=>{
    const w=tower(),p=scene(w),{walk,...oldWall}=w,old={...p,version:23,entities:[level,oldWall]},snapshot=structuredClone(old);expect(parseProject(old).version).toBe(39);expect(parseProject(old).entities).toEqual([level,oldWall]);expect(old).toEqual(snapshot);expect(()=>parseProject({...old,entities:[level,w]})).toThrow();expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);
  });
});
