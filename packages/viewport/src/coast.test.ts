import { describe, expect, it } from 'vitest';
import { Editor, createOcean, createSite, type Ocean } from '@openlandcraft/core';
import { serializeProject } from '@openlandcraft/project';
import { createHeightfield } from '@openlandcraft/landscape';
import { buildCoastField, CoastHistory, coastSample } from './coast';

const beach = () => {
  const site = createSite({ name: 'Beach', width: 40, depth: 30, resolution: 129, preset: 'flat' }).site;
  return { ...site, terrain: createHeightfield(site, (x, z) => -x * 0.14 + Math.sin(z * 0.21) * 0.16, 129, 105) };
};
const ocean = () => ({ ...createOcean('ocean'), direction: 180, amplitude: 0.4, wavelength: 10, speed: 1, dryingTime: 8 });

describe('reference-driven coastal progression', () => {
  it('shortens and slows shallow waves and produces finite fronts for every direction', () => {
    const site = beach(), water = ocean(), f = buildCoastField(site, water), r = Math.floor(f.rows / 2), index = (x: number) => r * f.columns + Math.round((x / f.width + 0.5) * (f.columns - 1));
    const shallow = index(2), offshore = index(16);
    expect(f.speed[shallow]).toBeLessThan(f.speed[offshore]);
    expect(Math.hypot(f.slopeX[shallow], f.slopeZ[shallow])).toBeGreaterThan(Math.hypot(f.slopeX[offshore], f.slopeZ[offshore]));
    expect(f.packed[shallow * 4 + 3]).toBeGreaterThan(f.packed[offshore * 4 + 3]);
    expect(f.slopeZ.some((value) => Math.abs(value) > 0.02)).toBe(true);
    for (const direction of [0, 45, 90, 180, 270, 360]) {
      const field = buildCoastField(site, { ...water, direction });
      expect(Array.from(field.packed).every(Number.isFinite)).toBe(true);
      expect(Math.max(...field.speed)).toBeLessThanOrEqual(field.deepSpeed + 0.0001);
    }
  });
  it('generates actual run-up, retreat, lingering wet sand, and foam on a sloping beach', () => {
    const simulation = new CoastHistory(beach(), ocean()), f = simulation.field;
    let wetAfterRetreat = false, drying = false, reached = false, foam = false;
    const before = new Float32Array(simulation.wet);
    for (let step = 0; step < 240; step++) {
      before.set(simulation.wet); simulation.advance(0.05);
      for (let i = 0; i < f.heights.length; i++) {
        if (f.heights[i] < 0.03 || f.heights[i] > 0.3) continue;
        const c = i % f.columns, r = Math.floor(i / f.columns), x = c*f.dx-f.width/2, z = r*f.dz-f.depth/2;
        const sample = coastSample(simulation.ocean, f.phase[i], f.packed[i*4+3], f.heights[i], simulation.clock, -z);
        reached ||= sample.thickness > 0.01;
        if (sample.thickness < 0 && simulation.wet[i] > 0.1) { wetAfterRetreat = true; drying ||= simulation.wet[i] < before[i] && before[i] > 0.1; }
      }
      foam ||= simulation.foam.some((value) => value > 0.015);
    }
    expect(reached).toBe(true); expect(wetAfterRetreat).toBe(true); expect(drying).toBe(true); expect(foam).toBe(true);
    expect(simulation.foam.every((v) => v >= 0 && v <= 0.90001)).toBe(true);
    expect(simulation.wet.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
  it('advects and decays foam with no source and never creates wetness on untouched high ground', () => {
    const simulation = new CoastHistory(beach(), { ...ocean(), foam: 0, swash: 0, amplitude: 0 });
    const f = simulation.field, i = Math.floor(f.rows/2) * f.columns + Math.floor(f.columns/2);
    simulation.foam[i] = 0.8; for (let step = 0; step < 20; step++) simulation.advance(0.05);
    expect(Math.max(...simulation.foam)).toBeLessThan(0.8); expect(Math.max(...simulation.foam)).toBeGreaterThan(0);
    for (let i = 0; i < f.heights.length; i++) if (f.heights[i] > 1) expect(simulation.wet[i]).toBe(0);
  });
  it('keeps fixed-step history deterministic, freezes at zero speed, and resets after edited terrain', () => {
    const site = beach(), water = ocean(), a = new CoastHistory(site, water), b = new CoastHistory(site, water), original = [...site.terrain.heights];
    for (let i = 0; i < 60; i++) a.advance(1/60);
    for (let i = 0; i < 20; i++) b.advance(1/20);
    expect(a.foam).toEqual(b.foam); expect(a.wet).toEqual(b.wet); expect(a.time).toBeCloseTo(1);
    const frozen = new CoastHistory(site, { ...water, speed: 0 }); expect(frozen.advance(1)).toBe(false); expect(frozen.clock).toBe(0);
    const edited = { ...site, terrain: { ...site.terrain, heights: site.terrain.heights.map((height) => height + 0.3) } }, reset = new CoastHistory(edited, water);
    expect(reset.time).toBe(0); expect(reset.foam.every((v) => v === 0)).toBe(true); expect(reset.wet.every((v) => v === 0)).toBe(true);
    expect(reset.field.heights).not.toEqual(a.field.heights); expect(site.terrain.heights).toEqual(original);
  });
  it('retains phase/history when timing or source controls change and decays old foam after generation stops', () => {
    const simulation = new CoastHistory(beach(), ocean());
    for (let step = 0; step < 80; step++) simulation.advance(0.05);
    const oldTime = simulation.time, oldFoam = Math.max(...simulation.foam);
    expect(oldFoam).toBeGreaterThan(0.01);
    simulation.ocean = { ...simulation.ocean, speed: 2, foam: 0, foamPersistence: 1 };
    simulation.advance(0.05); expect(simulation.time).toBeCloseTo(oldTime + 0.1); expect(Math.max(...simulation.foam)).toBeGreaterThan(0);
    for (let step = 0; step < 80; step++) simulation.advance(0.05);
    expect(Math.max(...simulation.foam)).toBeLessThan(oldFoam * 0.02);
    // Different swell frequencies must share a continuous clock, without a jump at 2π.
    expect(simulation.clock).toBeCloseTo(simulation.time * simulation.field.omega);
    expect(simulation.clock).toBeGreaterThan(2 * Math.PI);
  });
  it('keeps evolving foam and wetness outside the authored document, history, and portable file', () => {
    const editor = new Editor(createSite({ name: 'Runtime isolation', width: 40, depth: 30, resolution: 129, preset: 'coast' })), before = editor.getSnapshot(), text = serializeProject(before.project);
    const water = before.project.entities.find((entity): entity is Ocean => entity.kind === 'ocean')!, simulation = new CoastHistory(before.project.site, water);
    for (let i = 0; i < 40; i++) simulation.advance(0.05);
    expect(simulation.time).toBeGreaterThan(0); expect(simulation.wet.some((v) => v > 0)).toBe(true);
    expect(editor.getSnapshot()).toBe(before); expect(serializeProject(before.project)).toBe(text);
    expect(text).not.toContain('foamHistory'); expect(text).not.toContain('pixels');
  });
  it('clears stale history during transient sculpting while keeping wave phase moving', () => {
    const simulation = new CoastHistory(beach(), ocean());
    for (let i = 0; i < 40; i++) simulation.advance(0.05);
    expect(simulation.wet.some((v) => v > 0)).toBe(true); const before = simulation.time;
    simulation.clearHistory(); simulation.advanceClock(0.1);
    expect(simulation.time).toBeCloseTo(before + 0.1); expect(simulation.wet.every((v) => v === 0)).toBe(true); expect(simulation.foam.every((v) => v === 0)).toBe(true);
    simulation.advance(0.05); expect(simulation.wet.some((v) => v > 0)).toBe(true);
  });
  it('retains and transports residual foam outside the active shoreline band', () => {
    const simulation = new CoastHistory(beach(), { ...ocean(), amplitude:0, foam:0, swash:0 });
    const f=simulation.field, i=Math.floor(f.rows/2)*f.columns+f.columns-4;
    expect(f.heights[i]).toBeLessThan(-2);
    simulation.foam[i]=0.8;
    for(let step=0;step<20;step++) simulation.advance(0.05);
    expect(Math.max(...simulation.foam)).toBeGreaterThan(0);
    expect(Math.max(...simulation.foam)).toBeLessThan(0.8);
    expect(simulation.foam.filter(v=>v>0).length).toBeGreaterThan(1);
  });
});
