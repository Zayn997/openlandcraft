import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {applyCommand,copySelection,createSite,createStairs,DEFAULT_STAIRS,dragOutline,duplicateAbove,Editor,footprint,parseProject,partBounds,pasteSelection,plantingObstacle,stairEndpoints,updateStairs,withOutline,type Entity,type Level,type Slab} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[10,3,-7],rotation:37,storeyHeight:3.4};
const flight=()=>createStairs(level.id,[0,0],[10,0],DEFAULT_STAIRS,1,false,'stairs');
const scene=(...entities:Entity[])=>parseProject({...createSite({name:'Stairs',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...entities]});
const get=(p:ReturnType<typeof scene>,id='stairs')=>p.entities.find((e):e is Slab=>e.kind==='slab'&&e.id===id)!;

describe('editable straight stairs',()=>{
  it('creates a single flight with exact lower/upper anchors, total dimensions and bounded snapped direction',()=>{
    const s=flight();expect(s.name).toBe('Straight stairs');expect(s.parentId).toBe(level.id);expect(stairEndpoints(s)).toEqual({start:[0,0],end:[5.6,0]});expect(s.stairs).toEqual({rise:3.4,steps:18,direction:0});expect(s.width).toBe(1.5);
    const snapped=createStairs('level',[1,2],[10,4],DEFAULT_STAIRS,0,true);expect(snapped.stairs!.direction).toBe(15);expect(stairEndpoints(snapped).start).toEqual([1,2]);expect(()=>createStairs('level',[0,0],[0,0],DEFAULT_STAIRS)).toThrow('direction');
  });
  it('edits all stair dimensions without moving the lower start or baking the steps',()=>{
    const s=flight(),next=updateStairs(s,{width:2,rise:4,run:8,steps:20,direction:90,elevation:2,thickness:.3});expect(stairEndpoints(next).start[0]).toBeCloseTo(0);expect(stairEndpoints(next).start[1]).toBeCloseTo(0);expect(stairEndpoints(next).end[1]).toBeCloseTo(8);expect(next.stairs).toEqual({rise:4,steps:20,direction:90});expect(next.id).toBe(s.id);expect(next.elevation+next.stairs!.rise).toBe(6);
  });
  it('shares movement and Run, Width and Rise gesture transactions',()=>{
    const s=flight(),moved=dragOutline(s,'move',0,[1,2],false) as Slab;expect(stairEndpoints(moved).start).toEqual([1,2]);const resized=dragOutline(s,'run',0,[1,2],false) as Slab;expect(stairEndpoints(resized).start[0]).toBeCloseTo(0);expect(stairEndpoints(resized).end[0]).toBeCloseTo(6.6);expect(stairEndpoints(resized).end[1]).toBeCloseTo(2);expect((dragOutline(s,'width',0,[0,.5],false) as Slab).width).toBe(2.5);expect((dragOutline(s,'height',0,[.6,0],true) as Slab).stairs!.rise).toBe(4);
    expect(()=>dragOutline(s,'edge',0,[1,0],false)).toThrow('stair');expect(()=>withOutline(s,footprint(s))).toThrow('straight stairs');
  });
  it('rejects fractional counts, excessive detail, invalid dimensions, outlines and out-of-bounds flights atomically',()=>{
    const editor=new Editor(scene(flight())),before=editor.getSnapshot();for(const patch of [{steps:1.5},{width:0},{run:41},{rise:0},{run:.5,steps:128},{start:[99,99] as [number,number]},{direction:NaN}])expect(()=>editor.execute({type:'replace',entity:updateStairs(flight(),patch)},'Invalid')).toThrow();expect(()=>applyCommand(before.project,{type:'replace',entity:{...flight(),outline:[[0,0],[3,0],[0,3]]}})).toThrow('outline');expect(editor.getSnapshot()).toBe(before);
  });
  it('keeps preview/cancel and single-step commit/undo/redo in the existing editor pipeline',()=>{
    const editor=new Editor(scene(flight())),before=editor.getSnapshot().project,next=updateStairs(flight(),{rise:4,run:7,steps:20});editor.begin('Stair preview');editor.preview({type:'replace',entity:next});expect(get(editor.getSnapshot().preview!).stairs!.steps).toBe(20);editor.cancel();expect(editor.getSnapshot().project).toBe(before);editor.execute({type:'replace',entity:next},'Stairs');expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(get(editor.getSnapshot().project)).toEqual(next);
  });
  it('copies and duplicates floors with parametric stairs and respects layer locks',()=>{
    const s=flight(),p=scene(s),copy=applyCommand(p,pasteSelection(p,copySelection(p,s.id),'level','copy').command),parts=copy.entities.filter((e):e is Slab=>e.kind==='slab');expect(parts).toHaveLength(2);expect(parts[1].stairs).toEqual(s.stairs);expect(parts[1].id).not.toBe(s.id);const above=duplicateAbove(p,'level',3.4,'upper');expect(get(above.project,'upper-part-0').stairs).toEqual(s.stairs);expect(()=>duplicateAbove(p,'level',2,'low')).toThrow('at least');p.layers[0].locked=true;expect(()=>applyCommand(p,{type:'replace',entity:updateStairs(s,{width:2})})).toThrow('Unlock');
  });
  it('frames rotated stair heights/footprints and reserves their footprint for planting',()=>{
    const s=updateStairs(flight(),{direction:45}),bounds=partBounds(s,level);expect(bounds.min[1]).toBeCloseTo(3.8);expect(bounds.max[1]).toBeCloseTo(7.4);const a=37*Math.PI/180;for(const [x,z] of footprint(s)){const px=10+x*Math.cos(a)+z*Math.sin(a),pz=-7-x*Math.sin(a)+z*Math.cos(a);expect(px).toBeGreaterThanOrEqual(bounds.min[0]-1e-8);expect(px).toBeLessThanOrEqual(bounds.max[0]+1e-8);expect(pz).toBeGreaterThanOrEqual(bounds.min[2]-1e-8);expect(pz).toBeLessThanOrEqual(bounds.max[2]+1e-8);}
    const p=scene(s),origin={...level,position:[0,0,0] as [number,number,number],rotation:0};p.entities[0]=origin;const blocked=plantingObstacle(p,{clearance:0,exclusions:{water:false,paths:false,buildings:true}});expect(blocked(s.center[0],s.center[1])).toBe(true);expect(blocked(10,-10)).toBe(false);
  });
  it('migrates format 24 unchanged and retains stair parameters in portable and local saving',async()=>{
    const p=scene(),old={...p,version:24},before=structuredClone(old);expect(parseProject(old)).toEqual(p);expect(old).toEqual(before);expect(()=>parseProject({...old,entities:[level,flight()]})).toThrow();const stairs=scene(flight());expect(deserializeProject(serializeProject(stairs))).toEqual(stairs);await saveLocal(stairs);expect(await loadLocal()).toEqual(stairs);
  });
});
