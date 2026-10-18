import { describe, expect, it } from 'vitest';
import { Editor, createProject, type Block } from './index';
import { deserializeProject, serializeProject } from '../../project/src/index';

const block = (editor: Editor) => editor.getSnapshot().project.entities[0] as Block;

describe('authored edit transactions', () => {
  it('previews many changes without mutating saved state, then commits one history step', () => {
    const editor = new Editor(createProject());
    const initial = serializeProject(editor.getSnapshot().project);
    editor.begin('Resize pavilion');
    for (let height = 5; height < 15; height++) {
      const entity = block(editor);
      editor.preview({ type: 'replace', entity: { ...entity, size: [10, height, 7] } });
    }
    expect(serializeProject(editor.getSnapshot().project)).toBe(initial);
    expect(editor.getSnapshot().past).toHaveLength(0);
    editor.commit();
    expect(block(editor).size[1]).toBe(14);
    expect(editor.getSnapshot().past).toHaveLength(1);
    editor.undo();
    expect(serializeProject(editor.getSnapshot().project)).toBe(initial);
    editor.redo();
    expect(block(editor).size[1]).toBe(14);
  });
  it('cancels previews and ignores no-op commits', () => {
    const editor = new Editor(createProject());
    editor.begin('Move');
    editor.preview({ type: 'replace', entity: { ...block(editor), position: [1, 2, 3] } });
    editor.cancel();
    expect(block(editor).position).not.toEqual([1, 2, 3]);
    editor.begin('No change'); editor.commit();
    expect(editor.getSnapshot().past).toHaveLength(0);
    expect(editor.getSnapshot().revision).toBe(0);
  });
  it('rejects invalid commands atomically and protects immutable snapshots', () => {
    const editor = new Editor(createProject());
    const before = editor.getSnapshot();
    expect(() => editor.execute({ type: 'replace', entity: { ...block(editor), size: [-1, 4, 7] } }, 'Invalid')).toThrow();
    expect(() => editor.execute({ type: 'add', entity: block(editor) }, 'Duplicate ID')).toThrow();
    expect(editor.getSnapshot()).toBe(before);
    expect(() => { block(editor).position[0] = 123; }).toThrow();
  });
  it('invalidates redo after a new edit and restores deleted entities', () => {
    const editor = new Editor(createProject());
    editor.execute({ type: 'remove', id: block(editor).id }, 'Delete');
    expect(editor.getSnapshot().selectedId).toBeNull();
    editor.undo();
    expect(editor.getSnapshot().project.entities).toHaveLength(4);
    editor.execute({ type: 'rename', name: 'New branch' }, 'Rename');
    editor.redo();
    expect(editor.getSnapshot().project.name).toBe('New branch');
    expect(editor.getSnapshot().future).toHaveLength(0);
  });
  it('does not replace a scene or its draft on invalid import', () => {
    const editor = new Editor(createProject());
    editor.begin('Move');
    const before = editor.getSnapshot();
    expect(() => editor.load({ ...createProject(), version: 99 })).toThrow();
    expect(editor.getSnapshot()).toBe(before);
  });
});

describe('portable M0 project format', () => {
  it('round trips edited parameters without session or render state', () => {
    const editor = new Editor(createProject());
    editor.execute({ type: 'replace', entity: { ...block(editor), position: [-5, 3, 8], rotation: 35 } }, 'Move');
    const text = serializeProject(editor.getSnapshot().project);
    const reopened = new Editor(deserializeProject(text));
    expect(reopened.getSnapshot().project).toEqual(editor.getSnapshot().project);
    expect(reopened.getSnapshot().past).toHaveLength(0);
    expect(text).not.toContain('selectedId');
  });
  it('rejects unknown versions, entity kinds, corrupt JSON, and non-finite parameters', () => {
    const project = createProject();
    expect(() => deserializeProject('{bad')).toThrow('valid JSON');
    expect(() => deserializeProject(JSON.stringify({ ...project, version: 99 }))).toThrow();
    expect(() => deserializeProject(JSON.stringify({ ...project, entities: [{ ...project.entities[0], kind: 'unsupported' }] }))).toThrow();
    expect(() => deserializeProject(JSON.stringify({ ...project, entities: [{ ...project.entities[0], position: [Infinity, 0, 0] }] }))).toThrow();
  });
});
