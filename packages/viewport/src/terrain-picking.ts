import * as THREE from 'three';
import type { Heightfield } from '@openlandcraft/landscape';

/** Walk crossed grid cells, testing the same two triangles used by PlaneGeometry. */
export function intersectTerrain(ray: THREE.Ray, site: { width: number; depth: number; terrain: Heightfield }): { point: THREE.Vector3; distance: number } | null {
  const { width, depth, terrain } = site, columns = terrain.columns - 1, rows = terrain.rows - 1;
  let enter = 0, exit = Infinity;
  for (const [origin, direction, half] of [[ray.origin.x, ray.direction.x, width / 2], [ray.origin.z, ray.direction.z, depth / 2]]) {
    if (Math.abs(direction) < 1e-12) { if (Math.abs(origin) > half) return null; }
    else { const a = (-half - origin) / direction, b = (half - origin) / direction; enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b)); }
  }
  if (enter > exit) return null;
  const dx = width / columns, dz = depth / rows, point = ray.at(enter, new THREE.Vector3());
  let column = Math.min(columns - 1, Math.max(0, Math.floor((point.x + width / 2) / dx))), row = Math.min(rows - 1, Math.max(0, Math.floor((point.z + depth / 2) / dz)));
  const stepX = Math.sign(ray.direction.x), stepZ = Math.sign(ray.direction.z);
  let nextX = stepX ? ((column + (stepX > 0 ? 1 : 0)) * dx - width / 2 - ray.origin.x) / ray.direction.x : Infinity;
  let nextZ = stepZ ? ((row + (stepZ > 0 ? 1 : 0)) * dz - depth / 2 - ray.origin.z) / ray.direction.z : Infinity;
  const deltaX = stepX ? Math.abs(dx / ray.direction.x) : Infinity, deltaZ = stepZ ? Math.abs(dz / ray.direction.z) : Infinity;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3(), hit = new THREE.Vector3();
  for (let cell = 0; cell < columns + rows + 4 && column >= 0 && column < columns && row >= 0 && row < rows; cell++) {
    const x = column * dx - width / 2, z = row * dz - depth / 2, index = row * terrain.columns + column;
    a.set(x, terrain.heights[index], z); b.set(x, terrain.heights[index + terrain.columns], z + dz);
    c.set(x + dx, terrain.heights[index + 1], z); d.set(x + dx, terrain.heights[index + terrain.columns + 1], z + dz);
    let nearest: THREE.Vector3 | null = null;
    if (ray.intersectTriangle(a, b, c, false, hit)) nearest = hit.clone();
    if (ray.intersectTriangle(b, d, c, false, hit) && (!nearest || hit.distanceToSquared(ray.origin) < nearest.distanceToSquared(ray.origin))) nearest = hit.clone();
    if (nearest) return { point: nearest, distance: nearest.distanceTo(ray.origin) };
    if (Math.min(nextX, nextZ) > exit || (!stepX && !stepZ)) break;
    if (Math.abs(nextX - nextZ) < 1e-9) { column += stepX; row += stepZ; nextX += deltaX; nextZ += deltaZ; }
    else if (nextX < nextZ) { column += stepX; nextX += deltaX; } else { row += stepZ; nextZ += deltaZ; }
  }
  return null;
}
