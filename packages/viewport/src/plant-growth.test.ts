import { expect, it } from 'vitest';
import { plantGrowthScale, PLANT_GROWTH_MS } from './plant-growth';
import { instanceMatrix } from './instancing';
import * as THREE from 'three';

it('grows around the ground origin, reaches exact authored size, and leaves ordinary instances alone', () => {
  expect(plantGrowthScale(undefined, 100)).toBe(1);
  const samples = [0, 100, 200, 300, PLANT_GROWTH_MS].map(elapsed => plantGrowthScale(1000, 1000 + elapsed));
  expect(samples[0]).toBe(0.04);
  expect(samples.at(-1)).toBe(1);
  expect([...samples].sort((a,b) => a-b)).toEqual(samples);
  expect(plantGrowthScale(1000, 9999)).toBe(1);
  for (const factor of samples) {
    const matrix = instanceMatrix([3, 2, -4], 30, [factor, factor, factor], new THREE.Matrix4());
    expect(new THREE.Vector3().applyMatrix4(matrix).toArray()).toEqual([3, 2, -4]);
  }
});
