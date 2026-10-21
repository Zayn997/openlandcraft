import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { orbitPosition, orientationDirections, orientationPosition, type OrientationView } from './navigation';

describe('View navigator camera poses', () => {
  it('snaps to every face around the current panned target without changing zoom', () => {
    const target = new Vector3(24, 9, -31);
    for (const view of Object.keys(orientationDirections) as OrientationView[]) {
      const position = orientationPosition(view, target, 42);
      expect(position.distanceTo(target)).toBeCloseTo(42, 10);
      expect(position.clone().sub(target).normalize().distanceTo(new Vector3(...orientationDirections[view]).normalize())).toBeLessThan(1e-10);
    }
    expect(target.toArray()).toEqual([24, 9, -31]);
  });
  it('orbits continuously through the back and clamps at poles without flipping', () => {
    const target = new Vector3(20, 3, -10), start = target.clone().add(new Vector3(0, 0, 50));
    const back = orbitPosition(start, target, Math.PI / 0.012, 0);
    expect(back.distanceTo(target.clone().add(new Vector3(0, 0, -50)))).toBeLessThan(1e-8);
    for (const dy of [-10000, 10000]) {
      const pole = orbitPosition(back, target, 10000, dy);
      expect(pole.distanceTo(target)).toBeCloseTo(50, 10);
      expect(pole.toArray().every(Number.isFinite)).toBe(true);
      expect(Math.sign(pole.y - target.y)).toBe(Math.sign(dy));
    }
    expect(orbitPosition(start, target, 0, 0).distanceTo(start)).toBeLessThan(1e-10);
  });
});
