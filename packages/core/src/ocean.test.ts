import { RIVER_WATER_DEFAULTS } from './river-water';
import { TERRAIN_MATERIAL_DEFAULTS, WATER_APPEARANCE_DEFAULTS } from './materials';
import { COAST_DEFAULTS } from './model';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import v4 from '../../../examples/coastal-river.olc.json';
import v5 from '../../../examples/coastal-ocean.olc.json';
import { Editor, createOcean, createSite, OCEAN_DEFAULTS, parseProject, type Ocean } from './index';
import { deserializeProject, loadLocal, saveLocal, serializeProject } from '@openlandcraft/project';

describe('ocean foundation and version 10 persistence', () => {
  it('migrates version 5 settings to explicit bounded shore controls without changing source data', () => {
    const current = parseProject(v5); expect(current.version).toBe(15);
    expect(current.site).toEqual({ ...v5.site, materials: TERRAIN_MATERIAL_DEFAULTS }); expect(current.assets).toEqual(v5.assets);
    expect(current.entities).toEqual(v5.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, ...COAST_DEFAULTS, appearance: WATER_APPEARANCE_DEFAULTS } : entity.kind === 'river' ? { ...entity, appearance: WATER_APPEARANCE_DEFAULTS, water: RIVER_WATER_DEFAULTS } : entity));
    const water = current.entities.find((entity): entity is Ocean => entity.kind === 'ocean')!;
    expect(() => parseProject({ ...current, entities: current.entities.map((entity) => entity.id === water.id ? { ...water, foamPersistence: 0 } : entity) })).toThrow();
    expect(deserializeProject(serializeProject(current))).toEqual(current);
  });
  it('migrates version 4 water explicitly while preserving ground, river, buildings, and GLB bytes', () => {
    const original = structuredClone(v4), current = parseProject(v4);
    expect(current.version).toBe(15); expect(v4).toEqual(original);
    expect(current.site).toEqual({ ...v4.site, materials: TERRAIN_MATERIAL_DEFAULTS }); expect(current.assets).toEqual(v4.assets);
    expect(current.entities).toEqual(v4.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, direction: OCEAN_DEFAULTS.direction, wavelength: OCEAN_DEFAULTS.wavelength, ...COAST_DEFAULTS, appearance: WATER_APPEARANCE_DEFAULTS } : entity.kind === 'river' ? { ...entity, appearance: WATER_APPEARANCE_DEFAULTS, water: RIVER_WATER_DEFAULTS } : entity));
    const noOcean = { ...v4, entities: v4.entities.filter((entity) => entity.kind !== 'ocean') };
    expect(parseProject(noOcean).entities).toEqual(noOcean.entities.map((entity) => entity.kind === 'river' ? { ...entity, appearance: WATER_APPEARANCE_DEFAULTS, water: RIVER_WATER_DEFAULTS } : entity));
    expect(() => parseProject({ ...v4, entities: v4.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, unsupported: true } : entity) })).toThrow();
  });
  it('adds, edits, cancels, removes, and restores an ocean on a flat site', () => {
    const editor = new Editor(createSite({ name: 'Flat site', width: 40, depth: 30, resolution: 129, preset: 'flat' }));
    const initial = editor.getSnapshot().project, ocean = { ...createOcean('new-ocean'), level: 2.5 };
    editor.execute({ type: 'add', entity: ocean }, 'Add ocean'); const added = editor.getSnapshot().project;
    editor.begin('Waves'); editor.preview({ type: 'replace', entity: { ...ocean, direction: 125, wavelength: 18, amplitude: 0.6, speed: 1.4 } });
    expect(editor.getSnapshot().project).toBe(added); editor.cancel(); expect(editor.getSnapshot().past).toHaveLength(1);
    editor.begin('Waves'); editor.preview({ type: 'replace', entity: { ...ocean, direction: 125, wavelength: 18 } }); editor.commit();
    editor.undo(); expect(editor.getSnapshot().project).toEqual(added); editor.redo();
    expect((editor.getSnapshot().project.entities[0] as Ocean).direction).toBe(125);
    editor.execute({ type: 'remove', id: ocean.id }, 'Delete ocean'); expect(editor.getSnapshot().project.entities).toEqual([]);
    editor.undo(); editor.undo(); editor.undo(); expect(editor.getSnapshot().project).toEqual(initial);
  });
  it('rejects invalid waves and duplicate oceans without altering a pending preview', () => {
    const editor = new Editor(parseProject(v4)), ocean = editor.getSnapshot().project.entities.find((entity): entity is Ocean => entity.kind === 'ocean')!;
    expect(() => editor.execute({ type: 'add', entity: createOcean('second') }, 'Duplicate')).toThrow('one ocean');
    editor.begin('Edit'); const before = editor.getSnapshot();
    for (const invalid of [{ direction: -1 }, { direction: 361 }, { wavelength: 0 }, { wavelength: 41 }, { amplitude: 0.81 }, { speed: NaN }, { breaker: 3 }, { foam: -1 }, { foamPersistence: 21 }, { swash: -0.1 }, { wetSand: 2 }, { dryingTime: 0 }]) {
      expect(() => editor.preview({ type: 'replace', entity: { ...ocean, ...invalid } })).toThrow(); expect(editor.getSnapshot()).toBe(before);
    }
    const { direction, ...missing } = ocean;
    expect(() => parseProject({ ...before.project, entities: [missing] })).toThrow();
  });
  it('round trips authored settings through portable and local saves with no runtime phase or GPU data', async () => {
    const project = parseProject(v4);
    project.entities = project.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, direction: 270, wavelength: 4, amplitude: 0, speed: 0, level: 1.5, breaker: 0.7, foam: 0.4, foamPersistence: 12, swash: 1.6, wetSand: 0.6, dryingTime: 45 } : entity);
    const text = serializeProject(project), reopened = deserializeProject(text);
    expect(reopened).toEqual(project); expect(text).not.toMatch(/uPhase|uGround|playing|quality/);
    await saveLocal(reopened); expect(await loadLocal()).toEqual(project);
  });
});
