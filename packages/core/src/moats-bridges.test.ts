import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {createSite,createMoat,createBridge,Editor,evaluateProject,parseProject,groundHeight,groundHabitat,walkingHeight,fishHabitat,pedestrianGraph,plantingObstacle,copySelection,pasteSelection,applyCommand,type Path} from './index';
import {lakeWaterDistance,bridgeStation,bridgeHeight,terrainTriangleHeight,type PathPoint} from '@openlandcraft/landscape';
import {serializeProject,deserializeProject,saveLocal,loadLocal} from '@openlandcraft/project';

const base=()=>createSite({name:'Castle moat',width:100,depth:100,resolution:129,preset:'flat'});
const study=()=>{const p=base(),moat=createMoat(p);p.entities.push(moat);const bridge=createBridge(p,moat.id);p.entities.push(bridge);return {p,moat,bridge};};
describe('editable ring moat and bank-to-bank bridges',()=>{
  it('preserves the authored dry island, carves only water and banks, and restores terrain on hide/delete',()=>{
    const {p,moat}=study(),before=[...p.site.terrain.heights],evaluated=evaluateProject(p);
    expect(lakeWaterDistance(moat,0,0)).toBeLessThan(-20);expect(lakeWaterDistance(moat,32,0)).toBeGreaterThan(3);
    expect(groundHeight(0,0,evaluated.site)).toBe(2);expect(groundHeight(32,0,evaluated.site)).toBeCloseTo(moat.level-moat.depth);
    expect(p.site.terrain.heights).toEqual(before);
    const editor=new Editor(p);editor.execute({type:'replace',entity:{...moat,visible:false}},'Hide moat');expect(evaluateProject(editor.getSnapshot().project).site.terrain.heights).toEqual(before);editor.undo();expect(evaluateProject(editor.getSnapshot().project).site.terrain.heights).toEqual(evaluated.site.terrain.heights);
    editor.execute({type:'remove',id:moat.id},'Delete moat');expect(evaluateProject(editor.getSnapshot().project).site.terrain.heights).toEqual(before);editor.undo();expect(editor.getSnapshot().project).toEqual(p);
  });
  it('rejects island crossings, touching banks, nesting, outside points and old format labels atomically',()=>{
    const {p,moat}=study(),editor=new Editor(p),snapshot=editor.getSnapshot();
    const bad:PathPoint[][][]=[[[[-5,-5],[5,5],[-5,5],[5,-5]]],[[[-40,-5],[-30,-5],[-30,5],[-40,5]]],[moat.holes![0],moat.holes![0]],[[[-37,-5],[-27,-5],[-27,5],[-37,5]]]];
    for(const holes of bad){expect(()=>editor.execute({type:'replace',entity:{...moat,holes}},'Bad moat')).toThrow();expect(editor.getSnapshot()).toBe(snapshot);}
    expect(()=>parseProject({...p,version:35})).toThrow(/format 36/);expect(()=>parseProject({...p,version:40})).toThrow();
    const old={...base(),version:35};expect(parseProject(old)).toEqual({...old,version:39});expect(old.version).toBe(35);
  });
  it('retains island edits in cache, preview cancellation, undo/redo and local/portable reopening',async()=>{
    const {p,moat}=study(),editor=new Editor(p),before=evaluateProject(p).site.terrain;
    const next={...moat,holes:moat.holes!.map(h=>h.map(([x,z]):PathPoint=>[x*1.01,z*1.01]))};
    editor.begin('Reshape island');editor.preview({type:'replace',entity:next});expect(evaluateProject(editor.getSnapshot().preview!).site.terrain).not.toBe(before);editor.cancel();expect(editor.getSnapshot().project).toEqual(p);
    editor.execute({type:'replace',entity:next},'Reshape island');const edited=editor.getSnapshot().project;editor.undo();expect(editor.getSnapshot().project).toEqual(p);editor.redo();expect(editor.getSnapshot().project).toEqual(edited);
    expect(deserializeProject(serializeProject(edited))).toEqual(edited);await saveLocal(edited);expect(await loadLocal()).toEqual(edited);
  });
  it('keeps explicit deck clearance, dry abutments and ground-connected ramps without grading the moat',()=>{
    const {p,moat,bridge}=study(),b=bridge.bridge!,{length}=bridgeStation(bridge,bridge.points[0]),mid:PathPoint=[(bridge.points[0][0]+bridge.points[1][0])/2,(bridge.points[0][1]+bridge.points[1][1])/2];
    expect(bridge.elevation!-b.thickness).toBeGreaterThan(moat.level+2*moat.amplitude+.15);
    expect(bridgeHeight(bridge,p.site,bridge.points[0])).toBe(2);expect(bridgeHeight(bridge,p.site,bridge.points[1])).toBeCloseTo(2);expect(bridgeHeight(bridge,p.site,mid)).toBe(bridge.elevation);
    expect(length).toBeGreaterThan(2*b.approachLength);expect(p.site.terrain.heights.every(h=>h===2)).toBe(true);
    const editor=new Editor(p),snapshot=editor.getSnapshot();
    for(const patch of [{elevation:moat.level+.1},{elevation:8},{points:[bridge.points[0],mid]},{elevationMode:'graded',gradingWidth:4},{points:[...bridge.points,mid]}]){expect(()=>editor.execute({type:'replace',entity:{...bridge,...patch} as Path},'Bad bridge')).toThrow();expect(editor.getSnapshot()).toBe(snapshot);}
    expect(()=>editor.execute({type:'replace',entity:{...moat,bank:3}},'Flood bridge banks')).toThrow(/dry banks/);expect(editor.getSnapshot()).toBe(snapshot);
  });
  it('adds separate bridges and rejects flooding a retained island',()=>{
    const {p,moat,bridge}=study(),second=createBridge(p,moat.id);expect(second.points).not.toEqual(bridge.points);expect(()=>parseProject({...p,entities:[...p.entities,second]})).not.toThrow();
    expect(()=>parseProject({...p,entities:[{...moat,level:2.5}]})).toThrow(/dry island terrain/);
    const reversed={...moat,points:[...moat.points].reverse(),holes:moat.holes!.map(h=>[...h].reverse())};expect(()=>parseProject({...p,entities:[reversed]})).not.toThrow();expect(lakeWaterDistance(reversed,0,0)).toBeLessThan(0);
  });
  it('keeps island planting available and translates both shoreline loops when copying',()=>{
    const {p,moat}=study(),blocked=plantingObstacle(p,{clearance:1,exclusions:{water:true,paths:false,buildings:false}});
    expect(blocked(0,0)).toBe(false);expect(blocked(32,0)).toBe(true);
    const empty=base(),copy=pasteSelection(empty,copySelection(p,moat.id),null,'moat-copy'),result=applyCommand(empty,copy.command),lake=result.entities.find(e=>e.kind==='lake');
    expect(lake?.kind).toBe('lake');if(lake?.kind!=='lake')throw new Error('Missing copied moat');
    expect(lake.points).toEqual(moat.points.map(([x,z])=>[x+2,z+2]));expect(lake.holes).toEqual(moat.holes!.map(hole=>hole.map(([x,z])=>[x+2,z+2])));expect(lakeWaterDistance(lake,2,2)).toBeLessThan(0);
  });
  it('supports walking over the deck while fish remain in the water below and off the island',()=>{
    const {p,bridge}=study(),scene=evaluateProject(p),habitat=groundHabitat(scene),mid:PathPoint=[(bridge.points[0][0]+bridge.points[1][0])/2,(bridge.points[0][1]+bridge.points[1][1])/2];
    expect(habitat.clear(...mid,.25)).toBe(true);expect(walkingHeight(scene,...mid)).toBe(bridge.elevation);
    expect(habitat.clear(0,0,.25)).toBe(true);const fish=fishHabitat(scene)[0];expect(fish.sample(0,0,.1)).toBeNull();expect(fish.sample(...mid,.1)).not.toBeNull();
    const graph=pedestrianGraph(bridge,.25,habitat.clear);expect(graph.components).toHaveLength(1);expect(graph.nodes.length).toBeGreaterThan(20);
    const hidden={...scene,entities:scene.entities.map(e=>e.id===bridge.id?{...e,visible:false}:e)};expect(groundHabitat(hidden).clear(...mid,.25)).toBe(false);expect(walkingHeight(hidden,...mid)).toBe(terrainTriangleHeight(scene.site,mid));
  });
});
