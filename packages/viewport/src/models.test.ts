import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import tree from '../../../examples/demo-tree.asset.json';
import { disposeModel, loadModel } from './models';

describe('GLB resource ownership', () => {
  it('decodes the representative GLB, anchors its bounds and shares resources across instances', async () => {
    const source = await loadModel(tree), a = clone(source), b = clone(source);
    const bounds = new THREE.Box3().setFromObject(source);
    expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(6.2); expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(0);
    const meshes = (root: THREE.Object3D) => { const found: THREE.Mesh[] = []; root.traverse((object) => { if (object instanceof THREE.Mesh) found.push(object); }); return found; };
    const original = meshes(source), first = meshes(a), second = meshes(b);
    expect(original).toHaveLength(2); expect(first[0]).not.toBe(second[0]);
    expect(first[0].geometry).toBe(second[0].geometry); expect(first[0].material).toBe(original[0].material);
    let geometryDisposals = 0, materialDisposals = 0;
    original.forEach((mesh) => { mesh.geometry.addEventListener('dispose', () => geometryDisposals++); (mesh.material as THREE.Material).addEventListener('dispose', () => materialDisposals++); });
    disposeModel(source); expect(geometryDisposals).toBe(2); expect(materialDisposals).toBe(2);
  });
});
