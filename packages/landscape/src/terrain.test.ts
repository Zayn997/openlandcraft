import { describe, expect, it } from 'vitest';
import { createHeightfield, sampleHeight, TerrainStroke, diffHeights, restoreHeights, terrainSchema, type BrushSettings } from './index';

const bounds = { width: 32, depth: 32 };
const settings = (kind: BrushSettings['kind'], strength = 1): BrushSettings => ({ kind, radius: 5, strength, target: 3 });

describe('heightfield queries and validation', () => {
  it('interpolates a plane in world coordinates and clamps boundary queries', () => {
    const field = createHeightfield(bounds, (x, z) => x * 0.2 + z * 0.1, 33, 33);
    expect(sampleHeight(field, bounds, 1.25, -2.5)).toBeCloseTo(0);
    expect(sampleHeight(field, bounds, 40, -40)).toBeCloseTo(1.6);
    expect(() => terrainSchema.parse({ ...field, heights: field.heights.slice(1) })).toThrow();
    expect(() => terrainSchema.parse({ ...field, heights: field.heights.map(() => NaN) })).toThrow();
  });
});

describe('bounded brush strokes', () => {
  it.each(['raise', 'lower', 'flatten'] as const)('%s modifies the center and preserves samples beyond its radius', (kind) => {
    const field = createHeightfield(bounds, () => 0, 33, 33);
    const stroke = new TerrainStroke(field, bounds, settings(kind)); stroke.move(0, 0);
    const result = stroke.snapshot();
    expect(sampleHeight(result, bounds, 0, 0)).toBeCloseTo(kind === 'raise' ? 2 : kind === 'lower' ? -2 : 3);
    expect(sampleHeight(result, bounds, 10, 10)).toBe(0);
    expect(field.heights.every((height) => height === 0)).toBe(true);
  });
  it('smooths a spike against the original neighborhood', () => {
    const field = createHeightfield(bounds, (x, z) => x === 0 && z === 0 ? 10 : 0, 33, 33);
    const stroke = new TerrainStroke(field, bounds, settings('smooth')); stroke.move(0, 0);
    const center = sampleHeight(stroke.snapshot(), bounds, 0, 0);
    expect(center).toBeGreaterThan(0); expect(center).toBeLessThan(1);
  });
  it('does not compound repeated dabs and preserves strength across event rates', () => {
    const field = createHeightfield(bounds, () => 0, 33, 33);
    const single = new TerrainStroke(field, bounds, settings('raise', 0.7));
    single.move(-8, 0); single.move(8, 0);
    const dense = new TerrainStroke(field, bounds, settings('raise', 0.7));
    for (let step = 0; step <= 160; step++) dense.move(-8 + step / 10, 0);
    single.snapshot().heights.forEach((value, i) => expect(dense.snapshot().heights[i]).toBeCloseTo(value, 5));
    const dwell = new TerrainStroke(field, bounds, settings('raise')); dwell.move(0, 0);
    const once = dwell.snapshot();
    for (let i = 0; i < 100; i++) dwell.move(0, 0);
    expect(dwell.snapshot()).toEqual(once);
  });
  it('clamps edits to height limits and rejects invalid settings', () => {
    const field = createHeightfield(bounds, () => 34.5, 9, 9);
    const stroke = new TerrainStroke(field, bounds, settings('raise')); stroke.move(0, 0);
    expect(sampleHeight(stroke.snapshot(), bounds, 0, 0)).toBe(35);
    expect(() => new TerrainStroke(field, bounds, { ...settings('raise'), radius: NaN })).toThrow();
  });
  it('stores only changed samples and restores exact original heights', () => {
    const field = createHeightfield(bounds, (x, z) => Math.sin(x) + Math.cos(z), 33, 33);
    const stroke = new TerrainStroke(field, bounds, settings('raise')); stroke.move(0, 0);
    const result = stroke.snapshot(), patch = diffHeights(field, result);
    expect(patch.indices.length).toBeGreaterThan(0);
    expect(patch.indices.length).toBeLessThan(field.heights.length / 5);
    expect(restoreHeights(result, patch, 'before')).toEqual(field);
    expect(restoreHeights(field, patch, 'after')).toEqual(result);
  });
});
