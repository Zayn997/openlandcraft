import { describe, expect, it } from 'vitest';
import legacy from '../../../examples/water-system.olc.json';
import { createSite, createProject, Editor, parseProject, PlantBrushStroke, DEFAULT_PLANT_BRUSH, plantingObstacle, evaluateProject, type Instance } from './index';
import { serializeProject, deserializeProject } from '../../project/src/index';

const asset = parseProject(legacy).assets[0];
const scene = () => createSite({ name: 'Brush test', width: 80, depth: 80, resolution: 129, preset: 'flat' });
const positions = (s: PlantBrushStroke) => s.instances.map(e => [e.position, e.rotation, e.scale]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

describe('plant scatter brush', () => {
  it('paints the same area for fast and slow input without stationary buildup', () => {
    const fast = new PlantBrushStroke(scene(), asset, DEFAULT_PLANT_BRUSH, 42);
    const slow = new PlantBrushStroke(scene(), asset, DEFAULT_PLANT_BRUSH, 42);
    fast.move(-20, 0); fast.move(20, 0);
    for (let x = -20; x <= 20; x += 0.25) slow.move(x, 0);
    expect(positions(fast)).toEqual(positions(slow));
    const count = slow.instances.length;
    for (let i = 0; i < 100; i++) slow.move(20, 0);
    slow.move(-20, 0);
    expect(slow.instances).toHaveLength(count);
    const expected = (Math.PI * 25 + 40 * 10) * DEFAULT_PLANT_BRUSH.density / 100;
    expect(count).toBeGreaterThan(expected * 0.8); expect(count).toBeLessThan(expected * 1.2);
  });
  it('honors density, uniform random size, rotation, and terrain anchoring', () => {
    const paint = (density: number) => { const s = new PlantBrushStroke(scene(), asset, { radius: 15, density, scaleMin: 0.5, scaleMax: 1.5 }, 56); s.move(0, 0); return s; };
    const low = paint(8), high = paint(64);
    expect(high.instances.length).toBeGreaterThan(low.instances.length * 6);
    expect(new Set(high.instances.map(e => e.scale[0])).size).toBeGreaterThan(high.instances.length * 0.95);
    for (const e of high.instances) {
      expect(e.scale[0]).toBeGreaterThanOrEqual(0.5); expect(e.scale[0]).toBeLessThanOrEqual(1.5);
      expect(e.scale).toEqual([e.scale[0], e.scale[0], e.scale[0]]);
      expect(e.rotation).toBeGreaterThanOrEqual(0); expect(e.rotation).toBeLessThan(360);
      expect(e.anchor).toBe('terrain'); expect(e.position[1]).toBe(0);
    }
  });
  it('clips to the site, skips obstacles, and breaks paths outside the terrain', () => {
    const project = createProject(), settings = { ...DEFAULT_PLANT_BRUSH, radius: 20, density: 100 };
    const stroke = new PlantBrushStroke(project, asset, settings, 9);
    stroke.move(-44, -35); stroke.move(44, 35);
    const blocked = plantingObstacle(evaluateProject(project), { clearance: 0.25, exclusions: { water: true, buildings: true, paths: true } });
    expect(stroke.instances.length).toBeGreaterThan(10);
    for (const e of stroke.instances) {
      expect(Math.abs(e.position[0])).toBeLessThanOrEqual(45); expect(Math.abs(e.position[2])).toBeLessThanOrEqual(36);
      expect(blocked(e.position[0], e.position[2])).toBe(false);
    }
    const broken = new PlantBrushStroke(scene(), asset, { ...settings, radius: 2 }, 9);
    broken.move(-30, 0); broken.move(100, 0); broken.move(30, 0);
    expect(broken.instances.every(e => Math.abs(e.position[0]) > 27)).toBe(true);
  });
  it('caps the scene at 1,000 objects and rejects unsafe settings', () => {
    const project = scene();
    project.entities = Array.from({ length: 998 }, (_, i): Instance => ({ id: `other-${i}`, kind: 'instance', assetId: 'other', parentId: 'site', name: 'Other', visible: true, position: [-39, 0, -39], rotation: 0, scale: [1, 1, 1], anchor: 'terrain' }));
    const stroke = new PlantBrushStroke(project, asset, { ...DEFAULT_PLANT_BRUSH, density: 100 }, 0);
    stroke.move(0, 0); expect(stroke.instances).toHaveLength(2); expect(stroke.limited).toBe(true);
    for (const settings of [{ radius: NaN }, { density: Infinity }, { scaleMin: 2, scaleMax: 1 }]) expect(() => new PlantBrushStroke(scene(), asset, { ...DEFAULT_PLANT_BRUSH, ...settings }, 0)).toThrow();
  });
  it('commits an entire stroke and its source as one undo step, persists, and cancels cleanly', () => {
    const editor = new Editor(scene()), before = serializeProject(editor.getSnapshot().project);
    const stroke = new PlantBrushStroke(editor.getSnapshot().project, asset, DEFAULT_PLANT_BRUSH, 13);
    editor.begin('Paint trees');
    for (const x of [-10, 0, 10]) { stroke.move(x, 0); editor.preview({ type: 'insert', entities: [...stroke.instances], assets: [asset] }); }
    expect(editor.getSnapshot().past).toHaveLength(0);
    expect(serializeProject(editor.getSnapshot().project)).toBe(before);
    editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(1);
    const painted = serializeProject(editor.getSnapshot().project);
    expect(deserializeProject(painted).entities).toHaveLength(stroke.instances.length);
    expect(editor.getSnapshot().project.assets).toHaveLength(1);
    editor.undo(); expect(serializeProject(editor.getSnapshot().project)).toBe(before);
    editor.redo(); expect(serializeProject(editor.getSnapshot().project)).toBe(painted);
    editor.undo(); editor.begin('Cancelled painting');
    editor.preview({ type: 'insert', entities: [...stroke.instances], assets: [asset] }); editor.cancel();
    expect(serializeProject(editor.getSnapshot().project)).toBe(before);
  });
});
