import { describe, expect, it } from 'vitest';
import { applyCommand, createBuilding, createCurvedWall, createSite, Editor, mirrorAxisPoint, mirrorMemberId, mirrorReferenceLines, mirrorSelection, type Block, type Level, type MirrorRule, type Wall } from './index';

const block: Block = { id: 'source', name: 'Source block', parentId: 'site', kind: 'block', visible: true, position: [-8, 2, 3], rotation: 0, size: [2, 3, 4], color: '#668844' };
const base = () => applyCommand(createSite({ name: 'Mirror workflow', width: 80, depth: 80, resolution: 129, preset: 'flat' }), { type: 'add', entity: block });

describe('selection-first mirror workflow', () => {
  it('requires an explicit supported selection without falling back to the first source', () => {
    const project = base();
    expect(mirrorSelection(project, [])).toBeNull();
    expect(mirrorSelection(project, ['terrain'])).toBeNull();
    expect(mirrorSelection(project, ['missing'])).toBeNull();
    expect(mirrorSelection(project, [block.id])).toEqual({ sourceIds: [block.id] });
  });
  it('keeps all selected sources, deduplicates, and rejects a mixed unsupported selection', () => {
    const project = applyCommand(base(), { type: 'add', entity: { ...block, id: 'second', position: [-4, 2, 3] } });
    expect(mirrorSelection(project, ['second', block.id, 'second'])).toEqual({ sourceIds: ['second', block.id] });
    expect(mirrorSelection(project, [block.id, 'terrain'])).toBeNull();
    expect(mirrorSelection({ ...project, entities: project.entities.map(entity => entity.id === block.id ? { ...entity, visible: false } : entity) }, [block.id])).toBeNull();
    expect(mirrorSelection({ ...project, layers: project.layers.map(layer => ({ ...layer, locked: true })) }, [block.id])).toBeNull();
  });
  it('resolves a selected generated repeat to the whole repeat, without accepting mirror copies', () => {
    const repeat = { id: 'row', name: 'Row', sourceId: block.id, path: { kind: 'line' as const, start: [-10, -10] as [number, number], end: [-10, 10] as [number, number] }, mode: 'count' as const, count: 3, spacing: 2, orientation: 'tangent' as const, rotation: 0, clearance: 0 };
    const project = applyCommand(base(), { type: 'repeat', pattern: repeat });
    expect(mirrorSelection(project, ['row:0'])).toEqual({ repeatId: 'row' });
    expect(mirrorSelection(project, ['row:0', 'row:1'])).toEqual({ repeatId: 'row' });
    const rule: MirrorRule = { id: 'mirror', name: 'Mirror', sourceIds: [block.id], start: [0, -10], end: [0, 10] };
    const mirrored = applyCommand(base(), { type: 'mirror', rule });
    expect(mirrorSelection(mirrored, [mirrorMemberId(rule, block.id)])).toBeNull();
  });
  it('snaps drawn points consistently and locks Shift relative to the first point', () => {
    expect(mirrorAxisPoint([2.13, 8.12], undefined, true, false)).toEqual([2.25, 8]);
    expect(mirrorAxisPoint([2.13, 8.12], [1.1, 2.2], true, true)).toEqual([1.1, 8]);
    expect(mirrorAxisPoint([8.13, 2.12], [1.1, 2.2], false, true)).toEqual([8.13, 2.2]);
  });
  it('keeps reference-based copies transient until apply, supports cancel and one-step undo', () => {
    const project = base(), editor = new Editor(project);
    const rule: MirrorRule = { id: 'mirror', name: 'Mirror', sourceIds: [block.id], start: [0, -10], end: [0, 10] };
    editor.select(block.id); editor.begin('Mirror preview'); editor.preview({ type: 'mirror', rule });
    expect(editor.getSnapshot().project).toEqual(project);
    expect(editor.getSnapshot().selectedId).toBe(block.id);
    expect(editor.getSnapshot().preview!.entities).toHaveLength(2);
    expect(editor.getSnapshot().past).toHaveLength(0);
    editor.cancel(); expect(editor.getSnapshot().project).toEqual(project); expect(editor.getSnapshot().preview).toBeNull();
    editor.begin('Mirror preview'); editor.preview({ type: 'mirror', rule }); editor.commit();
    expect(editor.getSnapshot().project.entities).toHaveLength(2);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(project);
  });
});

describe('scene mirror reference lines', () => {
  it('excludes curved walls instead of offering their endpoint chord as a scene line', () => {
    const project = base(), level = createBuilding(project, 0, 0, 12, 8, 'reference').find((entity):entity is Level=>entity.kind==='level')!;
    const curved = createCurvedWall(level.id, 'arc', [[0, 0], [5, 0], [0, 5]], 0.25, 3.2, false, 0, 'curved-reference');
    expect(mirrorReferenceLines({ ...project, entities: [level, curved] })).toEqual([]);
  });
  it('returns real block edges in world coordinates at their visible top elevation', () => {
    const project = { ...base(), entities: [{ ...block, rotation: 90 }] };
    const lines = mirrorReferenceLines(project);
    expect(lines).toHaveLength(4);
    expect(lines[0].start[0]).toBeCloseTo(-10); expect(lines[0].start[1]).toBeCloseTo(4);
    expect(lines[0].end[0]).toBeCloseTo(-10); expect(lines[0].end[1]).toBeCloseTo(2);
    expect(lines[0].height).toBe(5);
    expect(block.position).toEqual([-8, 2, 3]);
  });
  it('transforms wall references through rotated levels and suppresses hidden ancestors', () => {
    const project = base(), created = createBuilding(project, 0, 0, 12, 8, 'reference');
    const original = created.find((entity): entity is Level => entity.kind === 'level')!;
    const level = { ...original, position: [10, 2, 5] as [number, number, number], rotation: 90 };
    const wall: Wall = { ...created.find((entity): entity is Wall => entity.kind === 'wall')!, start: [0, 0], end: [4, 0], elevation: 0.2, height: 3.4 };
    const scene = { ...project, entities: [level, wall] };
    const [line] = mirrorReferenceLines(scene);
    expect(line.start).toEqual([10, 5]); expect(line.end[0]).toBeCloseTo(10); expect(line.end[1]).toBeCloseTo(1); expect(line.height).toBeCloseTo(5.6);
    expect(mirrorReferenceLines({ ...scene, entities: [{ ...level, visible: false }, wall] })).toEqual([]);
  });
});
