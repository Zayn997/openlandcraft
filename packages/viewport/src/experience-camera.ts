import { Vector3, type Camera as ThreeCamera } from 'three';
import type { Camera } from '@react-three/fiber';

export type ExperienceCameraSnapshot = { camera: Camera; backup: Camera; target: Vector3 };
export function captureExperienceCamera(camera: Camera, target: Vector3): ExperienceCameraSnapshot {
  return { camera, backup: camera.clone(), target: target.clone() };
}
export function restoreExperienceCamera(snapshot: ExperienceCameraSnapshot, target: Vector3) {
  const camera: ThreeCamera = snapshot.camera;
  camera.copy(snapshot.backup, false);
  snapshot.camera.updateMatrixWorld(true);
  target.copy(snapshot.target);
}
