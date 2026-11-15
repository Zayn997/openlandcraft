import { DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Borrow geometry, but own the preview material: originals never become translucent. */
export function mirrorPreviewModel(source: Group) {
  const object = clone(source) as Group;
  const material = new MeshBasicMaterial({ color: '#76d6e5', transparent: true, opacity: 0.38, depthWrite: false, side: DoubleSide });
  object.traverse(child => {
    if (child instanceof Mesh) {
      child.material = material;
      child.castShadow = false;
      child.receiveShadow = false;
      child.userData.mirrorPreview = true;
      delete child.userData.plantWind;
    }
  });
  object.updateMatrixWorld(true);
  return { object, dispose: () => material.dispose() };
}
