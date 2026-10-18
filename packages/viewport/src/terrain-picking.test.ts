import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHeightfield } from '@openlandcraft/landscape';
import { intersectTerrain } from './terrain-picking';

describe('heightfield grid picking', () => {
  it('matches triangle raycasting for oblique, vertical, boundary and missing rays', () => {
    const site = { width: 90, depth: 72, terrain: createHeightfield({ width: 90, depth: 72 }, (x, z) => Math.sin(x * 0.18) * 3 + Math.cos(z * 0.2), 65, 53) };
    const geometry = new THREE.PlaneGeometry(site.width, site.depth, 64, 52); geometry.rotateX(-Math.PI / 2);
    site.terrain.heights.forEach((height, index) => geometry.attributes.position.setY(index, height));
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld(true);
    const compare = (origin: THREE.Vector3, direction: THREE.Vector3) => {
      direction.normalize(); const raycaster = new THREE.Raycaster(origin, direction), expected = raycaster.intersectObject(mesh)[0], actual = intersectTerrain(raycaster.ray, site);
      expect(Boolean(actual)).toBe(Boolean(expected));
      if (actual && expected) { expect(actual.point.distanceTo(expected.point)).toBeLessThan(0.0001); expect(actual.distance).toBeCloseTo(expected.distance, 4); }
    };
    for (let index = 0; index < 80; index++) {
      const origin = new THREE.Vector3(Math.sin(index * 2.3) * 100, 10 + index % 30, Math.cos(index * 1.9) * 90);
      compare(origin, new THREE.Vector3(Math.sin(index) * 45, 0, Math.cos(index * 1.7) * 36).sub(origin));
    }
    for (const [x, z] of [[0, 0], [-45, -36], [45, 36], [45, -36], [-45, 36], [46, 0]]) compare(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
    compare(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, 1, 0));
    compare(new THREE.Vector3(-100, 0, 0), new THREE.Vector3(1, 0, 0));
    geometry.dispose(); material.dispose();
  });
});
