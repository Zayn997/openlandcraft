import { defaultLayers } from './layers';
import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import legacy from '../../../examples/landscape-regions.olc.json';
import {Editor,createSite,createBuilding,createWallChain,parseProject,outlineIssue,snapWallPoint,type Wall,type Slab,type Level} from './index';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';

function scene(){const p=createSite({name:'Architecture',width:60,depth:60,resolution:129,preset:'flat'});return parseProject({...p,entities:createBuilding(p,0,0,10,8,'house')});}
const firstWall=(p=scene())=>p.entities.find((e):e is Wall=>e.kind==='wall')!;
const opening={id:'door',kind:'door' as const,offset:1,width:0.9,height:2.1,sill:0};
describe('M7 architectural editing',()=>{
  it('migrates v11 without mutating terrain, water, planting, or embedded sources',()=>{
    const before=structuredClone(legacy);expect(parseProject(legacy)).toEqual({...legacy,version:14,layers:defaultLayers(),objectLayers:{},activeLayerId:"default"});expect(legacy).toEqual(before);
    const p=scene(),w=firstWall(p);expect(()=>parseProject({...p,version:11,entities:p.entities.map(e=>e.id===w.id?{...w,openings:[opening]}:e)})).toThrow();
  });
  it('preserves independent legacy walls, including mixed profiles, until joining is explicitly enabled',()=>{
    const current=scene(),{layers,objectLayers,activeLayerId,...p}=current,entities=p.entities.map(e=>{if(e.kind!=='wall')return e;const {joins,...old}=e;return {...old,height:e.id===firstWall(current).id?4:3.2};});
    const migrated=parseProject({...p,version:11,entities});expect(migrated.entities).toEqual(entities);
    const editor=new Editor(migrated),wall=firstWall(migrated);
    editor.execute({type:'replace',entity:{...wall,end:[6,-4]}},'Independent');
    expect(editor.getSnapshot().project.entities.filter(e=>e.kind==='wall'&&e.start[0]===6)).toHaveLength(0);
    editor.undo();editor.execute({type:'replace',entity:{...wall,joins:true}},'Join');
    expect(editor.getSnapshot().project.entities.filter(e=>e.kind==='wall').every(e=>e.joins&&e.height===4)).toBe(true);
    editor.undo();expect(editor.getSnapshot().project).toEqual(migrated);
  });
  it('moves joined endpoints atomically while keeping opening offsets; profile changes traverse the chain',()=>{
    const editor=new Editor(scene()),w=firstWall();editor.execute({type:'replace',entity:{...w,openings:[opening]}},'Door');const before=editor.getSnapshot().project;
    const wall=firstWall(before);editor.begin('Corner');editor.preview({type:'replace',entity:{...wall,end:[6,-4]}});
    expect(firstWall(editor.getSnapshot().project).end).toEqual([5,-4]);
    expect(editor.getSnapshot().preview!.entities.filter(e=>e.kind==='wall'&&(e.start[0]===6||e.end[0]===6))).toHaveLength(2);
    expect(firstWall(editor.getSnapshot().preview!).openings).toEqual([opening]);editor.commit();editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();
    editor.execute({type:'replace',entity:{...firstWall(editor.getSnapshot().project),height:4}},'Height');
    expect(editor.getSnapshot().project.entities.filter(e=>e.kind==='wall').every(w=>w.height===4)).toBe(true);
  });
  it('rejects clipped and overlapping cuts, wrong door sill, duplicate IDs, and short hosts without losing valid state',()=>{
    const editor=new Editor(scene()),w={...firstWall(),openings:[opening]};editor.execute({type:'replace',entity:w},'Door');const before=editor.getSnapshot();
    const variants:Wall[]=[{...w,end:[-3,-4]},{...w,height:2},{...w,openings:[{...opening,sill:1}]},{...w,openings:[opening,{...opening,id:'overlap',offset:1.5}]},{...w,openings:[opening,opening]}];
    for(const entity of variants){expect(()=>editor.execute({type:'replace',entity},'Invalid')).toThrow();expect(editor.getSnapshot()).toBe(before);}
    editor.begin('Preview');expect(()=>editor.preview({type:'replace',entity:{...w,openings:[{...opening,width:20}]}})).toThrow();expect(editor.getSnapshot().project).toBe(before.project);editor.cancel();
  });
  it('removes hosted cuts with the wall or level and restores them with undo; saves committed parameters only',async()=>{
    const editor=new Editor(scene());editor.execute({type:'replace',entity:{...firstWall(),openings:[opening]}},'Door');const before=editor.getSnapshot().project;
    editor.execute({type:'remove',id:firstWall().id},'Delete wall');editor.undo();expect(editor.getSnapshot().project).toEqual(before);
    editor.execute({type:'remove',id:'house'},'Delete building');expect(editor.getSnapshot().project.entities).toHaveLength(0);editor.undo();
    const restored=deserializeProject(serializeProject(editor.getSnapshot().project));expect(restored).toEqual(before);await saveLocal(restored);expect(await loadLocal()).toEqual(before);
    const field=structuredClone(before.site.terrain);field.heights=field.heights.map(v=>v+1);editor.execute({type:'terrain',field},'Sculpt');expect(editor.getSnapshot().project.entities).toEqual(before.entities);
  });
  it('creates snapped open and closed chains in one undo step, with inherited corner profiles',()=>{
    const p=scene();expect(snapWallPoint([-4.8,-3.9],[firstWall(p)])).toEqual([-5,-4]);
    const chain=createWallChain(p,'house',[[12,0],[18,0],[18,5],[12,5]],true,'wing');const editor=new Editor(p);editor.execute({type:'insert',entities:chain},'Wing');expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(p);
    expect(()=>editor.execute({type:'insert',entities:createWallChain(p,'house',[[-5,-4],[-10,-4]],false)},'T junction')).toThrow('two walls');
  });
  it('accepts concave floors and flat roof outlines; rejects crossings, backtracking and degenerate areas',()=>{
    const outline:Slab['outline']=[[-5,-4],[5,-4],[5,0],[0,0],[0,4],[-5,4]];
    expect(outlineIssue(outline)).toBeNull();expect(outlineIssue([...outline].reverse())).toBeNull();
    for(const points of [[[0,0],[4,4],[0,4],[4,0]],[[0,0],[4,0],[2,0],[2,3],[0,3]],[[0,0],[0.1,0],[0,0.1]]] as [number,number][][])expect(outlineIssue(points)).toBeTruthy();
    const p=scene();expect(parseProject({...p,entities:p.entities.map(e=>e.kind==='slab'||e.kind==='roof'?{...e,outline}:e)}).entities.filter(e=>(e.kind==='slab'||e.kind==='roof')&&e.outline)).toHaveLength(2);
  });
});
