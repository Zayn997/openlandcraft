import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,loadLocal,saveLocal} from '@openlandcraft/project';
import {applyCommand,conicalRoofForTower,copySelection,createConicalRoof,createCurvedWall,createSite,dragOutline,duplicateAbove,Editor,flatRoofOutline,footprint,parseProject,partBounds,pasteSelection,plantingObstacle,roofEavesRadius,setConicalRoofTower,snapRoofDrawingPoint,updateConicalRoof,withOutline,type Level,type Roof,type Wall} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',visible:true,name:'Tower',position:[8,3,-6],rotation:37};
const tower=():Wall=>({...createCurvedWall(level.id,'circle',[[0,0],[4.5,0]],.6,6,false,2,'tower'),openings:[{id:'gate',kind:'door',offset:3,width:2,height:3,sill:0,shape:'arch',archRise:1}]});
const roof=()=>setConicalRoofTower(conicalRoofForTower(tower(),4,.5,'roof'),null);
const scene=(...entities:(Wall|Roof)[])=>parseProject({...createSite({name:'Conical roofs',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...entities]});

describe('editable conical roofs in the shared roof model',()=>{
  it('draws one roof from a center and supporting radius, with separate height and overhang',()=>{
    const r=createConicalRoof(level.id,[[2,3],[5,3]],4,.5,8,'roof');expect(r.cone).toEqual({radius:3,overhang:.5});expect(r.center).toEqual([2,3]);expect(r.width).toBe(7);expect(r.depth).toBe(7);expect(r.rise).toBe(4);expect(r.elevation).toBe(8);expect(r.outline).toBeUndefined();expect(scene(r).entities.filter(e=>e.kind==='roof')).toHaveLength(1);
    const snapped=snapRoofDrawingPoint([3.13,4],[[0,0]],true);expect(Math.hypot(...snapped)*4).toBeCloseTo(Math.round(Math.hypot(...snapped)*4));expect(snapRoofDrawingPoint([.12,.31],[],true)).toEqual([0,.25]);
  });
  it('fits a circular wall outer face and top without replacing its joins or arched openings',()=>{
    const wall=tower(),before=structuredClone(wall),r=conicalRoofForTower(wall,4,.5,'roof');expect(r.cone!.radius).toBeCloseTo(4.8);expect(roofEavesRadius(r)).toBeCloseTo(5.3);expect(r.elevation).toBe(8);expect(r.center).toEqual(wall.curve!.center);expect(wall).toEqual(before);
    expect(()=>conicalRoofForTower(createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.3,4),4,.5)).toThrow('circular');
  });
  it('edits radius, height and overhang independently with one-step undo and portable/local reopening',async()=>{
    const r=roof(),wall=tower(),editor=new Editor(scene(wall,r)),before=editor.getSnapshot().project;
    const next=updateConicalRoof(r,{radius:6,rise:5,overhang:1,center:[1,-2]});editor.execute({type:'replace',entity:next},'Edit conical roof');const saved=editor.getSnapshot().project;
    expect(saved.entities.find(e=>e.id===wall.id)).toEqual(wall);expect(next.id).toBe(r.id);expect(next.width).toBe(14);expect(next.depth).toBe(14);expect(next.elevation).toBe(8);
    expect(deserializeProject(serializeProject(saved))).toEqual(saved);await saveLocal(saved);expect(await loadLocal()).toEqual(saved);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(editor.getSnapshot().project).toEqual(saved);
    expect(updateConicalRoof(next,{overhang:2}).cone!.radius).toBe(6);expect(updateConicalRoof(next,{rise:7}).cone).toEqual(next.cone);
  });
  it('uses the existing outline gesture transactions for movement and all three conical handles',()=>{
    const r=roof(),moved=dragOutline(r,'move',0,[.6,-.4],true) as Roof;expect(moved.center).toEqual([.5,-.5]);
    expect((dragOutline(r,'radius',0,[1,0],false) as Roof).cone!.radius).toBeCloseTo(5.8);expect((dragOutline(r,'height',0,[1.1,0],true) as Roof).rise).toBe(5);expect((dragOutline(r,'overhang',0,[0,.5],false) as Roof).cone!.overhang).toBeCloseTo(1);
    expect(()=>dragOutline(r,'vertex',0,[1,1],false)).toThrow('conical');expect(()=>withOutline(r,[[0,0],[4,0],[0,4]])).toThrow('conical');expect(()=>flatRoofOutline(r)).toThrow('conical');
    const editor=new Editor(scene(r));editor.begin('Resize');editor.preview({type:'replace',entity:dragOutline(r,'height',0,[2,0],false)});editor.cancel();expect(editor.getSnapshot().project.entities.find(e=>e.id===r.id)).toEqual(r);expect(editor.getSnapshot().past).toHaveLength(0);
  });
  it('rejects inconsistent dimensions, invalid radii, nonfinite values and out-of-bounds eaves atomically',()=>{
    const r=roof(),editor=new Editor(scene(r)),before=editor.getSnapshot();
    for(const bad of [{...r,cone:{radius:0,overhang:.5}},{...r,width:30},{...r,cone:{radius:5,overhang:-1}},{...r,rise:NaN},{...r,outline:[[0,0],[4,0],[0,4]] as [number,number][]}]){expect(()=>editor.execute({type:'replace',entity:bad},'Invalid')).toThrow();expect(editor.getSnapshot()).toBe(before);}
    expect(()=>updateConicalRoof(r,{radius:99,overhang:2})).toThrow('eaves');expect(()=>updateConicalRoof(r,{center:[98,0]})).toThrow('eaves');expect(()=>createConicalRoof(level.id,[[0,0],[0,0]],4,.5,8)).toThrow('radius');
  });
  it('preserves cone parameters when copying across rotated levels and carries the roof above a copied storey',()=>{
    const r=roof(),p=scene(tower(),r),copy=pasteSelection(p,copySelection(p,r.id),r.id,'copy',0,{worldDelta:[3,2],snapping:false}),next=applyCommand(p,copy.command),copied=next.entities.find((e):e is Roof=>e.kind==='roof'&&e.id===copy.selectedIds[0])!;
    expect(copied.cone).toEqual(r.cone);expect(copied.rise).toBe(r.rise);const angle=level.rotation*Math.PI/180;expect(copied.center[0]).toBeCloseTo(3*Math.cos(angle)-2*Math.sin(angle));
    const upper=duplicateAbove(p,level.id,6,'upper'),carried=upper.project.entities.find((e):e is Roof=>e.kind==='roof'&&e.id===r.id)!;expect(carried.parentId).toBe(upper.levelId);expect(carried.cone).toEqual(r.cone);expect(carried.elevation).toBe(r.elevation);
  });
  it('uses exact circular world bounds and circular planting clearance, including the overhang',()=>{
    const r=roof(),p=scene(r),bounds=partBounds(r,level);expect(bounds.min).toEqual([2.7,11,-11.3]);expect(bounds.max).toEqual([13.3,15,-.7000000000000002]);
    expect(footprint(r)).toHaveLength(120);const blocked=plantingObstacle(p,{clearance:0,exclusions:{water:false,paths:false,buildings:true}});expect(blocked(8,-6)).toBe(true);expect(blocked(13.2,-6)).toBe(true);expect(blocked(13.4,-6)).toBe(false);expect(blocked(12.8,-1.2)).toBe(false);
  });
  it('migrates format 20 without changing authored roofs or openings and rejects cone fields in old files',()=>{
    const flat:Roof={id:'flat',kind:'roof',name:'Flat',parentId:level.id,visible:true,color:'#667869',center:[0,0],width:8,depth:8,elevation:8,rise:.2,outline:[[-4,-4],[4,-4],[4,4],[-4,4]]},p=scene(tower(),flat),legacy={...p,version:20},snapshot=structuredClone(legacy);
    expect(parseProject(legacy)).toEqual({...p,version:31});expect(legacy).toEqual(snapshot);expect(()=>parseProject({...legacy,entities:[level,roof()]})).toThrow();
  });
  it('honors the existing layer locks for roof edits and leaves other objects untouched',()=>{
    const p=scene(tower(),roof());p.layers.push({id:'locked',name:'Locked',visible:true,locked:true,parentId:null,color:'#333333'});p.objectLayers.roof='locked';const editor=new Editor(p),before=editor.getSnapshot();
    expect(()=>editor.execute({type:'replace',entity:updateConicalRoof(roof(),{rise:5})},'Locked')).toThrow('Unlock');expect(editor.getSnapshot()).toBe(before);
  });
});
