import { WATER_APPEARANCE_DEFAULTS } from './materials';
import { COAST_DEFAULTS } from './model';
import 'fake-indexeddb/auto';
import legacy from '../../../examples/coastal-study.olc.json';
import { describe, expect, it } from 'vitest';
import { Editor, createProject, groundHeight, parseProject, type Block } from './index';
import { TerrainStroke, DEFAULT_BRUSH } from '@openlandcraft/landscape';
import { saveLocal, loadLocal, serializeProject, deserializeProject } from '@openlandcraft/project';

describe('terrain transactions and project migration', () => {
  it('migrates a version 1 project without changing objects or water settings', () => {
    const migrated = parseProject(legacy);
    expect(migrated.version).toBe(33);
    expect(migrated.entities).toEqual(legacy.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, direction: 20, wavelength: 10, ...COAST_DEFAULTS, appearance: WATER_APPEARANCE_DEFAULTS } : entity));
    expect(migrated.site.terrain.heights).toHaveLength(129 * 105);
    expect(Number.isFinite(groundHeight(0, 0, migrated.site))).toBe(true);
    expect(() => parseProject({ ...migrated, site: { ...migrated.site, terrain: { ...migrated.site.terrain, heights: [] } } })).toThrow();
  });
  it('commits a full stroke as one bounded patch and interleaves with object history', () => {
    const editor = new Editor(createProject());
    const before = editor.getSnapshot().project;
    const stroke = new TerrainStroke(before.site.terrain, before.site, DEFAULT_BRUSH);
    editor.select('terrain'); editor.begin('Raise terrain');
    for (let x = -20; x <= -10; x++) {
      stroke.move(x, 12); editor.preview({ type: 'terrain', field: stroke.snapshot() });
    }
    expect(editor.getSnapshot().project).toBe(before);
    editor.commit();
    const afterTerrain = editor.getSnapshot().project;
    const entry = editor.getSnapshot().past[0];
    expect(entry.type).toBe('terrain');
    if (entry.type === 'terrain') expect(entry.patch.indices.length).toBeLessThan(before.site.terrain.heights.length / 4);
    const block = afterTerrain.entities[0] as Block;
    editor.execute({ type: 'replace', entity: { ...block, size: [9, 9, 9] } }, 'Resize');
    expect(editor.getSnapshot().project.site.terrain).toBe(afterTerrain.site.terrain);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(afterTerrain);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before);
    editor.redo(); expect(editor.getSnapshot().project).toEqual(afterTerrain);
    editor.redo(); expect((editor.getSnapshot().project.entities[0] as Block).size).toEqual([9, 9, 9]);
  });
  it('cancels strokes without persistence or history changes', () => {
    const editor = new Editor(createProject());
    const before = editor.getSnapshot().project;
    const stroke = new TerrainStroke(before.site.terrain, before.site, DEFAULT_BRUSH); stroke.move(-12, 8);
    editor.begin('Raise terrain'); editor.preview({ type: 'terrain', field: stroke.snapshot() });
    expect(deserializeProject(serializeProject(editor.getSnapshot().project))).toEqual(before);
    editor.cancel(); expect(editor.getSnapshot().project).toBe(before);
    expect(editor.getSnapshot().past).toHaveLength(0);
  });
  it('reopens exact sculpted heights in local storage and portable files', async () => {
    const editor = new Editor(createProject());
    const project = editor.getSnapshot().project;
    const stroke = new TerrainStroke(project.site.terrain, project.site, DEFAULT_BRUSH); stroke.move(-8, 3);
    editor.execute({ type: 'terrain', field: stroke.snapshot() }, 'Raise');
    const sculpted = editor.getSnapshot().project;
    const reopened = deserializeProject(serializeProject(sculpted));
    expect(reopened.site.terrain.heights).toEqual(sculpted.site.terrain.heights);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('openlandcraft');
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
    expect(await loadLocal()).toBeNull();
    const freshEditor = new Editor(createProject()); freshEditor.load(reopened);
    await saveLocal(freshEditor.getSnapshot().project); expect(await loadLocal()).toEqual(sculpted);
    editor.begin('Preview');
    const before = editor.getSnapshot();
    expect(() => editor.load({ ...sculpted, site: { ...sculpted.site, terrain: { columns: 3, rows: 3, heights: [] } } })).toThrow();
    expect(editor.getSnapshot()).toBe(before);
  });
});
