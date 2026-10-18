import type { TerrainBounds } from './index';

export type PathPoint = [number, number];
export type PathShape = { points: PathPoint[]; width: number };
export const pathLength = (points: PathPoint[]) => points.reduce((sum, p, i) => sum + (i ? Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0), 0);
const cross = (a: PathPoint, b: PathPoint, c: PathPoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export const polygonArea = (points: PathPoint[]) => Math.abs(points.reduce((area, p, i) => { const q = points[(i + 1) % points.length]; return area + p[0] * q[1] - p[1] * q[0]; }, 0)) / 2;

/** Sutherland–Hodgman clipping; both polygons use counterclockwise X/Z order. */
export function clipPathPolygon(subject: PathPoint[], boundary: PathPoint[]): PathPoint[] {
  let result = subject;
  for (let i = 0; i < boundary.length && result.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length], input = result;
    result = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length], cp = cross(a, b, p), cq = cross(a, b, q);
      if (cp >= -1e-9) result.push(p);
      if ((cp >= -1e-9) !== (cq >= -1e-9)) {
        const t = cp / (cp - cq); result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return result;
}

/** Shared miter joins keep adjacent strips watertight without overlapping faces. */
export function pathStrips({ points, width }: PathShape): PathPoint[][] {
  const normals = points.slice(1).map((p, i): PathPoint => {
    const dx = p[0] - points[i][0], dz = p[1] - points[i][1], length = Math.hypot(dx, dz) || 1;
    return [-dz / length, dx / length];
  });
  const joins = points.map((p, i) => {
    const a = normals[Math.max(0, i - 1)], b = normals[Math.min(i, normals.length - 1)];
    const denominator = Math.max(1e-9, 1 + a[0] * b[0] + a[1] * b[1]);
    const offset: PathPoint = [(a[0] + b[0]) * width / 2 / denominator, (a[1] + b[1]) * width / 2 / denominator];
    return { left: [p[0] + offset[0], p[1] + offset[1]] as PathPoint, right: [p[0] - offset[0], p[1] - offset[1]] as PathPoint };
  });
  return joins.slice(1).map((j, i) => [joins[i].right, j.right, j.left, joins[i].left]);
}

export function pathIssue(path: PathShape, bounds: TerrainBounds): string | null {
  const { points, width } = path;
  for (let i = 1; i < points.length; i++) {
    if (Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) < 1) return 'Keep adjacent path points at least 1 m apart.';
    if (i < points.length - 1) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      const dot = ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]) || 1);
      if (dot < -0.5) return 'This path turn is too sharp. Spread the points or use a gentler turn.';
    }
  }
  if (pathLength(points) > 250) return 'Keep the path at most 250 m long.';
  const strips = pathStrips(path);
  for (let i = 0; i < strips.length; i++) {
    const strip = strips[i];
    if (strip.some(p => Math.abs(p[0]) > bounds.width / 2 + 1e-8 || Math.abs(p[1]) > bounds.depth / 2 + 1e-8)) return 'Keep the entire path surface inside the site.';
    if (strip.some((p, j) => cross(p, strip[(j + 1) % 4], strip[(j + 2) % 4]) <= 1e-8)) return 'These bends are too close for the path width. Spread the points or narrow the path.';
    for (let j = 0; j < i; j++) {
      if (polygonArea(clipPathPolygon(strip, strips[j])) > 1e-6) return 'Path surfaces cannot cross or overlap. Use one open, unbranched route.';
    }
  }
  if (points.length > 2 && Math.hypot(points[0][0] - points.at(-1)![0], points[0][1] - points.at(-1)![1]) < width) return 'Closed path loops are unsupported. Separate the endpoints.';
  return null;
}
