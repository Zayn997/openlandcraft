/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPlacedInstance, createSite, Editor, encodeGlb, instancePosition, inspectGlb, type Instance } from '@openlandcraft/core';
import { deserializeProject, serializeProject } from '@openlandcraft/project';
import { disposeModel, loadModel } from '../../../packages/viewport/src/models';
import { staticMeshes } from '../../../packages/viewport/src/instancing';
import { PLANTS, PLANT_CREDIT } from './plant-library';

function assetFor(id: string) {
  const bytes = readFileSync(new URL(`../public/models/plants/${id}.glb`, import.meta.url));
  return { id: `kenney-plant-${id}-v1`, name: PLANTS.find(p => p.id === id)!.name, data: encodeGlb(bytes), attribution: PLANT_CREDIT };
}

describe('curated CC0 plants', () => {
  it('ships small, self-contained, single-draw-call GLBs anchored at ground level', async () => {
    let totalBytes = 0;
    for (const plant of PLANTS) {
      const bytes = readFileSync(new URL(`../public${plant.url}`, import.meta.url));
      totalBytes += bytes.length;
      inspectGlb(bytes);
      const model = await loadModel(assetFor(plant.id));
      const bounds = new THREE.Box3().setFromObject(model), meshes = staticMeshes(model);
      expect(bounds.min.y).toBeCloseTo(0, 4);
      expect(bounds.max.y).toBeCloseTo(plant.height, 4);
      expect(meshes).toHaveLength(1);
      expect(meshes![0].userData.plantWind).toBe(true);
      expect(Array.isArray(meshes![0].material)).toBe(false);
      expect(meshes![0].geometry.getAttribute('color')).toBeDefined();
      for (const attribute of ['position', 'normal', 'color']) {
        expect(Array.from(meshes![0].geometry.getAttribute(attribute).array).every(Number.isFinite)).toBe(true);
      }
      expect((meshes![0].geometry.index?.count ?? meshes![0].geometry.getAttribute('position').count) / 3).toBeLessThan(300);
      disposeModel(model);
    }
    expect(totalBytes).toBeLessThan(80_000);
  });

  it('embeds a source once, assigns the active layer, and round-trips placed plants with undo/redo', () => {
    const project = createSite({ name: 'Plant study', width: 40, depth: 40, resolution: 129, preset: 'flat' });
    const editor = new Editor(project), asset = assetFor('pine');
    editor.execute({ type: 'layer', layer: { id: 'plants', name: 'Plants', color: '#778866', parentId: null, locked: false, visible: true } }, 'Plants layer');
    editor.execute({ type: 'activeLayer', id: 'plants' }, 'Active layer');
    const before = editor.getSnapshot().past.length;
    const first = createPlacedInstance(editor.getSnapshot().project, asset, 1.24, 2.38, true, 'pine-1');
    editor.execute({ type: 'insert', entities: [first], assets: [asset] }, 'Plant pine');
    expect(editor.getSnapshot().past).toHaveLength(before + 1);
    const second = createPlacedInstance(editor.getSnapshot().project, asset, 3.12, -2.2, false, 'pine-2');
    editor.execute({ type: 'insert', entities: [second] }, 'Plant another pine');
    expect(editor.getSnapshot().project.assets).toHaveLength(1);
    expect(editor.getSnapshot().project.objectLayers['pine-1']).toBe('plants');
    expect(first.position).toEqual([1, 0, 2.5]);
    expect(instancePosition(first, project)).toEqual([1, 2, 2.5]);
    const saved = deserializeProject(serializeProject(editor.getSnapshot().project));
    expect(saved.assets[0].attribution).toContain('CC0');
    expect((saved.entities.find(e => e.id === 'pine-2') as Instance).scale).toEqual([1, 1, 1]);
    editor.undo(); expect(editor.getSnapshot().project.entities).toHaveLength(1);
    editor.redo(); expect(editor.getSnapshot().project.entities).toHaveLength(2);
    editor.undo(); editor.undo(); expect(editor.getSnapshot().project.assets).toHaveLength(0);
  });

  it('rejects invalid placement and respects locked layers and isolation', () => {
    const project = createSite({ name: 'Plant study', width: 40, depth: 40, resolution: 129, preset: 'flat' });
    const asset = assetFor('shrub'), editor = new Editor(project);
    expect(() => createPlacedInstance(project, asset, NaN, 0, false)).toThrow('inside the site');
    expect(() => createPlacedInstance(project, asset, 21, 0, false)).toThrow('inside the site');
    editor.execute({ type: 'layer', layer: { ...project.layers[0], locked: true } }, 'Lock layer');
    const entity = createPlacedInstance(project, asset, 0, 0, false);
    expect(() => editor.execute({ type: 'insert', entities: [entity], assets: [asset] }, 'Plant')).toThrow(/active layer/);
    expect(editor.getSnapshot().project.assets).toHaveLength(0);
    const isolated = new Editor(project);
    isolated.execute({ type: 'layer', layer: { id: 'isolated', name: 'Isolated', color: '#778866', parentId: null, locked: false, visible: true } }, 'Layer');
    isolated.isolateLayer('isolated');
    expect(() => isolated.execute({ type: 'insert', entities: [entity], assets: [asset] }, 'Plant')).toThrow(/isolation/);
    expect(isolated.getSnapshot().project.assets).toHaveLength(0);
  });
});
