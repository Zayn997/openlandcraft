import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {createSite,createRegion,createDrawnPath,createLake,createOcean,Editor,evaluateProject,parseProject,applyCommand,copySelection,pasteSelection,createStairs,DEFAULT_STAIRS,connectStairBottom,type MaterialRegion,type Path,type Level,type Slab} from './index';
import {terrainTriangleHeight,surfaceElevationAt,type PathPoint} from '@openlandcraft/landscape';
import {serializeProject,deserializeProject,saveLocal,loadLocal} from '@openlandcraft/project';

const scene=()=>createSite({name:'Site grades',width:60,depth:60,resolution:129,preset:'flat'});
const court=(elevation=4):MaterialRegion=>({...createRegion(scene(),'courtyard',[[-5,-5],[5,-5],[5,5],[-5,5]]),elevationMode:'graded',elevation,gradingWidth:3}) as MaterialRegion;
const path=(elevationMode:Path['elevationMode']='fixed'):Path=>({...createDrawnPath(scene(),[[-15,12],[15,12]],{width:3,surface:'paving'}),elevationMode,elevation:3,endElevation:6,...(elevationMode==='graded'?{gradingWidth:3}:{})});
describe('fixed elevations and editable terrain grading',()=>{
  it('keeps a sloping fixed path and level fixed courtyard independent of terrain through redraw, copying and save/open',async()=>{
    const p=scene(),walk=path(),c={...court(),elevationMode:'fixed' as const,gradingWidth:undefined};
    const authored=parseProject({...p,entities:[walk,c]}),evaluated=evaluateProject(authored);
    expect(evaluated.site.terrain).toBe(authored.site.terrain);expect(surfaceElevationAt(walk,p.site,[-15,12])).toBe(3);expect(surfaceElevationAt(walk,p.site,[0,12])).toBe(4.5);expect(surfaceElevationAt(c,p.site,[2,1])).toBe(4);
    const redrawn=createDrawnPath(authored,[[-12,10],[12,10]],walk,walk.id);expect(redrawn).toMatchObject({id:walk.id,elevationMode:'fixed',elevation:3,endElevation:6});
    const copied=applyCommand(authored,pasteSelection(authored,copySelection(authored,walk.id),'site','fixed-copy').command);expect(copied.entities.filter(e=>e.kind==='path'&&e.elevation===3)).toHaveLength(2);
    expect(deserializeProject(serializeProject(authored))).toEqual(authored);await saveLocal(authored);expect(await loadLocal()).toEqual(authored);expect(authored.site.terrain).toEqual(p.site.terrain);
  });
  it('cuts and fills exactly under a courtyard, feathers its shoulder and never mutates authored ground',()=>{
    for(const elevation of [1,4]){
      const p=scene(),before=structuredClone(p.site.terrain),c=court(elevation),authored=parseProject({...p,entities:[c]}),evaluated=evaluateProject(authored);
      for(const point of [[0,0],[4.99,.17],[-4.99,4.93]] as PathPoint[])expect(terrainTriangleHeight(evaluated.site,point)).toBeCloseTo(elevation,6);
      const feather=terrainTriangleHeight(evaluated.site,[7,0]);expect(feather).toBeGreaterThan(Math.min(2,elevation));expect(feather).toBeLessThan(Math.max(2,elevation));expect(terrainTriangleHeight(evaluated.site,[12,0])).toBe(2);
      expect(authored.site.terrain).toEqual(before);expect(evaluateProject(evaluated).site.terrain).toEqual(evaluated.site.terrain);
    }
  });
  it('keeps grade changes, sculpting, hidden layers and removal reversible as normal document/terrain history',async()=>{
    const p=scene(),c=court(),editor=new Editor(p);editor.begin('Grade court');editor.preview({type:'add',entity:c});expect(terrainTriangleHeight(evaluateProject(editor.getSnapshot().preview!).site,[0,0])).toBe(4);editor.cancel();expect(editor.getSnapshot().project).toEqual(p);
    editor.execute({type:'add',entity:c},'Grade court');const before=editor.getSnapshot().project;
    editor.execute({type:'terrain',field:{...p.site.terrain,heights:p.site.terrain.heights.map(h=>h+.5)}},'Sculpt original ground');const sculpted=editor.getSnapshot().project;
    expect(terrainTriangleHeight(evaluateProject(sculpted).site,[0,0])).toBe(4);expect(terrainTriangleHeight(evaluateProject(sculpted).site,[20,0])).toBe(2.5);
    editor.execute({type:'replace',entity:{...c,visible:false}},'Hide grade');expect(evaluateProject(editor.getSnapshot().project).site.terrain).toBe(sculpted.site.terrain);editor.undo();expect(editor.getSnapshot().project).toEqual(sculpted);
    editor.execute({type:'remove',id:c.id},'Delete grade');expect(evaluateProject(editor.getSnapshot().project).site.terrain).toBe(sculpted.site.terrain);editor.undo();editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();
    const saved=editor.getSnapshot().project;expect(evaluateProject(deserializeProject(serializeProject(saved))).site.terrain).toEqual(evaluateProject(saved).site.terrain);await saveLocal(saved);expect(await loadLocal()).toEqual(saved);
    const layered=parseProject({...before,layers:[...before.layers,{id:'grade',name:'Grades',parentId:null,color:'#ffffff',visible:false,locked:false}],objectLayers:{...before.objectLayers,[c.id]:'grade'}});expect(evaluateProject(layered).site.terrain).toBe(layered.site.terrain);
  });
  it('grades a sloping path, rejects conflicting transitions and is independent of modifier order',()=>{
    const p=scene(),walk=path('graded'),c=court();const a=parseProject({...p,entities:[walk,c]}),b=parseProject({...p,entities:[c,walk]});
    const field=evaluateProject(a).site;expect(terrainTriangleHeight(field,[-10,12])).toBeCloseTo(3.5,4);expect(terrainTriangleHeight(field,[10,12])).toBeCloseTo(5.5,4);expect(field.terrain).toEqual(evaluateProject(b).site.terrain);
    const editor=new Editor(a),before=editor.getSnapshot();expect(()=>editor.execute({type:'add',entity:{...c,id:'conflict',elevation:6}},'Conflicting grade')).toThrow(/matching elevations/);expect(editor.getSnapshot()).toBe(before);
    expect(()=>parseProject({...p,entities:[c,{...c,id:'matching'}]})).not.toThrow();
  });
  it('lets a sloping entrance meet a level courtyard edge without fighting its grading shoulder',()=>{
    const p=scene(),c=court(4),walk={...path('graded'),points:[[-20,0],[-5,0]] as PathPoint[],elevation:2,endElevation:4};
    const a=evaluateProject(parseProject({...p,entities:[c,walk]})),b=evaluateProject(parseProject({...p,entities:[walk,c]}));
    expect(a.site.terrain).toEqual(b.site.terrain);expect(terrainTriangleHeight(a.site,[0,0])).toBe(4);
    expect(surfaceElevationAt(walk,p.site,[-5,0])).toBe(4);expect(terrainTriangleHeight(a.site,[-12,0])).toBeCloseTo(2+8/15*2,4);
  });
  it('keeps a sloping path continuous across a sharp miter and supports rounded bends',()=>{
    const p=scene(),walk={...path(),points:[[-10,0],[0,0],[0,10]] as PathPoint[],width:2,elevation:3,endElevation:7};
    expect(surfaceElevationAt(walk,p.site,[.5,-.5])).toBeCloseTo(5,6);
    const before=surfaceElevationAt(walk,p.site,[.49,-.51]),after=surfaceElevationAt(walk,p.site,[.51,-.49]);expect(Math.abs(before-after)).toBeLessThan(.01);
    const rounded={...walk,elevationMode:'graded' as const,cornerRounding:[0,1,0],gradingWidth:3};expect(()=>parseProject({...p,entities:[rounded]})).not.toThrow();
  });
  it('honors terrain locks and isolation and rejects incomplete, out-of-site or too narrow grades atomically',()=>{
    const p=scene(),c=court(),editor=new Editor(p),before=editor.getSnapshot();
    for(const patch of [{elevation:undefined},{gradingWidth:undefined},{gradingWidth:.5},{gradingWidth:21},{endElevation:5},{elevation:NaN},{points:c.points.map(([x,z])=>[x+24,z])}]){expect(()=>editor.execute({type:'add',entity:{...c,...patch} as MaterialRegion},'Invalid')).toThrow();expect(editor.getSnapshot()).toBe(before);}
    const locked=parseProject({...p,layers:p.layers.map(l=>({...l,locked:true}))});expect(()=>applyCommand(locked,{type:'add',entity:c})).toThrow(/terrain/);
    const separated=parseProject({...p,layers:[...p.layers,{id:'surface',name:'Surfaces',parentId:null,color:'#ffffff',visible:true,locked:false}],activeLayerId:'surface'}),isolated=new Editor(separated);isolated.isolateLayer('surface');expect(()=>isolated.execute({type:'add',entity:c},'Isolated grade')).toThrow(/isolation/);
  });
  it('keeps terrain grading out of water banks and prevents cuts below ocean water level',()=>{
    const p=scene(),lake=createLake(p,[[-9,-9],[9,-9],[9,9],[-9,9]]);expect(()=>parseProject({...p,entities:[court(),lake]})).toThrow(/water and banks/);
    const sea={...createOcean(),level:0,amplitude:.1};expect(()=>parseProject({...p,entities:[court(-1),sea]})).toThrow(/ocean water level/);
    const c={...court(),elevationMode:'fixed' as const,gradingWidth:undefined};expect(()=>parseProject({...p,entities:[c,lake]})).not.toThrow();
  });
  it('updates a terrain-attached stair landing when a courtyard grade changes, preserving undo',()=>{
    const p=scene(),level:Level={id:'level',kind:'level',parentId:'site',name:'Gate',visible:true,position:[0,0,0],rotation:0,storeyHeight:8};
    const stairs=createStairs(level.id,[0,0],[0,10],{...DEFAULT_STAIRS,rise:6,run:10,steps:24},0,false,'stairs');
    let base=parseProject({...p,entities:[level,stairs]});base=applyCommand(base,{type:'replace',entity:connectStairBottom(base,stairs)});
    const original=base.entities.find(e=>e.id==='stairs') as Slab,editor=new Editor(base);editor.execute({type:'add',entity:court(3)},'Grade entrance');
    const next=editor.getSnapshot().project.entities.find(e=>e.id==='stairs') as Slab;expect(next.elevation).toBeCloseTo(original.elevation+1);expect(next.stairs!.rise).toBe(original.stairs!.rise);editor.undo();expect(editor.getSnapshot().project).toEqual(base);
  });
  it('migrates format 34 without introducing grade fields and rejects elevated settings labeled as legacy',()=>{
    const p=scene(),walk=createDrawnPath(p,[[-12,0],[12,0]],{width:3,surface:'paving'}),c=createRegion(p,'courtyard');
    const old={...p,version:34,entities:[walk,c]},snapshot=structuredClone(old);expect(parseProject(old)).toEqual({...snapshot,version:39});expect(old).toEqual(snapshot);
    expect(()=>parseProject({...old,entities:[path()]})).toThrow(/format 35/);expect(()=>parseProject({...p,version:40})).toThrow();
  });
});
