import { defaultLayers } from './layers';
import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import legacy from '../../../examples/coastal-paths.olc.json';
import {createSite,createLake,createRiver,createOcean,Editor,evaluateProject,parseProject,type Lake} from './index';
import {carveLake,DEFAULT_BRUSH,lakeDistance,lakeIssue,TerrainStroke,type PathPoint} from '@openlandcraft/landscape';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';

const flat=()=>createSite({name:'Water System',width:80,depth:64,resolution:129,preset:'flat'});
const boundary:PathPoint[]=[[-10,-10],[10,-10],[10,10],[-10,10]];
describe('lake document and reversible basins',()=>{
  it('migrates version 9 while retaining exact paths, rivers, ocean, terrain and source bytes',()=>{
    const before=structuredClone(legacy),current=parseProject(legacy);expect(current).toEqual({...legacy,version:33,layers:defaultLayers(),objectLayers:{},activeLayerId:"default"});expect(legacy).toEqual(before);
    expect(()=>parseProject({...current,version:34})).toThrow();
    expect(()=>parseProject({...legacy,entities:[...legacy.entities,createLake(current)]})).toThrow();
  });
  it('supports concave boundaries and either winding, rejecting crossings, contact and narrow necks',()=>{
    const project=flat(),lake=createLake(project,boundary);
    expect(lakeDistance(boundary,0,0)).toBe(10);expect(lakeDistance([...boundary].reverse(),0,0)).toBe(10);expect(lakeDistance(boundary,11,0)).toBe(-1);
    const concave:PathPoint[]=[[-10,-10],[10,-10],[10,0],[0,0],[0,10],[-10,10]];
    expect(lakeIssue({...lake,points:concave},project.site,project.site.terrain)).toBeNull();
    expect(lakeDistance(concave,5,5)).toBeLessThan(0);
    for(const points of [[[0,0],[10,10],[-10,10],[10,0]],[[0,0],[10,0],[0,0],[0,10]],[[-10,0],[10,0],[10,0.2],[-10,0.2]]] as PathPoint[][]){expect(()=>parseProject({...project,entities:[{...lake,points}]})).toThrow();}
  });
  it('rejects invalid limits and water overlap without replacing a committed or preview scene',()=>{
    const project=flat(),lake=createLake(project,boundary),editor=new Editor({...project,entities:[lake]});editor.begin('Lake');const state=editor.getSnapshot();
    for(const patch of [{depth:8},{level:-8,depth:5},{amplitude:NaN},{bank:0},{points:[[-40,-10],[-20,-10],[-20,10]]},{points:Array.from({length:25},()=>[0,0])},{extra:true}]){
      expect(()=>editor.preview({type:'replace',entity:{...lake,...patch} as Lake})).toThrow();expect(editor.getSnapshot()).toBe(state);
    }
    editor.cancel();expect(()=>editor.execute({type:'add',entity:{...lake,id:'second',visible:false}},'Second')).toThrow('one lake');
    const river={...createRiver(project),points:[[-20,1,0],[20,1,0]] as [number,number,number][]};expect(()=>editor.execute({type:'add',entity:river},'River')).toThrow('banks separate');
    expect(()=>editor.execute({type:'add',entity:{...createOcean(),level:lake.level}},'Ocean')).toThrow('above the ocean');
  });
  it('composes river then lake deterministically and retains carving through material/motion edits',()=>{
    const project=flat(),river={...createRiver(project),points:[[-20,1,-25],[20,1,-25]] as [number,number,number][]},lake={...createLake(project,boundary),points:boundary.map(([x,z]):PathPoint=>[x,z+10])};
    const both=parseProject({...project,entities:[lake,river]}),reordered={...both,entities:[...both.entities].reverse()};
    const field=evaluateProject(both).site.terrain;expect(evaluateProject(reordered).site.terrain).toBe(field);
    expect(field).toEqual(carveLake(evaluateProject({...both,entities:[river]}).site.terrain,project.site,lake));
    const editor=new Editor(both),editorField=evaluateProject(editor.getSnapshot().project).site.terrain;editor.execute({type:'replace',entity:{...lake,color:'#226677',amplitude:0.2}},'Appearance');expect(evaluateProject(editor.getSnapshot().project).site.terrain).toBe(editorField);
  });
  it('previews one history entry, saves authored values, and preserves sculpting after hide/delete',async()=>{
    const project=flat(),lake=createLake(project,boundary),editor=new Editor({...project,entities:[lake]});const initial=editor.getSnapshot().project;
    editor.begin('Lake basin');for(const depth of [2,2.5,3])editor.preview({type:'replace',entity:{...lake,depth}});
    expect(editor.getSnapshot().project).toBe(initial);expect(evaluateProject(editor.getSnapshot().preview!).site.terrain).not.toEqual(evaluateProject(initial).site.terrain);editor.cancel();expect(editor.getSnapshot().project).toBe(initial);
    editor.begin('Lake basin');editor.preview({type:'replace',entity:{...lake,depth:3,level:2.1}});editor.commit();expect(editor.getSnapshot().past).toHaveLength(1);editor.undo();expect(editor.getSnapshot().project).toEqual(initial);editor.redo();
    const current=editor.getSnapshot().project,currentLake=current.entities[0] as Lake,stroke=new TerrainStroke(current.site.terrain,current.site,DEFAULT_BRUSH);stroke.move(0,0);editor.execute({type:'terrain',field:stroke.snapshot()},'Sculpt');
    const sculpted=editor.getSnapshot().project;editor.execute({type:'replace',entity:{...currentLake,visible:false}},'Hide');expect(evaluateProject(editor.getSnapshot().project).site.terrain).toEqual(stroke.snapshot());editor.undo();
    editor.execute({type:'remove',id:lake.id},'Delete');expect(editor.getSnapshot().project.site.terrain).toEqual(stroke.snapshot());editor.undo();expect(editor.getSnapshot().project).toEqual(sculpted);
    const text=serializeProject(sculpted);expect(deserializeProject(text)).toEqual(sculpted);expect(text).not.toContain('foamHistory');await saveLocal(sculpted);expect(await loadLocal()).toEqual(sculpted);
  });
  it('keeps shore heights continuous, never raises authored ground, and preserves outside terrain',()=>{
    const project=flat(),lake=createLake(project,boundary),before=structuredClone(project.site.terrain),field=carveLake(before,project.site,lake);
    expect(before).toEqual(project.site.terrain);expect(Math.min(...field.heights)).toBeCloseTo(lake.level-lake.depth,6);
    field.heights.forEach((h,i)=>expect(h).toBeLessThanOrEqual(before.heights[i]));expect(field.heights[0]).toBe(before.heights[0]);
    expect(carveLake(before,project.site,{...lake,points:[...boundary].reverse()})).toEqual(field);
  });
});
