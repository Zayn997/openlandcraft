import { describe, expect, it } from 'vitest';
import { Editor, createBuilding, createSite, duplicateAbove, openingAtPoint, parseProject, type Level, type OpeningSettings, type Wall, type WallHit } from './index';

const settings: OpeningSettings = { kind: 'window', width: 1.4, height: 1.2, sill: 0.9, snapping: true };
const level: Level = { id: 'floor', kind: 'level', parentId: 'site', visible: true, name: 'Floor', position: [23, 8, -19], rotation: 37 };
const wall: Wall = { id: 'wall', parentId: level.id, kind: 'wall', visible: true, name: 'Wall', start: [-5, -3], end: [5, -3], height: 3.2, thickness: 0.25, elevation: 0.2, color: '#eeeeee' };
function hit(host: Wall, floor: Level, along: number): WallHit {
  const length = Math.hypot(host.end[0] - host.start[0], host.end[1] - host.start[1]);
  const x = host.start[0] + (host.end[0] - host.start[0]) * along / length, z = host.start[1] + (host.end[1] - host.start[1]) * along / length, a = floor.rotation * Math.PI / 180;
  return [floor.position[0] + x * Math.cos(a) + z * Math.sin(a), floor.position[1] + 2, floor.position[2] - x * Math.sin(a) + z * Math.cos(a)];
}
describe('Click-to-place hosted openings', () => {
  it('projects rotated/transformed floors and forward, reversed, and oblique walls into host offsets', () => {
    for (const host of [wall, { ...wall, start: wall.end, end: wall.start }, { ...wall, end: [3, 3] as [number, number] }]) {
      const result = openingAtPoint(host, level, hit(host, level, 4.37), settings, 'new');
      expect(result.issue).toBeNull(); expect(result.opening?.offset).toBe(3.7);
      const free = openingAtPoint(host, level, hit(host, level, 4.37), { ...settings, snapping: false }, 'new');
      expect(free.opening?.offset).toBeCloseTo(3.67);
    }
  });
  it('anchors doors at the wall base and uses explicit sill height for windows regardless of cursor height', () => {
    const point = hit(wall, level, 4); point[1] += 20;
    expect(openingAtPoint(wall, level, point, { ...settings, kind: 'door', height: 2.1, sill: 9 }, 'door').opening?.sill).toBe(0);
    expect(openingAtPoint(wall, level, point, settings, 'window').opening?.sill).toBe(0.9);
  });
  it('rejects corners, top clipping, overlap and the ninth opening without relocating the candidate', () => {
    expect(openingAtPoint(wall, level, hit(wall, level, 0.7), settings, 'corner').issue).toContain('clear of corners');
    expect(openingAtPoint(wall, level, hit(wall, level, 5), { ...settings, height: 3 }, 'tall').issue).toContain('wall top');
    const first = openingAtPoint(wall, level, hit(wall, level, 4), settings, 'first').opening!;
    const occupied = { ...wall, openings: [first] };
    const overlap = openingAtPoint(occupied, level, hit(wall, level, 4.2), settings, 'second');
    expect(overlap.issue).toContain('0.1 m'); expect(overlap.opening?.offset).toBe(3.5);
    const full = { ...wall, openings: Array.from({ length: 8 }, (_, i) => ({ ...first, id: String(i), offset: 0.5 + i, width: 0.3 })) };
    expect(openingAtPoint(full, level, hit(wall, level, 9), { ...settings, width: 0.3 }, 'ninth').issue).toContain('8 openings');
  });
  it('rejects invalid dimensions and wrong floor without making a renderable preview', () => {
    for (const bad of [{ width: NaN }, { height: 0 }, { sill: -1 }]) expect(openingAtPoint(wall, level, hit(wall, level, 4), { ...settings, ...bad }, 'bad').opening).toBeNull();
    expect(openingAtPoint(wall, { ...level, id: 'other' }, hit(wall, level, 4), settings, 'bad').issue).toContain('active floor');
  });
  it('hover is pure; each accepted click has one undo step, persists and copies with a fresh ID', () => {
    const site = createSite({ name: 'Placement', width: 60, depth: 60, resolution: 129, preset: 'flat' });
    const project = parseProject({ ...site, entities: createBuilding(site, 0, 0, 10, 8, 'floor') });
    const editor = new Editor(project), floor = project.entities.find(e => e.kind === 'level') as Level;
    let host = project.entities.find(e => e.kind === 'wall') as Wall;
    const before = editor.getSnapshot();
    for (let i = 0; i < 10; i++) openingAtPoint(host, floor, hit(host, floor, i), settings, 'hover');
    expect(editor.getSnapshot()).toBe(before);
    for (const [i, distance] of [2, 6].entries()) {
      const result = openingAtPoint(host, floor, hit(host, floor, distance), settings, `opening-${i}`);
      expect(result.issue).toBeNull(); host = { ...host, openings: [...(host.openings ?? []), result.opening!] };
      editor.execute({ type: 'replace', entity: host }, 'Place window');
    }
    const placed = editor.getSnapshot().project;
    expect(editor.getSnapshot().past).toHaveLength(2);
    editor.undo(); expect((editor.getSnapshot().project.entities.find(e => e.id === host.id) as Wall).openings).toHaveLength(1);
    editor.redo(); expect(editor.getSnapshot().project).toEqual(placed);
    expect(parseProject(JSON.parse(JSON.stringify(placed)))).toEqual(placed);
    const copy = duplicateAbove(placed, floor.id, 3.4, 'above');
    editor.execute({ type: 'duplicateAbove', sourceId: floor.id, height: 3.4, prefix: 'above' }, 'Copy');
    const copied = editor.getSnapshot().project.entities.find(e => e.kind === 'wall' && e.parentId === copy.levelId) as Wall;
    expect(copied.openings?.map(o => o.offset)).toEqual(host.openings?.map(o => o.offset));
    expect(copied.openings?.map(o => o.id)).not.toEqual(host.openings?.map(o => o.id));
  });
});
