import { describe, expect, it } from 'vitest';
import { createBuilding, createSite, Editor, parseProject, selectionDelete, type Wall } from './index';

function scene() {
  const site = createSite({ name: 'Delete selection', width: 60, depth: 60, resolution: 129, preset: 'flat' });
  const entities = createBuilding(site, 0, 0, 12, 8, 'floor');
  const wall = entities.find((e): e is Wall => e.kind === 'wall')!;
  wall.openings = [{ id: 'door', kind: 'door', offset: 1, width: 1, height: 2.1, sill: 0 }, { id: 'window', kind: 'window', offset: 4, width: 2, height: 1.2, sill: 0.9 }];
  return { project: parseProject({ ...site, entities }), wall };
}

describe('Delete selection', () => {
  it('deletes an aperture without deleting its host or siblings, with undo/redo', () => {
    const { project, wall } = scene(), editor = new Editor(project);
    const removal = selectionDelete(project, wall.id, [], { wallId: wall.id, openingId: 'window' })!;
    editor.execute(removal.command, removal.label);
    const remaining = editor.getSnapshot().project.entities.find(e => e.id === wall.id) as Wall;
    expect(remaining.openings?.map(o => o.id)).toEqual(['door']);
    expect(editor.getSnapshot().project.entities).toHaveLength(project.entities.length);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
    editor.redo(); expect((editor.getSnapshot().project.entities.find(e => e.id === wall.id) as Wall).openings).toHaveLength(1);
  });
  it('ignores terrain, missing selections and stale aperture focus', () => {
    const { project, wall } = scene();
    for (const id of [null, 'terrain', 'missing']) expect(selectionDelete(project, id)).toBeNull();
    expect(selectionDelete(project, wall.id, [], { wallId: wall.id, openingId: 'missing' })).toBeNull();
  });
  it('deletes multiple parts as one undo step, preserving unselected parts', () => {
    const { project, wall } = scene(), editor = new Editor(project);
    const slab = project.entities.find(e => e.kind === 'slab')!;
    const removal = selectionDelete(project, slab.id, [wall.id, slab.id, wall.id])!;
    editor.execute(removal.command, removal.label);
    expect(editor.getSnapshot().project.entities.map(e => e.id)).toEqual(project.entities.filter(e => e.id !== wall.id && e.id !== slab.id).map(e => e.id));
    expect(editor.getSnapshot().past).toHaveLength(1);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
  });
  it('deletes a level and its owned parts without removing a child twice', () => {
    const { project, wall } = scene(), editor = new Editor(project);
    const removal = selectionDelete(project, 'floor', ['floor', wall.id])!;
    editor.execute(removal.command, removal.label);
    expect(editor.getSnapshot().project.entities).toEqual([]);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
  });
});
