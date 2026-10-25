import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {createSite,createRegion,createDrawnPath,Editor,parseProject,plantingObstacle,copySelection,pasteSelection,applyCommand,DEFAULT_TOWER,newTower,type MaterialRegion} from './index';
import {regionTriangles,polygonArea,courtyardNetworkSurfaces,pathNetworkSurfaces,type PathPoint} from '@openlandcraft/landscape';
import {serializeProject,deserializeProject,saveLocal,loadLocal} from '@openlandcraft/project';

const scene=()=>createSite({name:'Courtyard study',width:60,depth:60,resolution:129,preset:'flat'});
const boundary:PathPoint[]=[[-8,-8],[8,-8],[8,8],[-8,8]];
const courtyard=(p=scene(),points=boundary)=>createRegion(p,'courtyard',points) as MaterialRegion;
describe('editable paved courtyards',()=>{
  it('creates native regions and preserves independent paths through boundary preview, undo, copy and reopening',async()=>{
    const editor=new Editor(scene()),before=editor.getSnapshot().project,c=courtyard(before);
    const path=createDrawnPath(before,[[-20,0],[20,0]],{width:4,surface:'paving'});
    editor.execute({type:'insert',entities:[path,c]},'Courtyard and walk');const original=editor.getSnapshot().project;
    const resized={...c,name:'Gate court',points:c.points.map(([x,z]):PathPoint=>[x*1.25,z]),detailScale:1.5,color:'#b8af98',roughness:.8};
    editor.begin('Edit courtyard');editor.preview({type:'replace',entity:resized});editor.cancel();expect(editor.getSnapshot().project).toEqual(original);
    editor.begin('Edit courtyard');editor.preview({type:'replace',entity:resized});editor.commit();const edited=editor.getSnapshot().project;
    expect(edited.entities[0]).toEqual(path);expect(edited.entities[1]).toEqual(resized);expect(edited.site.terrain).toEqual(before.site.terrain);
    editor.undo();expect(editor.getSnapshot().project).toEqual(original);editor.redo();
    expect(deserializeProject(serializeProject(edited))).toEqual(edited);await saveLocal(edited);expect(await loadLocal()).toEqual(edited);
    editor.execute(pasteSelection(edited,copySelection(edited,c.id),'site','copied').command,'Copy court');
    expect(editor.getSnapshot().project.entities.filter(e=>e.kind==='materialRegion')).toHaveLength(2);
    editor.undo();editor.execute({type:'remove',id:c.id},'Remove court');expect(editor.getSnapshot().project.entities).toEqual([path]);editor.undo();expect(editor.getSnapshot().project).toEqual(edited);
  });
  it('keeps arbitrary valid boundaries editable and rejects invalid or locked changes atomically',()=>{
    const p=scene(),c=courtyard(p),editor=new Editor({...p,entities:[c]}),before=editor.getSnapshot();
    for(const patch of [{points:[[0,0],[10,10],[0,10],[10,0]]},{points:[[-31,0],[0,0],[0,10]]},{detailScale:0},{roughness:1.1},{surface:'asphalt'}]){
      expect(()=>editor.execute({type:'replace',entity:{...c,...patch} as MaterialRegion},'Invalid')).toThrow();expect(editor.getSnapshot()).toBe(before);
    }
    const locked=parseProject({...p,entities:[c],layers:p.layers.map(l=>({...l,locked:true}))});
    expect(()=>applyCommand(locked,{type:'replace',entity:{...c,points:boundary.map(([x,z])=>[x+1,z])}})).toThrow(/Unlock/);
  });
  it('reserves courtyard ground for planting, including hidden courts and clearance, with optional exclusion',()=>{
    const p=scene(),c={...courtyard(p),visible:false};p.entities=[c];
    const exclusions={water:false,paths:true,buildings:false},blocked=plantingObstacle(p,{clearance:1,exclusions});
    expect(blocked(0,0)).toBe(true);expect(blocked(8.5,0)).toBe(true);expect(blocked(10,0)).toBe(false);
    expect(plantingObstacle(p,{clearance:1,exclusions:{...exclusions,paths:false}})(0,0)).toBe(false);
  });
  it('migrates format 33 without changing towers, path identities, layers, resources or terrain',()=>{
    let p=scene();p=applyCommand(p,{type:'batch',commands:[{type:'towerType',definition:{...DEFAULT_TOWER,id:'round',name:'Keep'}},{type:'tower',...newTower('round',[-16,2,0],'keep')}]});
    p=applyCommand(p,{type:'add',entity:createDrawnPath(p,[[-20,12],[20,12]],{width:3,surface:'paving'})});
    const old={...p,version:33},snapshot=structuredClone(old);expect(parseProject(old)).toEqual({...snapshot,version:39});expect(old).toEqual(snapshot);
    const c=courtyard(p);expect(()=>parseProject({...old,entities:[...old.entities,c]})).toThrow(/format 34/);
    expect(()=>parseProject({...p,version:40})).toThrow();expect(serializeProject({...p,entities:[...p.entities,c]})).not.toContain('samples');
  });
  it('triangulates concave, reversed and collinear boundaries without covering dry notches',()=>{
    const concave:PathPoint[]=[[-10,-10],[0,-10],[10,-10],[10,0],[0,0],[0,10],[-10,10]];
    for(const points of [concave,[...concave].reverse()]){
      const triangles=regionTriangles(points);expect(triangles.reduce((sum,t)=>sum+polygonArea(t),0)).toBeCloseTo(300);
      const c={id:'court',visible:true,points},surfaces=courtyardNetworkSurfaces([c]);expect(surfaces.get(c.id)!.reduce((sum,t)=>sum+polygonArea(t),0)).toBeCloseTo(300);
      const walk={id:'walk',visible:true,points:[[5,-20],[5,20]] as PathPoint[],width:2};
      const outside=pathNetworkSurfaces([walk],[...surfaces.values()].flat()).get(walk.id)!;expect(outside.reduce((sum,p)=>sum+polygonArea(p.points),0)).toBeCloseTo(60);
    }
  });
});
