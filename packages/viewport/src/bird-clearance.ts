import * as THREE from 'three';
import type { Project } from '@openlandcraft/core';

/** Include imported models and vegetation; exclude birds, gizmos and capture-only overlays. */
export function sceneCeiling(scene: THREE.Scene, project: Project): number {
  let ceiling = project.entities.reduce((top, entity) => Math.max(top, entity.kind === 'ocean' || entity.kind === 'lake' ? entity.level + 1 : 0), 0);
  const box = new THREE.Box3();
  scene.updateMatrixWorld(true);
  const visit = (node: THREE.Object3D) => {
    if (!node.visible || node.userData.birdFlight || node.userData.waterCaptureExclude) return;
    if (node instanceof THREE.InstancedMesh) {
      if (!node.boundingBox) node.computeBoundingBox();
      if (node.boundingBox) box.copy(node.boundingBox).applyMatrix4(node.matrixWorld);
      else box.makeEmpty();
    } else if (node instanceof THREE.Mesh) {
      // Terrain/water use intentionally oversized culling boxes (up to 35 m).
      // Read actual vertices without changing those renderer-owned bounds.
      const positions = node.geometry.getAttribute('position');
      if (positions) box.setFromBufferAttribute(positions as THREE.BufferAttribute).applyMatrix4(node.matrixWorld);
      else box.makeEmpty();
    } else box.makeEmpty();
    if (!box.isEmpty() && Number.isFinite(box.max.y)) ceiling = Math.max(ceiling, box.max.y);
    node.children.forEach(visit);
  };
  visit(scene);
  return ceiling;
}

