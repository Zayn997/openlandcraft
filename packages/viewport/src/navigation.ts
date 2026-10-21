import { MathUtils, Spherical, Vector3 } from 'three';

export const orientationDirections = {
  front: [0, 0, 1], back: [0, 0, -1],
  right: [1, 0, 0], left: [-1, 0, 0],
  top: [0, 1, 0.000001], bottom: [0, -1, 0.000001],
  perspective: [0.73, 0.67, 0.95],
} as const;
export type OrientationView = keyof typeof orientationDirections;
export type CameraView = OrientationView | 'shore' | 'underwater' | 'river-underwater' | 'lake-underwater';

export function orientationPosition(view: OrientationView, target: Vector3, radius: number) {
  return new Vector3(...orientationDirections[view]).normalize().multiplyScalar(radius).add(target);
}

export function orbitPosition(position: Vector3, target: Vector3, dx: number, dy: number) {
  const spherical = new Spherical().setFromVector3(position.clone().sub(target));
  spherical.theta -= dx * 0.012;
  spherical.phi = MathUtils.clamp(spherical.phi - dy * 0.012, 0.000001, Math.PI - 0.000001);
  return new Vector3().setFromSpherical(spherical).add(target);
}
