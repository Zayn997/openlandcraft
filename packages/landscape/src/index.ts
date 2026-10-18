import { z } from 'zod';
export * from './river';

export const MIN_HEIGHT = -9;
export const MAX_HEIGHT = 35;
export const terrainSchema = z.object({
  columns: z.number().int().min(3).max(257),
  rows: z.number().int().min(3).max(257),
  heights: z.array(z.number().finite().min(MIN_HEIGHT).max(MAX_HEIGHT)).max(257 * 257),
}).strict().superRefine((field, ctx) => {
  if (field.heights.length !== field.columns * field.rows) ctx.addIssue({ code: 'custom', path: ['heights'], message: 'Terrain sample count must match its grid dimensions.' });
});
export type Heightfield = z.infer<typeof terrainSchema>;
export type TerrainBounds = { width: number; depth: number };
export type BrushKind = 'raise' | 'lower' | 'flatten' | 'smooth';
export type BrushSettings = { kind: BrushKind; radius: number; strength: number; target: number };
export const DEFAULT_BRUSH: BrushSettings = { kind: 'raise', radius: 5, strength: 0.65, target: 2 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createHeightfield(bounds: TerrainBounds, sample: (x: number, z: number) => number, columns = 129, rows = 105): Heightfield {
  return terrainSchema.parse({ columns, rows, heights: Array.from({ length: columns * rows }, (_, index) => {
    const x = (index % columns) / (columns - 1) * bounds.width - bounds.width / 2;
    const z = Math.floor(index / columns) / (rows - 1) * bounds.depth - bounds.depth / 2;
    return sample(x, z);
  }) });
}

/** X increases along columns; Z increases along rows. Queries clamp at the site boundary. */
export function sampleHeight(field: Heightfield, bounds: TerrainBounds, x: number, z: number): number {
  const gx = clamp((x / bounds.width + 0.5) * (field.columns - 1), 0, field.columns - 1);
  const gz = clamp((z / bounds.depth + 0.5) * (field.rows - 1), 0, field.rows - 1);
  const x0 = Math.floor(gx), z0 = Math.floor(gz);
  const x1 = Math.min(field.columns - 1, x0 + 1), z1 = Math.min(field.rows - 1, z0 + 1);
  const a = field.heights[z0 * field.columns + x0] * (1 - (gx - x0)) + field.heights[z0 * field.columns + x1] * (gx - x0);
  const b = field.heights[z1 * field.columns + x0] * (1 - (gx - x0)) + field.heights[z1 * field.columns + x1] * (gx - x0);
  return a * (1 - (gz - z0)) + b * (gz - z0);
}

export type HeightPatch = { indices: number[]; before: number[]; after: number[] };
export function diffHeights(before: Heightfield, after: Heightfield): HeightPatch {
  if (before.columns !== after.columns || before.rows !== after.rows) throw new Error('A brush cannot change terrain resolution.');
  const patch: HeightPatch = { indices: [], before: [], after: [] };
  before.heights.forEach((value, index) => {
    if (value !== after.heights[index]) { patch.indices.push(index); patch.before.push(value); patch.after.push(after.heights[index]); }
  });
  return patch;
}
export function restoreHeights(field: Heightfield, patch: HeightPatch, side: 'before' | 'after'): Heightfield {
  const heights = [...field.heights];
  patch.indices.forEach((index, offset) => { heights[index] = patch[side][offset]; });
  return { ...field, heights };
}

/** A stroke samples the original field with distance-spaced, bounded stamps. */
export class TerrainStroke {
  private heights: number[];
  private coverage: Float32Array;
  private previous: [number, number] | null = null;
  private remainder = 0;
  constructor(private initial: Heightfield, private bounds: TerrainBounds, public settings: BrushSettings) {
    if (!Number.isFinite(settings.radius) || settings.radius < 0.5 || settings.radius > 25 || !Number.isFinite(settings.strength) || settings.strength < 0 || settings.strength > 1 || !Number.isFinite(settings.target) || settings.target < MIN_HEIGHT || settings.target > MAX_HEIGHT || !['raise', 'lower', 'flatten', 'smooth'].includes(settings.kind)) throw new Error('Invalid terrain brush settings.');
    this.heights = [...initial.heights];
    this.coverage = new Float32Array(initial.heights.length);
  }
  private stamp(x: number, z: number) {
    const { columns, rows } = this.initial;
    const { radius, strength, kind, target } = this.settings;
    const minX = Math.max(0, Math.ceil((x - radius + this.bounds.width / 2) / this.bounds.width * (columns - 1)));
    const maxX = Math.min(columns - 1, Math.floor((x + radius + this.bounds.width / 2) / this.bounds.width * (columns - 1)));
    const minZ = Math.max(0, Math.ceil((z - radius + this.bounds.depth / 2) / this.bounds.depth * (rows - 1)));
    const maxZ = Math.min(rows - 1, Math.floor((z + radius + this.bounds.depth / 2) / this.bounds.depth * (rows - 1)));
    for (let row = minZ; row <= maxZ; row++) for (let col = minX; col <= maxX; col++) {
      const sx = col / (columns - 1) * this.bounds.width - this.bounds.width / 2;
      const sz = row / (rows - 1) * this.bounds.depth - this.bounds.depth / 2;
      const distance = Math.hypot(sx - x, sz - z) / radius;
      if (distance >= 1) continue;
      const index = row * columns + col;
      const weight = Math.fround((0.5 + 0.5 * Math.cos(Math.PI * distance)) * strength);
      if (weight <= this.coverage[index]) continue;
      this.coverage[index] = weight;
      const base = this.initial.heights[index];
      let desired = base + (kind === 'lower' ? -2 : 2);
      if (kind === 'flatten') desired = target;
      if (kind === 'smooth') {
        let sum = 0, count = 0;
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          const cx = col + dx, cz = row + dz;
          if (cx >= 0 && cx < columns && cz >= 0 && cz < rows) { sum += this.initial.heights[cz * columns + cx]; count++; }
        }
        desired = sum / count;
      }
      this.heights[index] = clamp(base + (desired - base) * weight, MIN_HEIGHT, MAX_HEIGHT);
    }
  }
  move(x: number, z: number) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (!this.previous) { this.stamp(x, z); this.previous = [x, z]; return; }
    const [px, pz] = this.previous;
    const length = Math.hypot(x - px, z - pz);
    if (length === 0) return;
    const spacing = Math.max(0.15, this.settings.radius * 0.12);
    for (let travel = spacing - this.remainder; travel <= length; travel += spacing) this.stamp(px + (x - px) * travel / length, pz + (z - pz) * travel / length);
    this.remainder = (this.remainder + length) % spacing;
    this.previous = [x, z];
  }
  snapshot(): Heightfield { return { ...this.initial, heights: [...this.heights] }; }
}
