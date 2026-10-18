import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { decodeGlb, inspectGlb, type Asset } from '@openlandcraft/core';
const owners = new WeakMap<THREE.Object3D, THREE.Object3D[]>();

export function disposeModel(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const collect = (object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material: THREE.Material) => materials.add(material));
  };
  (owners.get(root) ?? [root]).forEach((scene) => scene.traverse(collect)); owners.delete(root);
  materials.forEach((material) => Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); }));
  geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
  textures.forEach((texture) => { texture.dispose(); const source = texture.source.data; if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close(); });
}
export async function loadModel(asset: Asset): Promise<THREE.Group> {
  const bytes = decodeGlb(asset.data); inspectGlb(bytes);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer, '');
  const root = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || ![...size].every(Number.isFinite) || Math.max(...size) > 200 || Math.max(...size) < 0.01) {
    gltf.scenes.forEach(disposeModel); throw new Error('Use a model with visible geometry between 0.01 and 200 m across.');
  }
  root.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
  // Preserve the source file and its transforms; placement origin is bottom-center.
  const normalized = new THREE.Group(); normalized.add(root);
  root.position.x -= (bounds.min.x + bounds.max.x) / 2;
  root.position.y -= bounds.min.y;
  root.position.z -= (bounds.min.z + bounds.max.z) / 2;
  owners.set(normalized, gltf.scenes);
  return normalized;
}
export async function validateModels(assets: Asset[]): Promise<void> {
  for (const asset of assets) { const model = await loadModel(asset); disposeModel(model); }
}
