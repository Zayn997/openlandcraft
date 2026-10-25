import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {createSite,createDrawnPath,Editor,parseProject,snapPathPoint,copySelection,pasteSelection,plantingObstacle,type Path} from './index';
import {pathNetworkSurfaces,polygonArea,MAX_LANDSCAPE_PATHS,type PathPoint} from '@openlandcraft/landscape';
import {deserializeProject,serializeProject,saveLocal,loadLocal} from '@openlandcraft/project';

const scene=()=>createSite({name:'Garden paths',width:60,depth:60,resolution:129,preset:'flat'});
const draw=(p:ReturnType<typeof scene>,points:PathPoint[])=>createDrawnPath(p,points,{width:4,surface:'paving'});
describe('editable garden path networks',()=>{
  it('keeps a cross and T as separate native paths through redraw, cancel, copy, undo and reopening',async()=>{
    const editor=new Editor(scene());
    const main=draw(editor.getSnapshot().project,[[-20,0],[20,0]]);
    editor.execute({type:'add',entity:main},'Main walk');
    const cross=draw(editor.getSnapshot().project,[[0,-20],[0,20]]);
    editor.execute({type:'add',entity:cross},'Cross walk');
    const branch=draw(editor.getSnapshot().project,[[10,0],[10,20]]);
    editor.execute({type:'add',entity:branch},'Branch walk');
    const before=editor.getSnapshot().project;
    const redrawn=createDrawnPath(before,[[12,0],[12,18]],branch,branch.id);
    editor.begin('Redraw branch');editor.preview({type:'replace',entity:redrawn});editor.cancel();
    expect(editor.getSnapshot().project).toEqual(before);
    editor.execute({type:'replace',entity:redrawn},'Redraw branch');
    expect(editor.getSnapshot().project.entities.slice(0,2)).toEqual([main,cross]);
    editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();
    const edited=editor.getSnapshot().project;
    expect(deserializeProject(serializeProject(edited))).toEqual(edited);await saveLocal(edited);expect(await loadLocal()).toEqual(edited);
    const pasted=pasteSelection(edited,copySelection(edited,branch.id),'site','copied');
    editor.execute(pasted.command,'Copy path');expect(editor.getSnapshot().project.entities).toHaveLength(4);
    const obstacle=plantingObstacle(edited,{clearance:0,exclusions:{paths:true,buildings:false,water:false}});
    expect(obstacle(12,15)).toBe(true);expect(obstacle(0,15)).toBe(true);expect(obstacle(-15,15)).toBe(false);
    expect(edited.site.terrain).toEqual(before.site.terrain);
  });
  it('bounds authored routes without losing atomic history on failure',()=>{
    const p=scene(),path=draw(p,[[-20,0],[20,0]]);
    p.entities=Array.from({length:MAX_LANDSCAPE_PATHS},(_,i)=>({...path,id:`p${i}`}));
    const editor=new Editor(parseProject(p)),before=editor.getSnapshot();
    expect(()=>draw(before.project,[[0,-20],[0,20]])).toThrow(/16 paths/);
    expect(()=>editor.execute({type:'add',entity:{...path,id:'too-many'}},'Too many')).toThrow(/16 paths/);
    expect(editor.getSnapshot()).toBe(before);
    expect(createDrawnPath(before.project,[[-18,0],[18,0]],path,'p0').id).toBe('p0');
  });
  it('snaps to the actual centerline, excludes self and hidden/locked layers, and keeps snapping optional',()=>{
    const p=scene(),path=draw(p,[[-20,0],[20,0]]);path.name='Main walk';p.entities=[path];
    expect(snapPathPoint(p,[3.2,.6],true)).toEqual({point:[expect.closeTo(3.2),0],target:'Main walk'});
    expect(snapPathPoint(p,[3.2,.6],false)).toEqual({point:[3.2,.6],target:null});
    expect(snapPathPoint(p,[3.2,.6],true,true,path.id).target).toBeNull();
    expect(snapPathPoint(p,[3.2,.6],true,false).target).toBeNull();
    p.layers[0].locked=true;expect(snapPathPoint(p,[3.2,.6],true).target).toBeNull();
    p.layers[0].locked=false;p.layers[0].visible=false;expect(snapPathPoint(p,[3.2,.6],true).target).toBeNull();
    p.layers[0].visible=true;path.visible=false;expect(snapPathPoint(p,[3.2,.6],true).target).toBeNull();
  });
  it('rebuilds junctions after width, rounding, movement and visibility changes without altering neighbors',()=>{
    const p=scene(),main=draw(p,[[-20,0],[20,0]]),cross=draw(p,[[0,-20],[0,20]]);
    const area=(paths:Path[])=>[...pathNetworkSurfaces(paths).values()].flat().reduce((sum,p)=>sum+polygonArea(p.points),0);
    expect(area([main,cross])).toBeCloseTo(304);
    expect(area([main,{...cross,width:2}])).toBeCloseTo(232);
    expect(area([main,{...cross,visible:false}])).toBeCloseTo(160);
    const moved={...cross,points:[[22,-20],[22,20]] as PathPoint[]};expect(area([main,moved])).toBeCloseTo(320);
    expect(main.points).toEqual([[-20,0],[20,0]]);
    const curved={...cross,points:[[-12,-12],[0,-12],[0,12]] as PathPoint[],cornerRounding:[0,1,0]};
    expect(()=>parseProject({...p,entities:[main,curved]})).not.toThrow();expect(area([main,curved])).toBeGreaterThan(160);
  });
});
