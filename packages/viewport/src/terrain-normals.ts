import * as THREE from 'three';

/** Recompute the exact area-weighted normals of vertices neighboring edited samples. */
export function updateTerrainNormals(geometry: THREE.BufferGeometry, changed: number[], columns: number, rows: number): void {
  const affected = new Set<number>();
  for (const index of changed) {
    const row = Math.floor(index / columns), column = index % columns;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (row + dz >= 0 && row + dz < rows && column + dx >= 0 && column + dx < columns) affected.add((row + dz) * columns + column + dx);
  }
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3(), sum = new THREE.Vector3();
  for (const index of affected) {
    const row = Math.floor(index / columns), column = index % columns; sum.set(0, 0, 0);
    const face = (i: number, j: number, k: number) => {
      if (index !== i && index !== j && index !== k) return;
      a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, j); c.fromBufferAttribute(positions, k);
      normal.crossVectors(b.sub(a), c.sub(a)); sum.add(normal);
    };
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 2, row); r++) for (let col = Math.max(0, column - 1); col <= Math.min(columns - 2, column); col++) {
      const topLeft = r * columns + col, bottomLeft = topLeft + columns;
      face(topLeft, bottomLeft, topLeft + 1); face(bottomLeft, bottomLeft + 1, topLeft + 1);
    }
    sum.normalize(); normals.setXYZ(index, sum.x, sum.y, sum.z);
  }
  normals.needsUpdate = true;
}
