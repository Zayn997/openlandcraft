import * as THREE from 'three';

/** Batch only opaque, static meshes whose source transforms Three.js can instance. */
export function staticMeshes(root: THREE.Object3D): THREE.Mesh[] | null {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  let supported = true;
  root.traverseVisible((object) => {
    if (object instanceof THREE.Light || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite) supported = false;
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (object instanceof THREE.SkinnedMesh || object.matrixWorld.determinant() <= 0 || Object.values(object.geometry.morphAttributes as Record<string, unknown[]>).some((attributes) => attributes.length) || materials.some((material) => material.transparent || material.blending !== THREE.NormalBlending)) supported = false;
    meshes.push(object);
  });
  return supported && meshes.length ? meshes : null;
}

export function instanceMatrix(position: [number, number, number], rotation: number, scale: [number, number, number], source: THREE.Matrix4): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation * Math.PI / 180), new THREE.Vector3(...scale)).multiply(source);
}
