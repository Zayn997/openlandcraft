import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import v6 from '../../../examples/coastal-water-study.olc.json';
import { DEFAULT_BRUSH, TerrainStroke } from '@openlandcraft/landscape';
import { deserializeProject, loadLocal, saveLocal, serializeProject } from '@openlandcraft/project';
import { Editor, createProject, createRiver, evaluateProject, parseProject, TERRAIN_MATERIAL_DEFAULTS, TERRAIN_PRESETS, WATER_APPEARANCE_DEFAULTS, WATER_PRESETS, terrainMaterialsSchema, waterAppearanceSchema, type Ocean } from './index';

describe('authored terrain and water materials', () => {
  it('migrates v6 without mutating the source or changing geometry and wave controls', () => {
    const source = structuredClone(v6), current = parseProject(v6);
    expect(current.version).toBe(39); expect(v6).toEqual(source);
    expect(current.site).toEqual({ ...source.site, materials: TERRAIN_MATERIAL_DEFAULTS });
    expect(current.assets).toEqual(source.assets);
    expect(current.entities).toEqual(source.entities.map(entity => ({ ...entity, appearance: WATER_APPEARANCE_DEFAULTS })));
    expect(() => parseProject({ ...current, version:40 })).toThrow();
  });
  it('keeps a material gesture atomic across preview, cancel, terrain patches, undo and redo', () => {
    const editor = new Editor(createProject()), before = editor.getSnapshot().project;
    editor.begin('Materials');
    for (const scale of [0.5, 1.5, 2]) editor.preview({ type: 'materials', materials: { ...TERRAIN_PRESETS[1].value, scale } });
    expect(editor.getSnapshot().project).toBe(before); expect(editor.getSnapshot().preview!.site.terrain).toBe(before.site.terrain);
    editor.cancel(); expect(editor.getSnapshot().past).toHaveLength(0);
    editor.execute({ type: 'materials', materials: TERRAIN_PRESETS[1].value }, 'Materials');
    const materialProject = editor.getSnapshot().project;
    expect(editor.getSnapshot().past).toHaveLength(1); expect(materialProject.site.materials).toEqual(TERRAIN_PRESETS[1].value);
    const stroke = new TerrainStroke(before.site.terrain, before.site, DEFAULT_BRUSH); stroke.move(-15, 7);
    editor.execute({ type: 'terrain', field: stroke.snapshot() }, 'Sculpt'); const sculpted = editor.getSnapshot().project;
    expect(editor.getSnapshot().past[1].type).toBe('terrain');
    editor.undo(); expect(editor.getSnapshot().project).toEqual(materialProject);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before);
    editor.redo(); editor.redo(); expect(editor.getSnapshot().project).toEqual(sculpted);
    editor.execute({ type: 'materials', materials: sculpted.site.materials }, 'No change'); expect(editor.getSnapshot().past).toHaveLength(2);
  });
  it('rejects malformed current materials atomically, including missing fields and non-finite values', () => {
    const editor = new Editor(createProject()); editor.begin('Materials'); const before = editor.getSnapshot();
    for (const invalid of [{ scale: 0 }, { roughness: 2 }, { rockSlope: NaN }, { grass: 'green' }, { unexpected: true }]) {
      expect(() => editor.preview({ type: 'materials', materials: { ...TERRAIN_MATERIAL_DEFAULTS, ...invalid } })).toThrow();
      expect(editor.getSnapshot()).toBe(before);
    }
    const { materials: _, ...site } = before.project.site;
    expect(() => parseProject({ ...before.project, site })).toThrow();
    const ocean = before.project.entities.find((e): e is Ocean => e.kind === 'ocean')!;
    for (const invalid of [{ clarity: 0 }, { roughness: Infinity }, { rippleScale: 5 }, { unsupported: true }]) {
      expect(() => editor.preview({ type: 'replace', entity: { ...ocean, appearance: { ...ocean.appearance, ...invalid } } })).toThrow();
      expect(editor.getSnapshot()).toBe(before);
    }
    const { appearance: __, ...water } = ocean;
    expect(() => parseProject({ ...before.project, entities: [water] })).toThrow();
  });
  it('reuses carved geometry for appearance changes and rebuilds it for actual channel edits', () => {
    const editor = new Editor(createProject()), river = createRiver(editor.getSnapshot().project);
    editor.execute({ type: 'add', entity: river }, 'River'); const before = editor.getSnapshot().project;
    const initial = evaluateProject(before).site.terrain;
    editor.execute({ type: 'replace', entity: { ...river, color: '#123456', speed: 1.1, appearance: WATER_PRESETS[1].value } }, 'Water');
    expect(evaluateProject(editor.getSnapshot().project).site.terrain).toBe(initial);
    editor.execute({ type: 'materials', materials: TERRAIN_PRESETS[2].value }, 'Ground');
    expect(evaluateProject(editor.getSnapshot().project).site.terrain).toBe(initial);
    editor.execute({ type: 'replace', entity: { ...river, width: river.width + 1 } }, 'Width');
    expect(evaluateProject(editor.getSnapshot().project).site.terrain).not.toBe(initial);
    expect(editor.getSnapshot().project.site.terrain).toBe(before.site.terrain);
  });
  it('round trips custom settings on land, ocean and river in both portable and local saves', async () => {
    const project = createProject(); project.site.materials = { ...TERRAIN_PRESETS[2].value, scale: 2.5 };
    project.entities = project.entities.map(entity => entity.kind === 'ocean' ? { ...entity, appearance: WATER_PRESETS[1].value } : entity);
    project.entities.push({ ...createRiver(project), appearance: WATER_PRESETS[2].value });
    const text = serializeProject(project); expect(deserializeProject(text)).toEqual(project);
    expect(text).not.toMatch(/uClarity|uGround|uRippleScale/);
    await saveLocal(project); expect(await loadLocal()).toEqual(project);
    for (const preset of TERRAIN_PRESETS) expect(terrainMaterialsSchema.parse(preset.value)).toEqual(preset.value);
    for (const preset of WATER_PRESETS) expect(waterAppearanceSchema.parse(preset.value)).toEqual(preset.value);
  });
});
