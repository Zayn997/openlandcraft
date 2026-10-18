import { MIN_HEIGHT, type Heightfield, type TerrainBounds } from './index';

export type RiverPoint = [number, number, number];
export type RiverShape = { points: RiverPoint[]; width: number; depth: number; bank: number };
export type RiverSample = { x: number; y: number; z: number; along: number };

/** Catmull–Rom in plan; linear elevation preserves the authored downhill profile. */
export function sampleRiver(points: RiverPoint[]): RiverSample[] {
  const samples: RiverSample[] = [];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const p0 = points[Math.max(0, segment - 1)], p1 = points[segment], p2 = points[segment + 1], p3 = points[Math.min(points.length - 1, segment + 2)];
    const steps = Math.max(8, Math.ceil(Math.hypot(p2[0] - p1[0], p2[2] - p1[2]) / 0.75));
    for (let step = segment ? 1 : 0; step <= steps; step++) {
      const t = step / steps;
      const axis = (i: number) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t * t * t);
      const x = axis(0), z = axis(2), previous = samples.at(-1);
      samples.push({ x, y: p1[1] + (p2[1] - p1[1]) * t, z, along: previous ? previous.along + Math.hypot(x - previous.x, z - previous.z) : 0 });
    }
  }
  return samples;
}

function closest(x: number, z: number, a: RiverSample, b: RiverSample) {
  const dx = b.x - a.x, dz = b.z - a.z, lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSquared)) : 0;
  return { distance: Math.hypot(x - a.x - t * dx, z - a.z - t * dz), y: a.y + (b.y - a.y) * t };
}

export function riverIssue(river: RiverShape, bounds: TerrainBounds, field?: Pick<Heightfield, 'columns' | 'rows'>): string | null {
  const { points, width, depth, bank } = river;
  const minimumWidth = field ? 2 * Math.max(bounds.width / (field.columns - 1), bounds.depth / (field.rows - 1)) : 0;
  if (width < minimumWidth) return `Use a river width of at least ${Math.ceil(minimumWidth * 10) / 10} m for this terrain resolution.`;
  for (let i = 0; i < points.length; i++) {
    if (points[i][1] - depth < MIN_HEIGHT) return 'Raise the water elevation or reduce depth to keep the bed above -9 m.';
    if (i && points[i][1] > points[i - 1][1] + 1e-6) return 'River elevations must stay level or descend from the first point to the last.';
    if (i && Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]) < 1) return 'Keep adjacent river points at least 1 m apart.';
  }
  const samples = sampleRiver(points), margin = width / 2 + bank;
  if ((samples.at(-1)?.along ?? 0) > 250) return 'Keep this prototype river under 250 m long.';
  if (samples.some((point) => Math.abs(point.x) + margin > bounds.width / 2 || Math.abs(point.z) + margin > bounds.depth / 2)) return 'Keep the entire river and its banks inside the site.';
  if (points.length > 2 && Math.hypot(points[0][0] - points.at(-1)![0], points[0][2] - points.at(-1)![2]) < 1) return 'Closed river loops are unsupported. Use one open path.';
  for (let i = 1; i < samples.length - 1; i++) {
    const a = samples[i - 1], b = samples[i], c = samples[i + 1];
    const ax = b.x - a.x, az = b.z - a.z, bx = c.x - b.x, bz = c.z - b.z;
    const l1 = Math.hypot(ax, az), l2 = Math.hypot(bx, bz), sine = Math.abs(ax * bz - az * bx) / (l1 * l2 || 1);
    if ((ax * bx + az * bz) < 0 || (sine > 1e-6 && (l1 + l2) / (2 * sine) < width / 2 + 0.25)) return 'This bend is too tight. Move points apart or reduce river width.';
  }
  const cross = (a: RiverSample, b: RiverSample, c: RiverSample) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    for (let j = i + 2; j < samples.length; j++) {
      const c = samples[j - 1], d = samples[j];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 'Crossing or looping rivers are unsupported. Use one open path.';
      if (c.along - b.along > margin * 3 && Math.min(closest(c.x, c.z, a, b).distance, closest(d.x, d.z, a, b).distance, closest(a.x, a.z, c, d).distance) < margin * 2) return 'Separate distant bends so the river banks do not overlap.';
    }
  }
  return null;
}

/** Pure derived terrain: never bake the river into authored sculpting. */
export function carveRiver(field: Heightfield, bounds: TerrainBounds, river: RiverShape): Heightfield {
  const samples = sampleRiver(river.points), reach = river.width / 2 + river.bank;
  const distances = new Float64Array(field.heights.length).fill(Infinity), levels = new Float64Array(field.heights.length);
  const dx = bounds.width / (field.columns - 1), dz = bounds.depth / (field.rows - 1);
  for (let segment = 1; segment < samples.length; segment++) {
    const a = samples[segment - 1], b = samples[segment];
    const minX = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach + bounds.width / 2) / dx)), maxX = Math.min(field.columns - 1, Math.ceil((Math.max(a.x, b.x) + reach + bounds.width / 2) / dx));
    const minZ = Math.max(0, Math.floor((Math.min(a.z, b.z) - reach + bounds.depth / 2) / dz)), maxZ = Math.min(field.rows - 1, Math.ceil((Math.max(a.z, b.z) + reach + bounds.depth / 2) / dz));
    for (let row = minZ; row <= maxZ; row++) for (let column = minX; column <= maxX; column++) {
      const index = row * field.columns + column, point = closest(column * dx - bounds.width / 2, row * dz - bounds.depth / 2, a, b);
      if (point.distance < distances[index]) { distances[index] = point.distance; levels[index] = point.y; }
    }
  }
  const half = river.width / 2;
  return { ...field, heights: field.heights.map((base, index) => {
    const distance = distances[index], water = levels[index];
    if (distance >= reach) return base;
    const t = Math.max(0, Math.min(1, (distance - half) / river.bank));
    const bed = distance <= half ? water - river.depth * (1 - (distance / half) ** 2) : water + (base - water) * t * t * (3 - 2 * t);
    return Math.max(MIN_HEIGHT, Math.min(base, bed));
  }) };
}
