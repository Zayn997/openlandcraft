import { describe, expect, it } from 'vitest';
import { coastalWave, trochoid } from './coastal-waves';

describe('directional coastal swells', () => {
  it('keeps the sharpened wave non-folding with a zero mean and an analytic slope', () => {
    for (const chop of [0, 0.18, 0.43]) {
      let sum = 0;
      for (let i = 0; i < 720; i++) {
        const phase = i * Math.PI / 360, wave = trochoid(phase, chop), epsilon = 1e-5;
        const numerical = (trochoid(phase + epsilon, chop).height - trochoid(phase - epsilon, chop).height) / (2 * epsilon);
        expect(wave.slope).toBeCloseTo(numerical, 3);
        expect(Math.abs(wave.slope)).toBeLessThan(2);
        sum += wave.height;
      }
      expect(sum / 720).toBeCloseTo(0, 5);
    }
  });
  it('has continuous motion across a main-wave period and different overlapping arrivals', () => {
    const sample = (clock: number, along = 0) => coastalWave(1.3, along, clock, 0.7, 1, 1.3, 0.35, 1, 1.3);
    const a = sample(2 * Math.PI - 1e-5), b = sample(2 * Math.PI + 1e-5);
    expect(Math.abs(a.height - b.height)).toBeLessThan(0.0001);
    expect(Math.abs(sample(0).height - sample(2 * Math.PI).height)).toBeGreaterThan(0.01);
    expect(Math.abs(sample(2, 0).height - sample(2, 15).height)).toBeGreaterThan(0.01);
  });
  it('keeps supported control extremes finite and produces still water at zero amplitude', () => {
    for (const depth of [-8, -0.01, 0, 0.1, 0.5, 4, 20]) for (const amplitude of [0, 0.8]) for (const breaker of [0, 2]) {
      const value = coastalWave(120, -50, 10000, Math.PI / 2, depth, 1.5, amplitude, breaker, 2);
      expect(Object.values(value).every(Number.isFinite)).toBe(true);
      expect(Math.abs(value.height)).toBeLessThan(2.5);
      if (amplitude === 0) for (const component of [value.height, value.slope, value.cross, value.breaking]) expect(Math.abs(component)).toBe(0);
      if (breaker === 0) expect(value.breaking).toBe(0);
    }
  });
});
