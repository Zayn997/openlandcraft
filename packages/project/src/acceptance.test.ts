import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import tree from '../../../examples/demo-tree.asset.json';
import { Editor, createBuilding, createRiver, createSite, evaluateProject, scatterInstances, type Instance, type River } from '@openlandcraft/core';
import { DEFAULT_BRUSH, TerrainStroke } from '@openlandcraft/landscape';
import { deserializeProject, loadLocal, saveLocal, serializeProject } from './index';

it('completes a new-site terrain/river/GLB/building workflow and reopens it in fresh storage', async () => {
  const editor = new Editor(createSite({ name: 'Acceptance site', width: 90, depth: 72, resolution: 129, preset: 'coast' })), initial = editor.getSnapshot().project;
  for (const kind of ['raise', 'lower', 'flatten', 'smooth'] as const) {
    const before = editor.getSnapshot().project, stroke = new TerrainStroke(before.site.terrain, before.site, { ...DEFAULT_BRUSH, kind, radius: 6, target: 4 }); stroke.move(-25, 10);
    editor.begin(kind); editor.preview({ type: 'terrain', field: stroke.snapshot() }); editor.commit();
    expect(editor.getSnapshot().project.site.terrain.heights).not.toEqual(before.site.terrain.heights);
    editor.undo(); expect(editor.getSnapshot().project).toEqual(before); editor.redo();
  }
  const river = createRiver(editor.getSnapshot().project); editor.execute({ type: 'add', entity: river }, 'Draw river');
  const moved: River = { ...river, points: river.points.map((point, index) => index === 2 ? [point[0] + 0.5, point[1], point[2]] : point), width: 4.5, depth: 2, speed: 1.2 };
  editor.begin('Handle'); editor.preview({ type: 'replace', entity: moved }); editor.commit();
  const source: Instance = { id: 'tree-main', kind: 'instance', parentId: 'site', name: 'Tree', visible: true, assetId: tree.id, anchor: 'terrain', position: [-32, 0.2, 10], rotation: 45, scale: [1.2, 1.5, 1.2] };
  editor.execute({ type: 'insert', assets: [tree], entities: [source, ...scatterInstances(source, 8, 5, 42)] }, 'Import and place trees');
  editor.execute({ type: 'insert', entities: createBuilding(editor.getSnapshot().project, -25, 14) }, 'Build');
  const authored = editor.getSnapshot().project, rendered = evaluateProject(authored), undoCount = editor.getSnapshot().past.length;
  editor.begin('Cancelled edit'); editor.preview({ type: 'replace', entity: { ...moved, width: 5 } }); editor.cancel(); expect(editor.getSnapshot().project).toBe(authored); expect(editor.getSnapshot().past).toHaveLength(undoCount);
  editor.execute({ type: 'remove', id: river.id }, 'Remove river'); expect(evaluateProject(editor.getSnapshot().project).site.terrain).toEqual(authored.site.terrain); editor.undo();
  for (let i = 0; i < undoCount; i++) editor.undo(); expect(editor.getSnapshot().project).toEqual(initial);
  for (let i = 0; i < undoCount; i++) editor.redo(); expect(editor.getSnapshot().project).toEqual(authored);
  const reopened = deserializeProject(serializeProject(authored)); expect(reopened).toEqual(authored); expect(reopened.assets[0].data).toBe(tree.data); expect(evaluateProject(reopened).site.terrain).toEqual(rendered.site.terrain);
  await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('openlandcraft'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  expect(await loadLocal()).toBeNull(); await saveLocal(reopened); expect(await loadLocal()).toEqual(authored);
});
