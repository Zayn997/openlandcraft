import { describe, expect, it } from 'vitest';
import { createDrawnSurface, createSite, createWallChain, Editor, partBounds, type Level } from '@openlandcraft/core';
import { resolveDrawingLevel } from './drawing-level';

const ground: Level = { id: 'ground', name: 'Level 1', kind: 'level', parentId: 'site', visible: true, position: [0, 0, 0], rotation: 0 };
const upper: Level = { ...ground, id: 'upper', name: 'Level 2', position: [10, 7, -8], rotation: 90 };
function scene() {
  const project = createSite({ name: 'Selected level', width: 60, depth: 60, resolution: 129, preset: 'flat' });
  const floor = { ...createDrawnSurface('floor', upper, [[0, 0], [6, 0], [6, 6], [0, 6]], 0, 0.2), id: 'upper-floor' };
  project.entities = [ground, upper, floor];
  return project;
}

describe('Selected architecture drawing level', () => {
  it.each(['upper', 'upper-floor'])('creates walls on Level 2 when %s is selected, even with Level 1 first', selectedId => {
    const project = scene(), editor = new Editor(project);
    editor.select(selectedId);
    const level = resolveDrawingLevel(project, editor.getSnapshot().selectedId, [ground, upper])!;
    expect(level.id).toBe('upper');
    const walls = createWallChain(project, level.id, [[0, 0], [5, 0]], false, 'new-wall', false);
    editor.execute({ type: 'insert', entities: walls }, 'Draw wall');
    expect(walls[0].parentId).toBe('upper');
    // Local base offset remains relative to the elevated, rotated level.
    expect(partBounds(walls[0], level).min[1]).toBeCloseTo(7.2);
    expect(editor.getSnapshot().project.entities.filter(e => e.kind === 'wall' && e.parentId === 'ground')).toEqual([]);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
  });
  it('honors an explicit level and requires a choice when selection has no available level', () => {
    const project = scene();
    expect(resolveDrawingLevel(project, 'upper', [ground, upper], 'ground')?.id).toBe('ground');
    expect(resolveDrawingLevel(project, null, [ground, upper])).toBeUndefined();
    expect(resolveDrawingLevel(project, 'terrain', [ground, upper])).toBeUndefined();
    // Hidden, locked, or isolated-out levels are excluded by the caller.
    expect(resolveDrawingLevel(project, 'upper', [ground])).toBeUndefined();
    expect(resolveDrawingLevel(project, 'upper', [ground, upper], 'deleted')).toBeUndefined();
  });
});
