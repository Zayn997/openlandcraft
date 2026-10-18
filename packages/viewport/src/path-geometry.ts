import * as THREE from 'three';
import { clipPathPolygon, pathStrips, polygonArea, type PathPoint } from '@openlandcraft/landscape';
import type { Path, Project } from '@openlandcraft/core';

export const PATH_LIFT = 0.035;
export type PathMesh = { geometry: THREE.BufferGeometry; samples: { indices: [number, number, number]; weights: [number, number, number] }[] };

/** Clip the route to terrain triangles once; height edits only update vertex Y. */
export function buildPathMesh(path: Path, site: Project['site']): PathMesh {
  const positions: number[] = [], uvs: number[] = [], samples: PathMesh['samples'] = [];
  const { columns, rows } = site.terrain, dx = site.width / (columns - 1), dz = site.depth / (rows - 1);
  let along = 0;
  pathStrips(path).forEach((strip, segment) => {
    const a = path.points[segment], b = path.points[segment + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
    const minX = Math.max(0, Math.floor((Math.min(...strip.map(p => p[0])) + site.width / 2) / dx));
    const maxX = Math.min(columns - 2, Math.floor((Math.max(...strip.map(p => p[0])) + site.width / 2) / dx));
    const minZ = Math.max(0, Math.floor((Math.min(...strip.map(p => p[1])) + site.depth / 2) / dz));
    const maxZ = Math.min(rows - 2, Math.floor((Math.max(...strip.map(p => p[1])) + site.depth / 2) / dz));
    for (let row = minZ; row <= maxZ; row++) for (let col = minX; col <= maxX; col++) {
      const x = col * dx - site.width / 2, z = row * dz - site.depth / 2, index = row * columns + col;
      const corners: PathPoint[] = [[x, z], [x + dx, z], [x, z + dz], [x + dx, z + dz]];
      const grid = [index, index + 1, index + columns, index + columns + 1];
      for (const ids of [[0, 1, 2], [1, 3, 2]]) {
        const triangle = ids.map(i => corners[i]), clipped = clipPathPolygon(strip, triangle);
        if (polygonArea(clipped) < 1e-10) continue;
        for (let j = 1; j < clipped.length - 1; j++) {
          // Reverse X/Z winding to face +Y.
          for (const p of [clipped[0], clipped[j + 1], clipped[j]]) {
            const [p0, p1, p2] = triangle, denominator = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
            const w0 = ((p1[1] - p2[1]) * (p[0] - p2[0]) + (p2[0] - p1[0]) * (p[1] - p2[1])) / denominator;
            const w1 = ((p2[1] - p0[1]) * (p[0] - p2[0]) + (p0[0] - p2[0]) * (p[1] - p2[1])) / denominator;
            positions.push(p[0], 0, p[1]);
            uvs.push(-(p[0] - a[0]) * tz + (p[1] - a[1]) * tx, along + (p[0] - a[0]) * tx + (p[1] - a[1]) * tz);
            samples.push({ indices: ids.map(i => grid[i]) as [number, number, number], weights: [w0, w1, 1 - w0 - w1] });
          }
        }
      }
    }
    along += length;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const mesh = { geometry, samples }; updatePathHeights(mesh, site); return mesh;
}

export function updatePathHeights(mesh: PathMesh, site: Project['site']) {
  const position = mesh.geometry.getAttribute('position');
  mesh.samples.forEach(({ indices, weights }, i) => position.setY(i, indices.reduce((y, index, j) => y + site.terrain.heights[index] * weights[j], PATH_LIFT)));
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
}
