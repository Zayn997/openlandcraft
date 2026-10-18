import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Editor, createProject, groundHeight, type Block } from '@openlandcraft/core';
import { loadLocal, saveLocal, serializeProject, deserializeProject } from './index';

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('openlandcraft');
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
});

describe('local project persistence', () => {
  it('returns no project in fresh storage and reopens committed edits', async () => {
    expect(await loadLocal()).toBeNull();
    const editor = new Editor(createProject());
    const block = editor.getSnapshot().project.entities[0] as Block;
    editor.execute({ type: 'replace', entity: { ...block, size: [9, 6, 8] } }, 'Resize');
    await saveLocal(editor.getSnapshot().project);
    const saved = await loadLocal();
    expect(saved).toEqual(editor.getSnapshot().project);
    expect((saved!.entities[0] as Block).size).toEqual([9, 6, 8]);
  });
  it('excludes pending previews from local saves and portable files', async () => {
    const editor = new Editor(createProject());
    const initial = editor.getSnapshot().project;
    editor.begin('Preview resize');
    editor.preview({ type: 'replace', entity: { ...initial.entities[0] as Block, size: [9, 20, 8] } });
    await saveLocal(editor.getSnapshot().project);
    expect(await loadLocal()).toEqual(initial);
    expect(deserializeProject(serializeProject(editor.getSnapshot().project))).toEqual(initial);
    editor.cancel();
  });
  it('does not overwrite a saved project when validation fails', async () => {
    const initial = createProject();
    await saveLocal(initial);
    await expect(saveLocal({ ...initial, version: 99 } as unknown as typeof initial)).rejects.toThrow();
    expect(await loadLocal()).toEqual(initial);
  });
  it('reports a corrupt local copy without overwriting it and accepts explicit recovery', async () => {
    const initial = createProject();
    await saveLocal(initial);
    const corrupt = '{broken local copy';
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('openlandcraft', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const stored = async (write = false) => new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('projects', write ? 'readwrite' : 'readonly');
      const store = tx.objectStore('projects');
      const request = write ? store.put(corrupt, 'current-project') : store.get('current-project');
      tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error);
    });
    await stored(true);
    await expect(loadLocal()).rejects.toThrow('not valid JSON');
    expect(await stored()).toBe(corrupt);
    db.close();
    await saveLocal(initial);
    expect(await loadLocal()).toEqual(initial);
  });
  it('restores the persisted result of an undo', async () => {
    const editor = new Editor(createProject());
    const initial = editor.getSnapshot().project;
    editor.execute({ type: 'remove', id: initial.entities[0].id }, 'Delete');
    await saveLocal(editor.getSnapshot().project);
    editor.undo(); await saveLocal(editor.getSnapshot().project);
    expect(await loadLocal()).toEqual(initial);
  });
});

describe('shared terrain query', () => {
  it('supports land and seabed queries with finite bounded heights', () => {
    const site = createProject().site;
    expect(groundHeight(-30, 0, site)).toBeGreaterThan(0);
    expect(groundHeight(30, 0, site)).toBeLessThan(0);
    for (let x = -45; x <= 45; x += 3) for (let z = -36; z <= 36; z += 3) {
      const height = groundHeight(x, z, site);
      expect(Number.isFinite(height)).toBe(true);
      expect(height).toBeGreaterThanOrEqual(-7);
      expect(height).toBeLessThanOrEqual(7);
    }
  });
});
