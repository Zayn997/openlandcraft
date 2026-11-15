import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createSite, Editor, parseProject } from './index';
import { DEFAULT_ENVIRONMENT, environmentSchema, sunDirection } from './environment';
import { deserializeProject, serializeProject, saveLocal, loadLocal } from '@openlandcraft/project';

const fixture = () => createSite({ name:'Environment',width:60,depth:60,resolution:129,preset:'flat' });
describe('scene environment', () => {
  it('upgrades format 39 without adding overrides or changing the original scene', () => {
    const old = { ...fixture(),version:39 }, before = structuredClone(old);
    const current = parseProject(old);
    expect(current).toEqual({ ...old,version:40 }); expect(current.environment).toBeUndefined(); expect(old).toEqual(before);
  });
  it('previews, cancels, commits and restores environment edits independently of geometry', async () => {
    const editor = new Editor(fixture()), before = editor.getSnapshot().project;
    const environment = { ...DEFAULT_ENVIRONMENT,season:'autumn' as const,weather:'rain' as const,sunAzimuth:90,sunElevation:12 };
    editor.begin('Sun'); editor.preview({type:'environment',environment});
    expect(editor.getSnapshot().preview?.environment).toEqual(environment); expect(editor.getSnapshot().project).toBe(before);
    editor.cancel(); expect(editor.getSnapshot().project).toBe(before);
    editor.execute({type:'environment',environment},'Environment'); const saved=editor.getSnapshot().project;
    expect(saved.environment).toEqual(environment); expect(saved.entities).toBe(before.entities); expect(saved.site).toBe(before.site);
    editor.undo(); expect(editor.getSnapshot().project).toBe(before); editor.redo(); expect(editor.getSnapshot().project).toBe(saved);
    expect(deserializeProject(serializeProject(saved))).toEqual(saved); await saveLocal(saved); expect(await loadLocal()).toEqual(saved);
    expect(() => parseProject({...saved,version:39})).toThrow();
  });
  it('rejects invalid sun angles, unknown weather and extra fields', () => {
    for(const patch of [{sunAzimuth:361},{sunElevation:-1},{sunElevation:NaN},{weather:'hail'},{unrecognized:true}]) expect(environmentSchema.safeParse({...DEFAULT_ENVIRONMENT,...patch}).success).toBe(false);
  });
  it('places the sun clockwise from north and above the horizon', () => {
    expect(sunDirection({...DEFAULT_ENVIRONMENT,sunAzimuth:0,sunElevation:0})).toEqual([0,0,-1]);
    const east=sunDirection({...DEFAULT_ENVIRONMENT,sunAzimuth:90,sunElevation:0}); expect(east[0]).toBeCloseTo(1);expect(east[2]).toBeCloseTo(0);
    const zenith=sunDirection({...DEFAULT_ENVIRONMENT,sunElevation:90});expect(zenith[1]).toBeCloseTo(1);expect(Math.hypot(zenith[0],zenith[2])).toBeCloseTo(0);
  });
});
