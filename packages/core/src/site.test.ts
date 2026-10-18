import { describe, expect, it } from 'vitest';
import example from '../../../examples/coastal-river.olc.json';
import { Editor, createRiver, createSite, parseProject } from './index';

describe('new site and recovery transactions', () => {
  it('creates account-free coast/flat sites with explicit dimensions and resolution', () => {
    const flat = createSite({ name: 'Courtyard', width: 40, depth: 30, resolution: 129, preset: 'flat' });
    expect(flat.name).toBe('Courtyard'); expect(flat.entities).toEqual([]); expect(new Set(flat.site.terrain.heights)).toEqual(new Set([2]));
    const coast = createSite({ name: 'Large coast', width: 200, depth: 200, resolution: 257, preset: 'coast' });
    expect(coast.site.terrain.heights).toHaveLength(257 * 257); expect(coast.entities[0].kind).toBe('ocean');
    expect(() => createSite({ name: 'Invalid', width: 201, depth: 20, resolution: 129, preset: 'flat' })).toThrow();
  });
  it('undoes complete project replacement including terrain, river and embedded assets', () => {
    const editor = new Editor(parseProject(example)), before = editor.getSnapshot().project;
    editor.replaceProject(createSite({ name: 'New site', width: 200, depth: 160, resolution: 257, preset: 'flat' }), 'New');
    expect(editor.getSnapshot().project.assets).toEqual([]); expect(editor.getSnapshot().past).toHaveLength(1);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before); editor.redo(); expect(editor.getSnapshot().project.name).toBe('New site');
  });
  it('treats resolution-only replacement as a document transaction and preserves drafts on invalid replacement', () => {
    const options = { name: 'Flat', width: 40, depth: 40, preset: 'flat' as const }, editor = new Editor(createSite({ ...options, resolution: 129 }));
    editor.replaceProject(createSite({ ...options, resolution: 257 }), 'Resolution'); expect(editor.getSnapshot().past[0].type).toBe('document');
    editor.undo(); expect(editor.getSnapshot().project.site.terrain.columns).toBe(129);
    editor.begin('Pending'); const snapshot = editor.getSnapshot(); expect(() => editor.replaceProject({ broken: true }, 'Bad')).toThrow(); expect(editor.getSnapshot()).toBe(snapshot);
  });
  it('supplies valid starter rivers for small, large and narrow supported sites', () => {
    for (const [width, depth] of [[20, 20], [40, 30], [60, 60], [20, 200], [200, 20], [200, 200]]) {
      const editor = new Editor(createSite({ name: 'Sized site', width, depth, resolution: 129, preset: 'coast' }));
      expect(() => editor.execute({ type: 'add', entity: createRiver(editor.getSnapshot().project) }, 'Starter')).not.toThrow();
    }
  });
});
