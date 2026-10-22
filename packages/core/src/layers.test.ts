import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Editor, applyCommand, canEditObject, copySelection, createBuilding, createProject, defaultLayers, duplicateAbove, layerDisplayProject, layerState, objectLayer, parseProject, pasteSelection, type Layer, type Wall } from './index';
import { deserializeProject, serializeProject, saveLocal, loadLocal } from '@openlandcraft/project';

const layer = (id:string,parentId:string|null=null):Layer => ({id,name:id,parentId,color:'#82b89b',visible:true,locked:false});
function setup(){const editor=new Editor(createProject());editor.execute({type:'layer',layer:layer('Architecture')},'New layer');editor.execute({type:'layer',layer:layer('Walls','Architecture')},'Sublayer');return editor;}
describe('Persistent modeling layers',()=>{
  it('migrates v13 without altering authored data and rejects malformed layer graphs',()=>{
    const {layers,objectLayers,activeLayerId,...base}=createProject(),legacy={...base,version:13};
    const before=structuredClone(legacy),p=parseProject(legacy);
    expect(p).toEqual({...legacy,version:18,layers:defaultLayers(),objectLayers:{},activeLayerId:'default'});expect(legacy).toEqual(before);
    expect(()=>parseProject({...p,layers:[...p.layers,layer('a','b'),layer('b','a')]})).toThrow(/cycles/);
    expect(()=>parseProject({...p,layers:[...p.layers,layer('a'),{...layer('b'),name:'a'}]})).toThrow(/unique layer names/);
    expect(()=>parseProject({...p,objectLayers:{missing:'default'}})).toThrow(/assignments/);
    expect(()=>parseProject({...p,objectLayers:{terrain:'missing'}})).toThrow(/assignments/);
    expect(()=>parseProject({...p,version:19})).toThrow();
  });
  it('creates into the active layer and preserves assignments through history and local/file storage',async()=>{
    const editor=setup();editor.execute({type:'activeLayer',id:'Walls'},'Active');
    const source=editor.getSnapshot().project.entities[0];
    editor.execute({type:'add',entity:{...source,id:'new'}},'Add');
    const p=editor.getSnapshot().project;expect(objectLayer(p,'new')).toBe('Walls');
    expect(p.entities.find(e=>e.id==='new')?.parentId).toBe('site');
    editor.undo();expect(editor.getSnapshot().project.objectLayers.new).toBeUndefined();editor.redo();expect(editor.getSnapshot().project).toEqual(p);
    expect(deserializeProject(serializeProject(p))).toEqual(p);await saveLocal(p);expect(await loadLocal()).toEqual(p);
  });
  it('assignment does not detach walls from floors and is one reversible edit',()=>{
    const editor=setup(),p=editor.getSnapshot().project;
    editor.execute({type:'insert',entities:createBuilding(p,-20,0,8,6,'floor')},'Building');
    const before=editor.getSnapshot().project,wall=before.entities.find(e=>e.kind==='wall')!;
    editor.execute({type:'assignLayer',ids:[wall.id],layerId:'Walls'},'Assign');
    expect(editor.getSnapshot().project.entities).toEqual(before.entities);
    expect(objectLayer(editor.getSnapshot().project,wall.id)).toBe('Walls');
    editor.undo();expect(editor.getSnapshot().project).toEqual(before);
  });
  it('inherits parent hide/lock, preserves child settings, and guards indirect parent deletion',()=>{
    const editor=setup();editor.execute({type:'insert',entities:createBuilding(editor.getSnapshot().project,-20,0,8,6,'floor')},'Building');
    const wall=editor.getSnapshot().project.entities.find(e=>e.kind==='wall') as Wall;
    editor.execute({type:'assignLayer',ids:[wall.id],layerId:'Walls'},'Assign');editor.select(wall.id);
    editor.execute({type:'layer',layer:{...layer('Architecture'),locked:true}},'Lock');
    const locked=editor.getSnapshot();expect(locked.selectedId).toBeNull();expect(canEditObject(locked.project,wall.id)).toBe(false);
    expect(()=>editor.execute({type:'replace',entity:{...wall,name:'Changed'}},'Edit')).toThrow(/Unlock/);
    expect(()=>editor.execute({type:'remove',id:'floor'},'Delete floor')).toThrow(/Unlock/);
    expect(editor.getSnapshot()).toBe(locked);
    editor.execute({type:'layer',layer:{...layer('Architecture'),visible:false}},'Hide');
    expect(layerState(editor.getSnapshot().project,'Walls').visible).toBe(false);
    expect(editor.getSnapshot().project.layers.find(l=>l.id==='Walls')?.visible).toBe(true);
    expect(layerDisplayProject(editor.getSnapshot().project).entities.find(e=>e.id===wall.id)?.visible).toBe(false);
    editor.execute({type:'layer',layer:layer('Architecture')},'Restore');expect(canEditObject(editor.getSnapshot().project,wall.id)).toBe(true);
  });
  it('isolates without changing document visibility, history, or revision',()=>{
    const editor=setup(),id=editor.getSnapshot().project.entities[0].id;
    editor.execute({type:'assignLayer',ids:[id],layerId:'Walls'},'Assign');const before=editor.getSnapshot();
    editor.isolateLayer('Architecture');const isolated=editor.getSnapshot();
    expect(isolated.project).toBe(before.project);expect(isolated.past).toBe(before.past);expect(isolated.revision).toBe(before.revision);
    const display=layerDisplayProject(before.project,'Architecture');expect(display.entities.find(e=>e.id===id)?.visible).toBe(true);expect(display.entities.find(e=>e.id==='ocean-main')?.visible).toBe(false);
    editor.isolateLayer(null);expect(layerDisplayProject(editor.getSnapshot().project).entities).toEqual(before.project.entities);
  });
  it('protects terrain, recovers active layers, and only deletes empty layers',()=>{
    const editor=setup();editor.execute({type:'assignLayer',ids:['terrain'],layerId:'Walls'},'Terrain layer');editor.execute({type:'activeLayer',id:'Walls'},'Active');
    editor.execute({type:'layer',layer:{...layer('Architecture'),locked:true}},'Lock');expect(editor.getSnapshot().project.activeLayerId).toBe('default');
    const p=editor.getSnapshot().project;
    expect(()=>editor.execute({type:'terrain',field:p.site.terrain},'Brush')).toThrow(/Unlock/);
    expect(()=>editor.execute({type:'removeLayer',id:'Walls'},'Delete')).toThrow(/Move/);
    expect(()=>editor.execute({type:'removeLayer',id:'default'},'Delete')).toThrow(/Default/);
    editor.execute({type:'layer',layer:layer('Empty')},'New');editor.execute({type:'removeLayer',id:'Empty'},'Delete');editor.undo();expect(editor.getSnapshot().project.layers.some(l=>l.id==='Empty')).toBe(true);
  });
  it('preserves source layer membership during paste and floor repetition',()=>{
    const editor=setup();editor.execute({type:'activeLayer',id:'Walls'},'Active');editor.execute({type:'insert',entities:createBuilding(editor.getSnapshot().project,-20,0,8,6,'floor')},'Building');editor.execute({type:'activeLayer',id:'default'},'Active');
    const p=editor.getSnapshot().project,wall=p.entities.find(e=>e.kind==='wall')!;
    const copy=pasteSelection(p,copySelection(p,wall.id),wall.id,'paste');const pasted=applyCommand(p,copy.command);
    expect(objectLayer(pasted,copy.selectedIds[0])).toBe('Walls');
    const repeated=duplicateAbove(p,'floor',3.4,'next');
    expect(repeated.addedIds.every(id=>objectLayer(repeated.project,id)==='Walls')).toBe(true);
    expect(()=>applyCommand(p,{type:'duplicateAbove',sourceId:'floor',height:3.4,prefix:'next'})).not.toThrow();
  });
  it('moves a floor and its contents together and prevents moving locked contents indirectly',()=>{
    const editor=setup();editor.execute({type:'insert',entities:createBuilding(editor.getSnapshot().project,-20,0,8,6,'floor')},'Building');
    const before=editor.getSnapshot().project;
    editor.execute({type:'assignLayer',ids:['floor'],layerId:'Walls'},'Assign floor');
    const moved=editor.getSnapshot().project;
    expect(moved.entities).toEqual(before.entities);
    expect(moved.entities.filter(e=>e.id==='floor'||e.parentId==='floor').every(e=>objectLayer(moved,e.id)==='Walls')).toBe(true);
    editor.undo();
    const wall=before.entities.find(e=>e.kind==='wall')!;
    editor.execute({type:'assignLayer',ids:[wall.id],layerId:'Walls'},'Assign wall');
    editor.execute({type:'layer',layer:{...layer('Walls','Architecture'),locked:true}},'Lock wall');
    expect(()=>editor.execute({type:'assignLayer',ids:['floor'],layerId:'Architecture'},'Move floor')).toThrow(/contents/);
  });
  it('creates a building on an unlocked active layer even when Default is locked',()=>{
    const editor=setup();editor.execute({type:'activeLayer',id:'Architecture'},'Active');
    editor.execute({type:'layer',layer:{...defaultLayers()[0],locked:true}},'Lock default');
    editor.execute({type:'insert',entities:createBuilding(editor.getSnapshot().project,-20,0,8,6,'floor')},'Building');
    expect(objectLayer(editor.getSnapshot().project,'floor')).toBe('Architecture');
  });
  it('prevents invisible creation outside an isolated layer and restores normal creation',()=>{
    const editor=setup(),source=editor.getSnapshot().project.entities[0];editor.isolateLayer('Architecture');
    expect(()=>editor.execute({type:'add',entity:{...source,id:'outside'}},'Add')).toThrow(/isolation/);
    editor.execute({type:'activeLayer',id:'Walls'},'Active');editor.execute({type:'add',entity:{...source,id:'inside'}},'Add');
    expect(objectLayer(editor.getSnapshot().project,'inside')).toBe('Walls');
    editor.isolateLayer(null);expect(editor.getSnapshot().project.entities.some(e=>e.id==='inside')).toBe(true);
  });
});
