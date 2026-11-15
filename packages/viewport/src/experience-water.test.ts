import { describe, expect, it } from 'vitest';
import { createSite, createLake, createRiver, createOcean } from '@openlandcraft/core';
import { experienceWaterSurface } from './experience-water';
import { sampleRiver } from '@openlandcraft/landscape';

function scene() { const p = createSite({ name: 'Swim water', width: 60, depth: 60, resolution: 129, preset: 'flat' }); p.site.terrain.heights.fill(0); return p; }
describe('swimming water surfaces', () => {
  it('respects lake shores, island holes, hidden water and dry ground', () => {
    const p = scene(), lake = createLake(p, [[-12,-12],[12,-12],[12,12],[-12,12]]); lake.level = 3; lake.holes = [[[-5,-5],[-5,5],[5,5],[5,-5]]]; p.entities.push(lake);
    const water = experienceWaterSurface(p); expect(water(8, 0)).toBe(3); expect(water(0, 0)).toBeNull(); expect(water(15, 0)).toBeNull();
    expect(experienceWaterSurface({ ...p, entities: [{ ...lake, visible: false }] })(8, 0)).toBeNull();
    p.site.terrain.heights.fill(4); expect(water(8, 0)).toBeNull();
  });
  it('interpolates the elevation of rivers and excludes points outside their channel', () => {
    const p = scene(), river = createRiver(p); river.points = [[-10,3,0],[10,1,0]]; river.width = 4; p.entities.push(river);
    const water = experienceWaterSurface(p), path = sampleRiver(river.points), a = path[20], b = path[21];
    expect(water(0, 0)).toBeCloseTo(2); expect(water((a.x + b.x) / 2, 0)).toBeCloseTo((a.y + b.y) / 2); expect(water(0, 6)).toBeNull(); expect(water(15, 0)).toBeNull();
  });
  it('uses the highest visible water surface in overlapping ocean and lake volumes', () => {
    const p = scene(), ocean = createOcean(), lake = createLake(p, [[-8,-8],[8,-8],[8,8],[-8,8]]); ocean.level = 2; lake.level = 3; p.entities.push(ocean, lake);
    expect(experienceWaterSurface(p)(0, 0)).toBe(3); expect(experienceWaterSurface(p)(20, 0)).toBe(2);
  });
});
