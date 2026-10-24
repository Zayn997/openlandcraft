import 'fake-indexeddb/auto';
import { describe,expect,it } from 'vitest';
import legacy from '../../../examples/coastal-materials.olc.json';
import { Editor,parseProject,evaluateProject,RIVER_WATER_DEFAULTS,type River } from './index';
import { deserializeProject,serializeProject,saveLocal,loadLocal } from '@openlandcraft/project';

describe('river engine authoring',()=>{
  it('migrates version 7 while preserving the full source scene',()=>{
    const before=structuredClone(legacy),project=parseProject(legacy);expect(project.version).toBe(32);expect(legacy).toEqual(before);
    expect(project.site).toEqual(legacy.site);expect(project.assets).toEqual(legacy.assets);
    expect(project.entities).toEqual(legacy.entities.map(e=>e.kind==='river'?{...e,water:RIVER_WATER_DEFAULTS}:e));
  });
  it('validates and previews motion without recarving, with undo and durable saves',async()=>{
    const editor=new Editor(parseProject(legacy)),before=editor.getSnapshot().project,river=before.entities.find((e):e is River=>e.kind==='river')!;
    const field=evaluateProject(before).site.terrain;
    editor.begin('River waves');const initial=editor.getSnapshot();
    for(const invalid of [{amplitude:1},{wavelength:0},{foam:NaN},{foamPersistence:0},{wetBank:-1},{dryingTime:100},{extra:true}]){
      expect(()=>editor.preview({type:'replace',entity:{...river,water:{...river.water,...invalid}}})).toThrow();expect(editor.getSnapshot()).toBe(initial);
    }
    const changed={...river,water:{...river.water,amplitude:0.3,wavelength:4.5,foam:0.8}};
    editor.preview({type:'replace',entity:changed});expect(evaluateProject(editor.getSnapshot().preview!).site.terrain).toBe(field);
    editor.cancel();expect(editor.getSnapshot().project).toBe(before);
    editor.execute({type:'replace',entity:changed},'River waves');const after=editor.getSnapshot().project;
    editor.undo();expect(editor.getSnapshot().project).toEqual(before);editor.redo();expect(editor.getSnapshot().project).toEqual(after);
    expect(deserializeProject(serializeProject(after))).toEqual(after);await saveLocal(after);expect(await loadLocal()).toEqual(after);
    const {water:_,...missing}=changed;expect(()=>parseProject({...after,entities:[missing]})).toThrow();
  });
});
