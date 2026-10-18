import { expect, it } from 'vitest';
import * as THREE from 'three';
import { updateTerrainNormals } from './terrain-normals';

it('matches a full indexed-normal rebuild after localized interior and edge edits', () => {
  const geometry = new THREE.PlaneGeometry(40, 30, 32, 24); geometry.rotateX(-Math.PI / 2);
  for (let i = 0; i < geometry.attributes.position.count; i++) geometry.attributes.position.setY(i, Math.sin(i * 0.07));
  geometry.computeVertexNormals();
  const changed = [0, 1, 32, 33, 420, 421, 422, 823, 824];
  changed.forEach((index) => geometry.attributes.position.setY(index, geometry.attributes.position.getY(index) + 2));
  const expected = geometry.clone(); expected.computeVertexNormals(); updateTerrainNormals(geometry, changed, 33, 25);
  for (let i = 0; i < geometry.attributes.normal.count; i++) {
    expect(geometry.attributes.normal.getX(i)).toBeCloseTo(expected.attributes.normal.getX(i), 5);
    expect(geometry.attributes.normal.getY(i)).toBeCloseTo(expected.attributes.normal.getY(i), 5);
    expect(geometry.attributes.normal.getZ(i)).toBeCloseTo(expected.attributes.normal.getZ(i), 5);
  }
  geometry.dispose(); expected.dispose();
});
