import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { decodeGlb, inspectGlb, isBirdAsset, isFishAsset, isGroundCharacterAsset, groundCharacterKind, type Asset } from '@openlandcraft/core';
import { isLibraryVegetation } from './plant-wind';
import { combineCharacterSkin } from './character-skin';
import {horseWalkClip} from './horse-walk';
const owners = new WeakMap<THREE.Object3D, THREE.Object3D[]>();
type ModelLoadSample={assetId:string;durationMs:number;bytes:number};
const loadObservers=new Set<(sample:ModelLoadSample)=>void>();
/** Bounded opt-in profiling; never retains loaded scenes or asset bytes. */
export function observeModelLoads(observer:(sample:ModelLoadSample)=>void){loadObservers.add(observer);return()=>{loadObservers.delete(observer);};}

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
  const start=loadObservers.size?performance.now():0;
  const bytes = decodeGlb(asset.data); inspectGlb(bytes);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer, '');
  const root = gltf.scene;
  if(isGroundCharacterAsset(asset))combineCharacterSkin(root);
  const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || ![...size].every(Number.isFinite) || Math.max(...size) > 200 || Math.max(...size) < 0.01) {
    gltf.scenes.forEach(disposeModel); throw new Error('Use a model with visible geometry between 0.01 and 200 m across.');
  }
  root.traverse((object) => { if (object instanceof THREE.Mesh) {
    object.castShadow = true; object.receiveShadow = true;
    object.userData.plantWind = isLibraryVegetation(asset) && ['Pine', 'Oak', 'Palm', 'Shrub', 'Grass_tuft', 'Yellow_flowers'].includes(object.name);
  } });
  // Preserve the source file and its transforms; placement origin is bottom-center.
  const normalized = new THREE.Group(); normalized.add(root);
  normalized.animations = groundCharacterKind(asset)==='horse' ? gltf.animations.map(horseWalkClip) : gltf.animations;
  normalized.userData.birdFlight = isBirdAsset(asset) && gltf.animations.some(clip => clip.name === 'Flight');
  normalized.userData.fishSwim = isFishAsset(asset) && gltf.animations.some(clip => clip.name === 'Swim');
  normalized.userData.groundCharacter = isGroundCharacterAsset(asset) && ['Walk','Idle'].every(name => gltf.animations.some(clip => clip.name === name));
  root.position.x -= (bounds.min.x + bounds.max.x) / 2;
  root.position.y -= bounds.min.y;
  root.position.z -= (bounds.min.z + bounds.max.z) / 2;
  owners.set(normalized, gltf.scenes);
  if(loadObservers.size){const sample={assetId:asset.id,durationMs:performance.now()-start,bytes:bytes.byteLength};loadObservers.forEach(observer=>observer(sample));}
  return normalized;
}
export async function validateModels(assets: Asset[]): Promise<void> {
  for (const asset of assets) { const model = await loadModel(asset); disposeModel(model); }
}
