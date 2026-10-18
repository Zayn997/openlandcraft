import { describe, expect, it } from 'vitest';
import { carveRiver, createHeightfield, riverIssue, sampleHeight, sampleRiver, type RiverShape } from './index';

const bounds = { width: 60, depth: 60 };
const river: RiverShape = { points: [[-15, 3, -12], [-5, 2, 0], [12, 1, 14]], width: 4, depth: 1.5, bank: 2 };
describe('river spline and derived carving', () => {
  it('interpolates control points, keeps elevation downhill and accumulates stable arc length', () => {
    const samples = sampleRiver(river.points);
    expect(samples[0]).toEqual({ x: -15, y: 3, z: -12, along: 0 });
    expect(samples.at(-1)).toMatchObject({ x: 12, y: 1, z: 14 });
    expect(samples.some((point) => point.x === -5 && point.z === 0 && point.y === 2)).toBe(true);
    samples.slice(1).forEach((point, i) => { expect(point.y).toBeLessThanOrEqual(samples[i].y); expect(point.along).toBeGreaterThan(samples[i].along); });
    expect(riverIssue(river, bounds)).toBeNull();
  });
  it('carves a channel and blends banks without raising or mutating authored terrain', () => {
    const base = createHeightfield(bounds, () => 5, 121, 121), original = [...base.heights];
    const carved = carveRiver(base, bounds, river);
    expect(base.heights).toEqual(original); expect(sampleHeight(carved, bounds, -5, 0)).toBeCloseTo(0.5, 5);
    expect(sampleHeight(carved, bounds, 25, -25)).toBe(5);
    carved.heights.forEach((height, i) => { expect(height).toBeLessThanOrEqual(base.heights[i]); expect(height).toBeGreaterThanOrEqual(-9); });
    expect(carveRiver(base, bounds, river)).toEqual(carved);
  });
  it('rejects uphill, repeated, out-of-bounds and unsupported overlapping paths', () => {
    expect(riverIssue({ ...river, points: [[-10, 1, -10], [10, 2, 10]] }, bounds)).toContain('descend');
    expect(riverIssue({ ...river, points: [[0, 1, 0], [0, 1, 0]] }, bounds)).toContain('1 m');
    expect(riverIssue({ ...river, points: [[-29, 2, 0], [10, 1, 10]] }, bounds)).toContain('inside');
    expect(riverIssue({ ...river, points: [[-15, 2, -15], [15, 2, 15], [-15, 2, 15], [15, 2, -15]] }, bounds)).toMatch(/Crossing|overlap|tight/);
    expect(riverIssue({ ...river, points: [[-10, 2, -10], [10, 2, 0], [-10, 2, -10]] }, bounds)).toContain('loops');
    expect(riverIssue({ ...river, points: [[-10, -8, -10], [10, -8, 10]], depth: 3 }, bounds)).toContain('-9');
    expect(riverIssue(river, bounds, { columns: 3, rows: 3 })).toContain('resolution');
  });
});
