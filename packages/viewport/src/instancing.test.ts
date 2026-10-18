import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import tree from '../../../examples/demo-tree.asset.json';
import { disposeModel, loadModel } from './models';
import { instanceMatrix, staticMeshes } from './instancing';

describe('static model batching', () => {
  it('preserves normalized source transforms, individual placement and picking indices', async () => {
    const source = await loadModel(tree), meshes = staticMeshes(source)!; expect(meshes).toHaveLength(2);
    const batch = new THREE.InstancedMesh(meshes[0].geometry, meshes[0].material, 2);
    batch.setMatrixAt(0, instanceMatrix([0, 2, 0], 45, [2, 1.5, 1], meshes[0].matrixWorld));
    batch.setMatrixAt(1, instanceMatrix([10, 0, 0], 0, [1, 1, 1], meshes[0].matrixWorld)); batch.updateMatrixWorld(true); batch.computeBoundingSphere();
    const expected = new THREE.Vector3(0, 0, 0).applyMatrix4(meshes[0].matrixWorld).multiply(new THREE.Vector3(2, 1.5, 1)).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4).add(new THREE.Vector3(0, 2, 0));
    const matrix = new THREE.Matrix4(); batch.getMatrixAt(0, matrix); expect(new THREE.Vector3().applyMatrix4(matrix).distanceTo(expected)).toBeLessThan(0.00001);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(10, 1, 10), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(batch)[0]?.instanceId).toBe(1);
    batch.dispose(); disposeModel(source);
  });
  it('keeps skinned, morphing, mirrored and transparent models on the clone path', () => {
    const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(geometry, material); root.add(mesh);
    expect(staticMeshes(root)).toHaveLength(1); material.transparent = true; expect(staticMeshes(root)).toBeNull(); material.transparent = false;
    mesh.scale.x = -1; expect(staticMeshes(root)).toBeNull(); mesh.scale.x = 1;
    geometry.morphAttributes.position = [geometry.attributes.position.clone()]; expect(staticMeshes(root)).toBeNull(); delete geometry.morphAttributes.position;
    root.add(new THREE.SkinnedMesh(geometry, material)); expect(staticMeshes(root)).toBeNull(); geometry.dispose(); material.dispose();
  });
});
