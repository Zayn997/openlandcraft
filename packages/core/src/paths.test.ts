import { defaultLayers } from './layers';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import legacy from '../../../examples/river-water-study.olc.json';
import { createBuilding, createPath, createSite, Editor, evaluateProject, parseProject, snapPathPoint, type Path } from './index';
import { pathIssue, pathLength, TerrainStroke, DEFAULT_BRUSH } from '@openlandcraft/landscape';
import { deserializeProject, serializeProject, saveLocal, loadLocal } from '@openlandcraft/project';

const site = () => createSite({ name: 'Path test', width: 60, depth: 48, resolution: 129, preset: 'flat' });
describe('path authoring and compatibility', () => {
  it('migrates version 8 without changing water, terrain or source entities', () => {
    const source = structuredClone(legacy), current = parseProject(legacy);
    expect(current).toEqual({...source,version:14,layers:defaultLayers(),objectLayers:{},activeLayerId:"default"}); expect(legacy).toEqual(source);
    expect(() => parseProject({ ...current, version: 15 })).toThrow();
    expect(() => parseProject({ ...source, entities: [...source.entities, createPath(current)] })).toThrow();
  });
  it('rejects unsupported geometry, modes and second paths atomically', () => {
    const editor = new Editor(site()), path = createPath(editor.getSnapshot().project);
    editor.execute({ type: 'add', entity: path }, 'Path'); const before = editor.getSnapshot();
    for (const patch of [{ width: 9 }, { width: NaN }, { surface: 'asphalt' }, { elevationMode: 'fixed' }, { points: [[0, 0]] }, { points: [[0, 0], [0.2, 0]] }, { points: [[-31, 0], [29, 0]], width: 8 }, { points: [[-10,-10],[10,10],[-10,10],[10,-10]] }, { points: [[0,0],[10,0],[0,0]] }]) {
      expect(() => editor.execute({ type: 'replace', entity: { ...path, ...patch } as Path }, 'Invalid')).toThrow(); expect(editor.getSnapshot()).toBe(before);
    }
    expect(() => editor.execute({ type: 'add', entity: { ...path, id: 'second', visible: false } }, 'Second')).toThrow('one unbranched path');
  });
  it('accepts bounded miter turns and dimensions; rejects width overlap', () => {
    expect(pathIssue({ points: [[-10,0],[0,0],[0,10]], width: 2 }, site().site)).toBeNull();
    expect(pathLength([[-10,0],[0,0],[0,10]])).toBe(20);
    expect(pathIssue({ points: [[-10,0],[0,0],[0,4],[-10,4]], width: 8 }, site().site)).toBeTruthy();
    expect(pathIssue({ points: [[0,0],[10,0],[1,1]], width: 2 }, site().site)).toMatch(/sharp/);
  });
  it('snaps only enabled endpoints to visible rotated building anchors, otherwise the grid', () => {
    const project = site(); project.entities = createBuilding(project, 0, 0, 10, 6, 'pavilion');
    const level = project.entities[0]; if (level.kind !== 'level') throw new Error('level'); level.rotation = 90;
    expect(snapPathPoint(project, [0.2,-4.8], true)).toEqual({ point: expect.arrayContaining([expect.closeTo(0, 6), expect.closeTo(-5, 6)]), target: expect.any(String) });
    expect(snapPathPoint(project, [0.2,-4.8], false).point).toEqual([0.2,-4.8]);
    expect(snapPathPoint(project, [0.2,-4.8], true, false)).toEqual({ point:[0,-5], target:null });
    level.visible = false; expect(snapPathPoint(project, [0.2,-4.8], true).target).toBeNull();
  });
  it('previews one undo step, retains independent sculpting on hide/delete, and round trips', async () => {
    const editor = new Editor(site()), original = editor.getSnapshot().project, path = createPath(original);
    editor.execute({ type: 'add', entity: path }, 'Add path');
    const before = editor.getSnapshot().project;
    editor.begin('Edit path'); editor.preview({ type: 'replace', entity: { ...path, width: 3, surface: 'paving' } });
    expect(editor.getSnapshot().project).toBe(before); editor.cancel(); expect(editor.getSnapshot().project).toBe(before);
    editor.begin('Edit path'); for (const width of [2.5, 3, 3.5]) editor.preview({ type: 'replace', entity: { ...path, width, surface: 'timber' } }); editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(2); const edited = editor.getSnapshot().project;
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before); editor.redo(); expect(editor.getSnapshot().project).toEqual(edited);
    const stroke = new TerrainStroke(original.site.terrain, original.site, DEFAULT_BRUSH); stroke.move(...path.points[1]);
    editor.execute({ type: 'terrain', field: stroke.snapshot() }, 'Sculpt'); const sculpted = editor.getSnapshot().project;
    editor.execute({ type: 'remove', id: path.id }, 'Delete path'); expect(editor.getSnapshot().project.site.terrain).toEqual(sculpted.site.terrain);
    editor.undo(); const restored = editor.getSnapshot().project;
    expect(evaluateProject(restored).site.terrain).toEqual(sculpted.site.terrain);
    expect(deserializeProject(serializeProject(restored))).toEqual(restored); await saveLocal(restored); expect(await loadLocal()).toEqual(restored);
    expect(serializeProject(restored)).not.toContain('samples');
  });
});
