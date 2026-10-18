import {describe,expect,it} from 'vitest';
import {createLake,createSite,evaluateProject} from '@openlandcraft/core';
import {LakeHistory,lakeWave} from './lake-water';

const setup=()=>{const project=createSite({name:'Lake motion',width:50,depth:50,resolution:129,preset:'flat'}),lake=createLake(project,[[-10,-10],[10,-10],[10,10],[-10,10]]);project.entities.push(lake);return {site:evaluateProject(project).site,lake};};
describe('bounded lake motion',()=>{
  it('changes with time, responds to depth, and stays still at zero amplitude',()=>{
    const {lake}=setup();expect(lakeWave(lake,2,3,0,3,0).height).not.toBe(lakeWave(lake,2,3,0,3,1).height);
    expect(lakeWave({...lake,amplitude:0},2,3,0,3,1).height).toBe(0);
    expect(lakeWave(lake,2,3,0,-2,1).height).toBe(0);
    expect(lakeWave(lake,2,3,lake.level,0,1)).not.toEqual(lakeWave(lake,2,3,0,3,1));
  });
  it('keeps history bounded, supports reset/zero speed, and decays foam and bank wetness',()=>{
    const {site,lake}=setup(),history=new LakeHistory(site,lake);
    for(let i=0;i<80;i++)history.advance(0.25);
    expect(history.columns).toBeLessThanOrEqual(129);expect(history.rows).toBeLessThanOrEqual(129);expect(Math.max(...history.wet)).toBe(1);expect(Math.max(...history.foam)).toBeGreaterThan(0);
    const clock=history.clock,foam=Array.from(history.foam);history.lake={...lake,speed:0};expect(history.advance(0.25)).toBe(false);expect(history.clock).toBe(clock);expect(Array.from(history.foam)).toEqual(foam);
    history.lake={...lake,amplitude:0,foam:0};history.heights.fill(lake.level+1);const wet=Math.max(...history.wet),maxFoam=Math.max(...history.foam);
    for(let i=0;i<80;i++)history.advance(0.25);expect(Math.max(...history.wet)).toBeLessThan(wet);expect(Math.max(...history.foam)).toBeLessThan(maxFoam);
    history.clearHistory();expect(Math.max(...history.pixels)).toBe(0);
  },10000); // Preserve the long generation/decay window under concurrent suite CPU contention.
  it('caps long frame deltas without touching authored settings or heights',()=>{
    const {site,lake}=setup(),before=structuredClone({site,lake}),a=new LakeHistory(site,lake),b=new LakeHistory(site,lake);
    a.advance(10);b.advance(0.25);expect(a.clock).toBe(b.clock);expect(a.pixels).toEqual(b.pixels);expect({site,lake}).toEqual(before);
  });
});
