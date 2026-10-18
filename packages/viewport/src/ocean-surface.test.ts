import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createOceanGround, oceanSegments } from './ocean-surface';
import { createProject, createRiver, evaluateProject } from '@openlandcraft/core';

it('uploads the evaluated terrain in row-major float samples without filtering across banks', () => {
  const authored = createProject(); authored.entities.push(createRiver(authored));
  const field = evaluateProject(authored).site.terrain, texture = createOceanGround(field);
  expect(field.heights).not.toEqual(authored.site.terrain.heights);
  expect(texture.image.width).toBe(field.columns); expect(texture.image.height).toBe(field.rows);
  expect(Array.from(texture.image.data as Float32Array)).toEqual(Array.from(new Float32Array(field.heights)));
  expect(texture.minFilter).toBe(THREE.NearestFilter); expect(texture.magFilter).toBe(THREE.NearestFilter);
  expect(texture.flipY).toBe(false); expect(texture.generateMipmaps).toBe(false);
  texture.dispose(); expect(authored.site.terrain.heights).not.toEqual(field.heights);
});

it('keeps rectangular wave tessellation bounded and reduces work in low quality', () => {
  for (const width of [20, 90, 200]) for (const depth of [20, 72, 200]) for (const wavelength of [4, 10, 40]) {
    const high = oceanSegments(width, depth, wavelength, 'high'), low = oceanSegments(width, depth, wavelength, 'low');
    for (let axis = 0; axis < 2; axis++) { expect(high[axis]).toBeGreaterThanOrEqual(16); expect(high[axis]).toBeLessThanOrEqual(384); expect(low[axis]).toBeLessThanOrEqual(128); expect(low[axis]).toBeLessThanOrEqual(high[axis]); }
  }
  expect(oceanSegments(200, 20, 4, 'high')[0]).toBeGreaterThan(oceanSegments(200, 20, 4, 'high')[1]);
});
