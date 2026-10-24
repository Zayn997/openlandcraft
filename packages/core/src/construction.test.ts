import { TERRAIN_MATERIAL_DEFAULTS, WATER_APPEARANCE_DEFAULTS } from './materials';
import { COAST_DEFAULTS } from './model';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import tree from '../../../examples/demo-tree.asset.json';
import v2 from '../../../examples/sculpted-coast.olc.json';
import { Editor, createBuilding, createProject, decodeGlb, encodeGlb, inspectGlb, instancePosition, parseProject, scatterInstances, type Instance, type Level, type Wall } from './index';
import { deserializeProject, loadLocal, saveLocal, serializeProject } from '@openlandcraft/project';
import { DEFAULT_BRUSH, TerrainStroke } from '@openlandcraft/landscape';

const instance: Instance = { id: 'pine-1', kind: 'instance', parentId: 'site', name: 'Pine', visible: true, assetId: tree.id, position: [-20, 0.2, 12], rotation: 15, scale: [1, 1, 1], anchor: 'terrain' };
const makeEditor = () => { const editor = new Editor(createProject()); editor.execute({ type: 'insert', assets: [tree], entities: [instance] }, 'Import and place'); return editor; };

describe('M2 building and asset authoring', () => {
  it('migrates authored v2 heights exactly and preserves all existing objects', () => {
    const migrated = parseProject(v2); expect(migrated.version).toBe(33); expect(migrated.assets).toEqual([]);
    expect(migrated.site).toEqual({ ...v2.site, materials: TERRAIN_MATERIAL_DEFAULTS }); expect(migrated.entities).toEqual(v2.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, direction: 20, wavelength: 10, ...COAST_DEFAULTS, appearance: WATER_APPEARANCE_DEFAULTS } : entity));
  });
  it('adds a coherent building in one step and cascades level deletion with reversible history', () => {
    const editor = new Editor(createProject()), before = editor.getSnapshot().project;
    const entities = createBuilding(before, -25, 10, 12, 8, 'building');
    editor.execute({ type: 'insert', entities }, 'Building');
    expect(editor.getSnapshot().project.entities).toHaveLength(before.entities.length + 7);
    expect(editor.getSnapshot().past).toHaveLength(1); editor.undo(); expect(editor.getSnapshot().project).toEqual(before); editor.redo();
    const built = editor.getSnapshot().project;
    editor.execute({ type: 'remove', id: 'building' }, 'Delete level');
    expect(editor.getSnapshot().project.entities).toEqual(before.entities); editor.undo(); expect(editor.getSnapshot().project).toEqual(built);
  });
  it('rejects missing models, duplicate sources, orphan walls and zero length walls atomically', () => {
    const editor = new Editor(createProject()), before = editor.getSnapshot();
    expect(() => editor.execute({ type: 'add', entity: instance }, 'Missing')).toThrow('missing');
    const wall = createBuilding(before.project, 0, 0, 10, 7, 'level')[1] as Wall;
    expect(() => editor.execute({ type: 'add', entity: wall }, 'Orphan')).toThrow('existing level');
    const building = createBuilding(before.project, 0, 0, 10, 7, 'level');
    building[1] = { ...wall, end: wall.start };
    expect(() => editor.execute({ type: 'insert', entities: building }, 'Degenerate')).toThrow('0.2 m');
    expect(() => editor.execute({ type: 'insert', entities: [], assets: [tree, tree] }, 'Duplicate')).toThrow('unique');
    expect(editor.getSnapshot()).toBe(before);
  });
  it('keeps building elevation fixed while terrain-anchored models track edited heights', () => {
    const editor = makeEditor(), initial = editor.getSnapshot().project;
    const building = createBuilding(initial, -20, 12, 10, 7, 'building'); editor.execute({ type: 'insert', entities: building }, 'Building');
    const baseline = editor.getSnapshot().project, world = instancePosition(instance, baseline);
    const fixed: Instance = { ...instance, id: 'fixed', anchor: 'fixed', position: world };
    editor.execute({ type: 'add', entity: fixed }, 'Fixed model');
    const stroke = new TerrainStroke(baseline.site.terrain, baseline.site, DEFAULT_BRUSH); stroke.move(-20, 12);
    editor.execute({ type: 'terrain', field: stroke.snapshot() }, 'Sculpt');
    const after = editor.getSnapshot().project;
    expect(instancePosition(instance, after)[1]).toBeGreaterThan(world[1]); expect(instancePosition(fixed, after)).toEqual(world);
    expect((after.entities.find((entity) => entity.id === 'building') as Level).position).toEqual((building[0] as Level).position);
    editor.undo(); expect(instancePosition(instance, editor.getSnapshot().project)).toEqual(world);
  });
  it('previews transforms and source attribution together, cancels and commits one undo step', () => {
    const editor = makeEditor(), before = editor.getSnapshot().project;
    editor.begin('Transform');
    for (let x = -19; x <= -10; x++) editor.preview({ type: 'batch', commands: [{ type: 'replace', entity: { ...instance, position: [x, 2, 10], rotation: 45, scale: [2, 1, 2] } }, { type: 'asset', asset: { ...tree, attribution: 'My source' } }] });
    expect(editor.getSnapshot().project).toBe(before); editor.cancel(); expect(editor.getSnapshot().project).toBe(before);
    editor.begin('Transform'); editor.preview({ type: 'replace', entity: { ...instance, position: [-10, 0, 12] } }); editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(2); editor.undo(); expect(editor.getSnapshot().project).toEqual(before);
  });
  it('scatters deterministically inside the radius with a single undo step and stable source bytes', () => {
    const a = scatterInstances(instance, 30, 9, 42, 'scatter'), b = scatterInstances(instance, 30, 9, 42, 'scatter'); expect(a).toEqual(b);
    expect(scatterInstances(instance, 30, 9, 43, 'scatter')).not.toEqual(a);
    a.forEach((entity) => { expect(Math.hypot(entity.position[0] - instance.position[0], entity.position[2] - instance.position[2])).toBeLessThanOrEqual(9); });
    expect(() => scatterInstances(instance, 1.5, 9, 42)).toThrow();
    const editor = makeEditor(), before = editor.getSnapshot().project;
    editor.execute({ type: 'insert', entities: a }, 'Scatter'); expect(editor.getSnapshot().project.assets).toBe(before.assets);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before); editor.redo(); expect(editor.getSnapshot().project.entities).toHaveLength(before.entities.length + 30);
  });
  it('round trips GLB bytes, building parameters, attribution and scatter through portable and local storage', async () => {
    const editor = makeEditor(); editor.execute({ type: 'insert', entities: [...createBuilding(editor.getSnapshot().project, -25, 12), ...scatterInstances(instance, 4, 8, 2)] }, 'Scene');
    const before = editor.getSnapshot().project, text = serializeProject(before), reopened = deserializeProject(text);
    expect(reopened).toEqual(before); expect(decodeGlb(reopened.assets[0].data)).toEqual(decodeGlb(tree.data));
    await saveLocal(reopened); expect(await loadLocal()).toEqual(before);
    editor.begin('Draft'); const snapshot = editor.getSnapshot();
    expect(() => editor.load({ ...reopened, assets: [{ ...tree, data: 'corrupt' }] })).toThrow(); expect(editor.getSnapshot()).toBe(snapshot);
  });
  it('retains reusable sources after deleting instances and prevents removing a source still in use', () => {
    const editor = makeEditor(); expect(() => editor.execute({ type: 'removeAsset', id: tree.id }, 'Remove source')).toThrow('instances');
    editor.execute({ type: 'remove', id: instance.id }, 'Delete instance'); expect(editor.getSnapshot().project.assets).toHaveLength(1);
    editor.execute({ type: 'removeAsset', id: tree.id }, 'Remove source'); expect(editor.getSnapshot().project.assets).toHaveLength(0); editor.undo(); expect(editor.getSnapshot().project.assets).toEqual([tree]);
  });
  it('validates GLB headers, chunk boundaries and embedded-only resources before parsing', () => {
    const bytes = decodeGlb(tree.data); expect(encodeGlb(bytes)).toBe(tree.data); expect(() => inspectGlb(bytes)).not.toThrow();
    const truncated = bytes.slice(0, -4); expect(() => inspectGlb(truncated)).toThrow('valid GLB');
    const invalid = bytes.slice(); new DataView(invalid.buffer).setUint32(12, invalid.length, true); expect(() => inspectGlb(invalid)).toThrow('chunk');
    const external = { asset: { version: '2.0' }, buffers: [{ uri: 'https://example.com/model.bin' }] };
    const json = JSON.stringify(external).padEnd(Math.ceil(JSON.stringify(external).length / 4) * 4, ' '), encoded = new TextEncoder().encode(json);
    const glb = new Uint8Array(20 + encoded.length), view = new DataView(glb.buffer); view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, glb.length, true); view.setUint32(12, encoded.length, true); view.setUint32(16, 0x4e4f534a, true); glb.set(encoded, 20);
    expect(() => inspectGlb(glb)).toThrow('external');
  });
});
