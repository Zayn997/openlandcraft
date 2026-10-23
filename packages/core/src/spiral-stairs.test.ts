import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';
import {applyCommand,copySelection,createSite,createSpiralStairs,defaultWallWalk,dragOutline,duplicateAbove,Editor,parseProject,partBounds,pasteSelection,railingRuns,spiralPoint,spiralStairsForTower,spiralTowerDimensions,updateCurvedWall,updateSpiralStairs,type Entity,type Level,type Slab,type Wall} from './index';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[5,3,-4],rotation:33,storeyHeight:8};
const dims={radius:3,width:1.3,rise:6,steps:32,turns:1.5,clockwise:false};
const flight=()=>createSpiralStairs('level',[0,0],[1,0],dims,0,false,'stairs');
const tower=():Wall=>{const w=updateCurvedWall({id:'tower',kind:'wall',parentId:'level',name:'Tower',visible:true,color:'#998877',start:[6,0],end:[6,0],height:8,thickness:.6,elevation:0,curve:{center:[0,0],radius:6,startAngle:0,sweepAngle:360}},{radius:6});return {...w,walk:defaultWallWalk(w)};};
const scene=(...entities:Entity[])=>parseProject({...createSite({name:'Spiral',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,...entities]});
const stair=(p:ReturnType<typeof scene>)=>p.entities.find((e):e is Slab=>e.kind==='slab')!;
const railed=()=>{const s=flight();s.stairs!.railings={height:1.1,spacing:1.2,side:'both'};return s;};

describe('editable spiral stairs',()=>{
  it('creates one parametric flight with outer radius, radial width, height, count, turns and snapped start angle',()=>{
    const s=flight();expect(s.name).toBe('Spiral stairs');expect(s.center).toEqual([0,0]);expect(s.width).toBe(1.3);expect(s.depth).toBe(6);expect(s.stairs!.spiral).toEqual({radius:3,turns:1.5,clockwise:false});expect(spiralPoint(s,0)).toEqual([2.35,0]);expect(spiralPoint(s,1)[0]).toBeCloseTo(-2.35);
    const cw=createSpiralStairs('level',[1,2],[9,4],{...dims,clockwise:true},1,true);expect(cw.stairs!.direction).toBe(15);expect(()=>createSpiralStairs('level',[0,0],[0,0],dims)).toThrow('direction');
  });
  it('edits dimensions and existing railings together without moving the center or baking geometry',()=>{
    const s=railed(),next=updateSpiralStairs(s,{radius:4,width:1.8,rise:7,steps:40,turns:2,clockwise:true,direction:20});expect(next.id).toBe(s.id);expect(next.center).toEqual(s.center);expect(next.depth).toBe(8);expect(next.stairs!.railings).toEqual(s.stairs!.railings);
    const runs=railingRuns(next);expect(runs).toHaveLength(2);for(const run of runs)for(const p of run.posts){expect([2.22,3.98].some(r=>Math.abs(Math.hypot(p.base[0],p.base[2])-r)<1e-8)).toBe(true);expect(p.base[1]).toBeCloseTo(Math.round(p.base[1]/.175)*.175);expect(p.top[1]).toBeGreaterThanOrEqual(p.base[1]+1.1-1e-8);}expect(Math.max(...runs.flatMap(r=>r.top.map(p=>p[1])))).toBeCloseTo(8.1);
    expect((dragOutline(next,'radius',0,[1,0],false) as Slab).stairs!.spiral!.radius).toBe(5);expect((dragOutline(next,'width',0,[0,.2],false) as Slab).width).toBe(1.6);expect((dragOutline(next,'height',0,[.5,0],false) as Slab).stairs!.rise).toBe(7.5);expect((dragOutline(next,'move',0,[2,3],false) as Slab).center).toEqual([2,3]);
  });
  it('rejects invalid inner radius, dimensions, counts, bounds and overlapping turns atomically',()=>{
    const e=new Editor(scene(flight())),before=e.getSnapshot();for(const patch of [{radius:1},{width:0},{rise:.1},{steps:1.5},{steps:6},{turns:4,rise:3},{center:[99,99] as [number,number]}])expect(()=>e.execute({type:'replace',entity:updateSpiralStairs(flight(),patch)},'Invalid')).toThrow();expect(e.getSnapshot()).toBe(before);
    const huge=updateSpiralStairs(railed(),{radius:20,turns:4,rise:20,steps:100});huge.stairs!.railings!.spacing=.2;expect(()=>scene(huge)).toThrow('512');
  });
  it('fits inside a tower and rejects stair or host edits that lose wall, height or railing clearance',()=>{
    const t=tower(),d=spiralTowerDimensions(t),s=spiralStairsForTower(t,d,0,'stairs'),p=scene(t,s);expect(s.center).toEqual(t.curve!.center);expect(s.stairs!.spiral!.radius).toBe(3.95);expect(s.stairs!.spiral!.towerId).toBe(t.id);
    for(const patch of [{radius:5.7},{radius:4.1},{center:[3,0] as [number,number]},{rise:9},{elevation:-1}])expect(()=>applyCommand(p,{type:'replace',entity:updateSpiralStairs(s,patch)})).toThrow();
    expect(()=>applyCommand(p,{type:'replace',entity:{...t,walk:{...t.walk!,width:2.5}}})).toThrow('central well');
    const withRails={...s,stairs:{...s.stairs!,railings:{height:1.1,spacing:1.2,side:'both' as const}}};const p2=applyCommand(p,{type:'replace',entity:withRails});expect(()=>applyCommand(p2,{type:'replace',entity:updateSpiralStairs(withRails,{rise:7})})).toThrow('wall top');expect(()=>applyCommand(p2,{type:'replace',entity:updateCurvedWall(t,{radius:4})})).toThrow('clearance');
    const moved=applyCommand(p2,{type:'replace',entity:updateCurvedWall({...t,elevation:1},{center:[2,3]})});expect(stair(moved).center).toEqual([2,3]);expect(stair(moved).elevation).toBe(1);expect(stair(moved).stairs!.railings).toEqual(withRails.stairs.railings);
    const tiny=updateCurvedWall({...t,walk:undefined},{radius:1}),tinyDefaults=spiralTowerDimensions(tiny);expect(tinyDefaults.width).toBeGreaterThanOrEqual(.5);expect(()=>spiralStairsForTower(tiny,tinyDefaults)).toThrow('clearance');
    const large=updateCurvedWall({...t,walk:undefined},{radius:30});expect(spiralStairsForTower(large,spiralTowerDimensions(large)).stairs!.spiral!.radius).toBe(20);
  });
  it('retains preview, undo/redo, locks and detachment when a tower is deleted',()=>{
    const t=tower(),s=spiralStairsForTower(t,spiralTowerDimensions(t),0,'stairs'),editor=new Editor(scene(t,s)),before=editor.getSnapshot().project,next=updateSpiralStairs(s,{radius:3.5,width:1.4,rise:6});editor.begin('Spiral');editor.preview({type:'replace',entity:next});editor.cancel();expect(editor.getSnapshot().project).toBe(before);editor.execute({type:'replace',entity:next},'Edit spiral');editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(stair(editor.getSnapshot().project)).toEqual(next);
    const detached=applyCommand(before,{type:'remove',id:t.id});expect(stair(detached).stairs!.spiral!.towerId).toBeUndefined();expect(stair(detached).center).toEqual(s.center);const locked=scene(t,s);locked.layers[0].locked=true;expect(()=>applyCommand(locked,{type:'replace',entity:next})).toThrow('Unlock');
  });
  it('copies tower constraints with complete scopes and detaches standalone stair copies',()=>{
    const t=tower(),s=spiralStairsForTower(t,spiralTowerDimensions(t),0,'stairs'),p=scene(t,s),copy=pasteSelection(p,copySelection(p,t.id),'level','copy');const copied=applyCommand(p,copy.command),parts=copied.entities.filter(e=>e.kind==='slab') as Slab[];expect(parts).toHaveLength(2);expect(parts[1].stairs!.spiral!.towerId).not.toBe(t.id);expect(copied.entities.some(e=>e.id===parts[1].stairs!.spiral!.towerId&&e.kind==='wall')).toBe(true);
    const alone=applyCommand(p,pasteSelection(p,copySelection(p,s.id),'level','alone').command);expect((alone.entities.at(-1) as Slab).stairs!.spiral!.towerId).toBeUndefined();
  });
  it('frames exact circle bounds on rotated levels and retains floor duplication parameters',()=>{
    const s=railed(),bounds=partBounds(s,level);expect(bounds.min).toEqual([2,2.8,-7]);expect(bounds.max).toEqual([8,10.1,-1]);const above=duplicateAbove(scene(s),'level',8,'up');expect((above.project.entities.find(e=>e.id==='up-part-0') as Slab).stairs).toEqual(s.stairs);
  });
  it('duplicates a complete tower with its contained spiral and remaps the fit',()=>{
    const t=tower(),s=spiralStairsForTower(t,spiralTowerDimensions(t),0,'stairs'),above=duplicateAbove(scene(t,s),'level',8,'up');
    expect((above.project.entities.find(e=>e.id==='up-part-1') as Slab).stairs!.spiral!.towerId).toBe('up-part-0');
  });
  it('migrates format 26 unchanged and round trips spirals and railings through local and portable files',async()=>{
    const p=scene(),old={...p,version:26},snapshot=structuredClone(old);expect(parseProject(old)).toEqual(p);expect(old).toEqual(snapshot);expect(()=>parseProject({...old,entities:[level,flight()]})).toThrow();const saved=scene(railed());expect(deserializeProject(serializeProject(saved))).toEqual(saved);await saveLocal(saved);expect(await loadLocal()).toEqual(saved);
  });
});
