import { describe, expect, it } from 'vitest';
import { createSite, createBuilding, dragWall, Editor, parseProject, type Wall } from './index';

function scene() {
  const site = createSite({ name: 'Wall edit', width: 60, depth: 60, resolution: 129, preset: 'flat' });
  const entities = createBuilding(site, 0, 0, 12, 8, 'floor');
  const wall = entities.find((e): e is Wall => e.kind === 'wall')!;
  wall.openings = [{ id: 'window', kind: 'window', offset: 2, width: 2, height: 1.2, sill: 0.9 }];
  return { project: parseProject({ ...site, entities }), wall };
}
const walls = (p: ReturnType<typeof scene>['project']) => p.entities.filter((e): e is Wall => e.kind === 'wall');

describe('Direct wall gestures', () => {
  it('translates both ends with a snapped delta without changing length or hosted records', () => {
    const { wall } = scene();
    const moved = dragWall(wall, 'move', [0.37, -0.61], true);
    expect(moved.start).toEqual([wall.start[0] + 0.25, wall.start[1] - 0.5]);
    expect(moved.end).toEqual([wall.end[0] + 0.25, wall.end[1] - 0.5]);
    expect(moved.openings).toBe(wall.openings); expect(moved.id).toBe(wall.id);
    const unsnapped = dragWall(wall, 'move', [0.37, -0.61], false);
    expect(unsnapped.start[0]).toBeCloseTo(wall.start[0] + 0.37);
  });
  it('moves either endpoint and keeps the opposite end fixed', () => {
    const { wall } = scene();
    expect(dragWall(wall, 'start', [-0.37, 0.11], true).start).toEqual([-6.25, -4]);
    expect(dragWall(wall, 'start', [-0.37, 0.11], true).end).toBe(wall.end);
    expect(dragWall(wall, 'end', [0.37, 0.61], true).end).toEqual([6.25, -3.5]);
    expect(dragWall(wall, 'end', [0.37, 0.61], true).start).toBe(wall.start);
  });
  it('previews joined corners from the committed baseline and commits one history entry', () => {
    const { project, wall } = scene(), editor = new Editor(project);
    editor.begin('Move wall');
    for (const delta of [0.25, 0.5, 1]) editor.preview({ type: 'replace', entity: dragWall(wall, 'move', [0, delta], true) });
    expect(editor.getSnapshot().project).toEqual(project);
    expect(editor.getSnapshot().past).toHaveLength(0);
    const preview = editor.getSnapshot().preview!;
    expect(walls(preview).filter(w => w.start[1] === -3 || w.end[1] === -3)).toHaveLength(3);
    expect(preview.entities.filter(e => e.kind !== 'wall')).toEqual(project.entities.filter(e => e.kind !== 'wall'));
    editor.commit(); expect(editor.getSnapshot().past).toHaveLength(1);
    const result = editor.getSnapshot().project;
    editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
    editor.redo(); expect(editor.getSnapshot().project).toEqual(result);
    expect(parseProject(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });
  it('keeps independent walls independent', () => {
    const { project } = scene();
    const independent = parseProject({ ...project, entities: project.entities.map(e => e.kind === 'wall' ? { ...e, joins: false } : e) });
    const wall = walls(independent)[0], editor = new Editor(independent);
    editor.execute({ type: 'replace', entity: dragWall(wall, 'end', [1, 1], false) }, 'Endpoint');
    expect(editor.getSnapshot().project.entities.filter(e => e.id !== wall.id)).toEqual(independent.entities.filter(e => e.id !== wall.id));
  });
  it('rejects degenerate/nonfinite/out-of-bounds walls and clipped hosted openings', () => {
    const { wall } = scene();
    expect(() => dragWall({ ...wall, openings: [] }, 'end', [-12, 0], true)).toThrow();
    expect(() => dragWall(wall, 'move', [NaN, 0], true)).toThrow();
    expect(() => dragWall(wall, 'end', [101, 0], true)).toThrow();
    expect(() => dragWall(wall, 'end', [-9, 0], true)).toThrow('opening');
  });
  it('rejects a change that clips a neighboring opening and cancels the full gesture', () => {
    const { project, wall } = scene(), neighbor = walls(project)[1];
    neighbor.openings = [{ id: 'neighbor-window', kind: 'window', offset: 5, width: 2, height: 1.2, sill: 0.9 }];
    const before = parseProject(project), editor = new Editor(before);
    editor.begin('Move wall');
    editor.preview({ type: 'replace', entity: dragWall(wall, 'move', [0, 0.25], true) });
    expect(() => editor.preview({ type: 'replace', entity: dragWall(wall, 'move', [0, 2], true) })).toThrow('opening');
    editor.cancel(); expect(editor.getSnapshot().project).toEqual(before); expect(editor.getSnapshot().past).toHaveLength(0);
  });
  it('refuses an unsupported sharp joined corner and cancels without history', () => {
    const { project, wall } = scene(), editor = new Editor(project);
    editor.begin('Endpoint');
    expect(() => editor.preview({ type: 'replace', entity: dragWall(wall, 'end', [-11.5, 7.8], false) })).toThrow();
    editor.cancel(); expect(editor.getSnapshot().project).toEqual(project); expect(editor.getSnapshot().past).toHaveLength(0);
  });
});
