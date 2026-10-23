import { TERRAIN_MATERIAL_DEFAULTS, WATER_APPEARANCE_DEFAULTS } from './materials';
import { COAST_DEFAULTS } from './model';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import v3 from '../../../examples/coastal-architecture.olc.json';
import fullExample from '../../../examples/coastal-river.olc.json';
import { DEFAULT_BRUSH, TerrainStroke } from '@openlandcraft/landscape';
import { deserializeProject, loadLocal, saveLocal, serializeProject } from '@openlandcraft/project';
import { Editor, createProject, createRiver, evaluateProject, groundHeight, instancePosition, parseProject, type Instance, type River } from './index';

describe('river transactions and storage', () => {
  it('migrates M2 models, heights, visibility and bytes without changes', () => {
    const current = parseProject(v3); expect(current.version).toBe(31); expect(current.assets).toEqual(v3.assets); expect(current.entities).toEqual(v3.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, direction: 20, wavelength: 10, ...COAST_DEFAULTS, appearance: WATER_APPEARANCE_DEFAULTS } : entity)); expect(current.site).toEqual({ ...v3.site, materials: TERRAIN_MATERIAL_DEFAULTS });
  });
  it('reopens the complete river/building/GLB example with identical source bytes and evaluated ground', async () => {
    const before = parseProject(fullExample), reopened = deserializeProject(serializeProject(before));
    expect(reopened).toEqual(before); expect(reopened.assets).toEqual(v3.assets); expect(reopened.site).toEqual({ ...v3.site, materials: TERRAIN_MATERIAL_DEFAULTS });
    expect(evaluateProject(reopened).site.terrain).toEqual(evaluateProject(before).site.terrain);
    await saveLocal(reopened); expect(await loadLocal()).toEqual(before);
  });
  it('shares the carved surface with terrain-anchored assets and restores it on hide', () => {
    const project = parseProject(fullExample), river = project.entities.find((entity): entity is River => entity.kind === 'river')!;
    const instance = project.entities.find((entity): entity is Instance => entity.kind === 'instance')!;
    const onChannel: Instance = { ...instance, position: [river.points[1][0], 0, river.points[1][2]] };
    expect(instancePosition(onChannel, evaluateProject(project))[1]).toBeLessThan(groundHeight(onChannel.position[0], onChannel.position[2], project.site));
    const editor = new Editor(project); editor.execute({ type: 'replace', entity: { ...river, visible: false } }, 'Hide');
    expect(evaluateProject(editor.getSnapshot().project).site.terrain).toEqual(project.site.terrain);
    editor.undo(); expect(evaluateProject(editor.getSnapshot().project).site.terrain).toEqual(evaluateProject(project).site.terrain);
  });
  it('previews many point/width changes in one step, cancels and restores derived channels', () => {
    const editor = new Editor(createProject()), river = createRiver(editor.getSnapshot().project);
    editor.execute({ type: 'add', entity: river }, 'Add river');
    const before = editor.getSnapshot().project, initial = evaluateProject(before).site.terrain;
    editor.begin('Edit river');
    for (let width = 4; width <= 6; width += 0.5) editor.preview({ type: 'replace', entity: { ...river, width } });
    expect(editor.getSnapshot().project).toBe(before); expect(evaluateProject(editor.getSnapshot().preview!).site.terrain).not.toEqual(initial);
    editor.cancel(); expect(evaluateProject(editor.getSnapshot().project).site.terrain).toEqual(initial);
    editor.begin('Edit river'); editor.preview({ type: 'replace', entity: { ...river, width: 6, depth: 2, speed: 1.2 } }); editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(2); editor.undo(); expect(editor.getSnapshot().project).toEqual(before); editor.redo();
    expect((editor.getSnapshot().project.entities.at(-1) as River).width).toBe(6);
  });
  it('preserves independent sculpting before/after carving and through river deletion and undo', () => {
    const editor = new Editor(createProject()), base = editor.getSnapshot().project;
    const river = createRiver(base); editor.execute({ type: 'add', entity: river }, 'River');
    const stroke = new TerrainStroke(base.site.terrain, base.site, DEFAULT_BRUSH); stroke.move(-18, -17);
    editor.execute({ type: 'terrain', field: stroke.snapshot() }, 'Sculpt');
    const sculpted = editor.getSnapshot().project, carved = evaluateProject(sculpted);
    expect(carved.site.terrain).not.toEqual(sculpted.site.terrain); expect(sculpted.site.terrain).toEqual(stroke.snapshot());
    editor.execute({ type: 'remove', id: river.id }, 'Delete river');
    expect(evaluateProject(editor.getSnapshot().project).site.terrain).toEqual(stroke.snapshot());
    editor.undo(); expect(evaluateProject(editor.getSnapshot().project).site.terrain).toEqual(carved.site.terrain);
    editor.undo(); expect(editor.getSnapshot().project.site.terrain).toEqual(base.site.terrain);
    editor.undo(); expect(evaluateProject(editor.getSnapshot().project)).toEqual(base);
  });
  it('rejects multiple rivers and invalid point changes without disturbing the scene or draft', () => {
    const editor = new Editor(createProject()), river = createRiver(editor.getSnapshot().project); editor.execute({ type: 'add', entity: river }, 'River');
    expect(() => editor.execute({ type: 'add', entity: { ...river, id: 'another' } }, 'Second')).toThrow('one unbranched');
    editor.begin('Edit'); const snapshot = editor.getSnapshot();
    expect(() => editor.preview({ type: 'replace', entity: { ...river, points: [[-10, 1, -10], [10, 4, 10]] } })).toThrow('descend');
    expect(editor.getSnapshot()).toBe(snapshot);
  });
  it('stores authored terrain and exact river settings rather than baked channels or runtime clock state', async () => {
    const editor = new Editor(createProject()), river = createRiver(editor.getSnapshot().project); editor.execute({ type: 'add', entity: river }, 'River');
    const authored = editor.getSnapshot().project, text = serializeProject(authored), reopened = deserializeProject(text);
    expect(reopened).toEqual(authored); expect(reopened.site.terrain).not.toEqual(evaluateProject(authored).site.terrain);
    expect(evaluateProject(reopened).site.terrain).toEqual(evaluateProject(authored).site.terrain); expect(text).not.toContain('uTime');
    await saveLocal(reopened); expect(await loadLocal()).toEqual(authored);
    const state = editor.getSnapshot(); evaluateProject(authored); evaluateProject(authored); expect(editor.getSnapshot()).toBe(state);
  });
});
