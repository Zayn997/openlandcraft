import { describe, expect, it } from 'vitest';
import { createBuilding, createSite, dragOpening, editOpening, Editor, parseProject, type Wall } from './index';

function scene() {
  const site = createSite({ name: 'Opening edit', width: 60, depth: 60, resolution: 129, preset: 'flat' });
  const entities = createBuilding(site, 0, 0, 12, 8, 'floor');
  const wall = entities.find((e): e is Wall => e.kind === 'wall')!;
  wall.openings = [
    { id: 'door', kind: 'door', offset: 1, width: 1, height: 2.1, sill: 0 },
    { id: 'window', kind: 'window', offset: 4, width: 2, height: 1.2, sill: 0.9 },
  ];
  return { project: parseProject({ ...site, entities }), wall };
}
describe('Direct opening edits', () => {
  it('moves from the original offset, retaining the grab position, identity, size and siblings', () => {
    const { wall } = scene();
    const moved = dragOpening(wall, 'window', 'move', 1.36, true);
    expect(moved.openings![1]).toEqual({ ...wall.openings![1], offset: 5.4 });
    expect(moved.openings![0]).toBe(wall.openings![0]);
    expect(dragOpening(wall, 'window', 'move', 1.36, false).openings![1].offset).toBeCloseTo(5.36);
    expect(wall.openings![1].offset).toBe(4);
  });
  it('resizes either edge with a fixed opposite edge and raises the head without changing sill', () => {
    const { wall } = scene();
    const left = dragOpening(wall, 'window', 'start', -0.33, true).openings![1];
    expect(left.offset).toBe(3.7); expect(left.offset + left.width).toBe(6);
    const right = dragOpening(wall, 'window', 'end', 0.34, true).openings![1];
    expect(right.offset).toBe(4); expect(right.width).toBeCloseTo(2.3);
    const top = dragOpening(wall, 'window', 'top', 0.32, true).openings![1];
    expect(top.sill).toBe(0.9); expect(top.height).toBeCloseTo(1.5);
    expect(dragOpening(wall, 'door', 'top', 0.2, true).openings![0].sill).toBe(0);
  });
  it('rejects overlaps, corners, inverted handles, small cuts, clipping, NaN and missing hosts', () => {
    const { wall } = scene();
    for (const [mode, delta] of [['move', -2.5], ['move', 8], ['start', 3], ['end', -1.8], ['top', 2], ['move', NaN]] as const)
      expect(() => dragOpening(wall, 'window', mode, delta, true)).toThrow();
    expect(() => editOpening(wall, 'missing', { width: 1 })).toThrow('no longer exists');
    expect(() => editOpening(wall, 'door', { sill: 0.2 })).toThrow('wall base');
    expect(() => editOpening(wall, 'window', { width: NaN })).toThrow();
  });
  it('previews an entire drag against committed data and commits as a single undo action', () => {
    const { project, wall } = scene(), editor = new Editor(project);
    editor.begin('Move opening');
    for (const delta of [0.2, 0.6, 1.1]) editor.preview({ type: 'replace', entity: dragOpening(wall, 'window', 'move', delta, true) });
    expect(editor.getSnapshot().project).toEqual(project); expect(editor.getSnapshot().past).toHaveLength(0);
    editor.commit(); expect(editor.getSnapshot().past).toHaveLength(1);
    const result = editor.getSnapshot().project;
    expect((result.entities.find(e => e.id === wall.id) as Wall).openings![1].offset).toBe(5.1);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
    editor.redo(); expect(editor.getSnapshot().project).toEqual(result);
    expect(parseProject(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });
  it('cancels the whole gesture after an invalid final move and makes a click-only transaction a no-op', () => {
    const { project, wall } = scene(), editor = new Editor(project);
    editor.begin('Move opening'); editor.preview({ type: 'replace', entity: dragOpening(wall, 'window', 'move', 0.5, true) });
    expect(() => dragOpening(wall, 'window', 'move', -2.5, true)).toThrow();
    editor.cancel(); expect(editor.getSnapshot().project).toEqual(project); expect(editor.getSnapshot().past).toHaveLength(0);
    editor.begin('Select opening'); editor.cancel(); expect(editor.getSnapshot().past).toHaveLength(0);
  });
  it('numeric replacement and deletion remain undoable without affecting the wall chain', () => {
    const { project, wall } = scene(), editor = new Editor(project);
    editor.execute({ type: 'replace', entity: editOpening(wall, 'window', { offset: 4.5, width: 1.8, sill: 1, height: 1.5 }) }, 'Dimensions');
    const edited = editor.getSnapshot().project, host = edited.entities.find(e => e.id === wall.id) as Wall;
    editor.execute({ type: 'replace', entity: { ...host, openings: host.openings!.filter(o => o.id !== 'window') } }, 'Delete opening');
    editor.undo(); expect(editor.getSnapshot().project).toEqual(edited);
    expect(edited.entities.filter(e => e.id !== wall.id)).toEqual(project.entities.filter(e => e.id !== wall.id));
  });
});
