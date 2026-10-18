import { describe,expect,it } from 'vitest';
import { createSite,createRiver,evaluateProject,type River } from '@openlandcraft/core';
import { RiverHistory,riverWave } from './river-water';
import { riverGeometry,updateRiverProfile } from './river-geometry';

function setup() {
  const project=createSite({name:'River only',width:80,depth:60,resolution:129,preset:'flat'});
  const river:River={...createRiver(project),speed:1,width:5,depth:1.2,points:[[-22,2,-15],[-12,1.6,0],[3,1,12],[20,0.8,16]]};
  project.entities=[river];return {river,site:evaluateProject(project).site};
}
describe('river water engine',()=>{
  it('follows bends, samples real channel depth and generates resolved surface displacement',()=>{
    const {river,site}=setup(),sim=new RiverHistory(site,river),f=sim.field;
    const row=Math.floor(f.rows/2),center=row*f.columns+Math.floor(f.columns/2),bank=row*f.columns+1;
    expect(f.depths[center]).toBeGreaterThan(f.depths[bank]);expect(f.velocity[center]).toBeGreaterThan(f.velocity[bank]);
    expect(Math.abs(f.flow[0]-f.flow.at(-2)!)).toBeGreaterThan(0.1);
    expect(f.profile[(f.rows-1)*4]).toBeGreaterThan(f.profile[0]);
    const heights=Array.from({length:80},(_,i)=>riverWave(f,river,center,i*0.1).height);
    expect(Math.max(...heights)-Math.min(...heights)).toBeGreaterThan(0.1);
    for(const data of [f.positions,f.profile,f.depths,f.velocity,f.map])expect(data.every(Number.isFinite)).toBe(true);
    expect(f.rows*f.columns).toBeLessThanOrEqual(385*25);
    for(const amplitude of [0,0.4])for(const wavelength of [1.5,12]){
      const r={...river,water:{...river.water,amplitude,wavelength}},s=new RiverHistory(site,r);
      for(let i=0;i<s.field.depths.length;i+=17)expect(Object.values(riverWave(s.field,r,i,500)).every(Number.isFinite)).toBe(true);
      if(!amplitude)expect(riverWave(s.field,r,center,3).height).toBe(0);
    }
  });
  it('generates and retains bank wetness after retreat and transports foam downstream',()=>{
    const {river,site}=setup(),sim=new RiverHistory(site,river),f=sim.field;
    let retreat=false;
    for(let step=0;step<100;step++){
      sim.advance(0.05);
      for(let i=0;i<f.depths.length;i++)if(f.depths[i]<0&&f.depths[i]+riverWave(f,river,i,sim.time).height<0&&sim.wet[i]>0.1)retreat=true;
    }
    expect(retreat).toBe(true);expect(Math.max(...sim.foam)).toBeGreaterThan(0.02);
    const still={...river,water:{...river.water,amplitude:0,foam:0}},transport=new RiverHistory(site,still),g=transport.field;
    const row=Math.floor(g.rows/3),column=Math.floor(g.columns/2);transport.foam[row*g.columns+column]=0.8;
    const centroid=()=>{let mass=0,sum=0;transport.foam.forEach((v,i)=>{mass+=v;sum+=v*Math.floor(i/g.columns);});return sum/mass;};
    const start=centroid();for(let i=0;i<20;i++)transport.advance(0.05);
    expect(centroid()).toBeGreaterThan(start+1);expect(Math.max(...transport.foam)).toBeLessThan(0.8);
    expect(transport.foam.every(v=>v>=0&&v<=0.9)).toBe(true);
    const dryIndex=Array.from(g.depths).findIndex(d=>d< -0.2);expect(dryIndex).toBeGreaterThanOrEqual(0);
    transport.wet[dryIndex]=1;transport.advance(0.05);expect(transport.wet[dryIndex]).toBeLessThan(1);
  });
  it('keeps fixed-step results deterministic and retains time when source or speed changes',()=>{
    const {river,site}=setup(),a=new RiverHistory(site,river),b=new RiverHistory(site,river);
    for(let i=0;i<60;i++)a.advance(1/60);for(let i=0;i<20;i++)b.advance(1/20);
    expect(a.foam).toEqual(b.foam);expect(a.wet).toEqual(b.wet);expect(a.clock).toBeCloseTo(1);
    const before=a.clock,pixels=a.pixels.slice();a.river={...river,speed:0};expect(a.advance(0.2)).toBe(false);expect(a.clock).toBe(before);expect(a.pixels).toEqual(pixels);
    a.river={...river,speed:2,water:{...river.water,foam:0}};a.advance(0.1);expect(a.clock).toBeCloseTo(before+0.2);
    a.clearHistory();expect(a.clock).toBeCloseTo(before+0.2);expect(a.foam.every(v=>v===0)).toBe(true);expect(a.wet.every(v=>v===0)).toBe(true);
  });
  it('changes geometry quality without changing engine state and rebuilds bathymetry after terrain edits',()=>{
    const {river,site}=setup(),sim=new RiverHistory(site,river);sim.advance(0.2);
    const before=sim.pixels.slice(),high=riverGeometry(sim.field,river.water.wavelength,'high'),low=riverGeometry(sim.field,river.water.wavelength,'low');
    expect(high.attributes.position.count).toBeGreaterThan(low.attributes.position.count);expect(sim.pixels).toEqual(before);
    expect(Array.from(high.attributes.position.array).every(Number.isFinite)).toBe(true);
    const edited={...site,terrain:{...site.terrain,heights:site.terrain.heights.map(h=>h+0.25)}},reset=new RiverHistory(edited,river);
    expect(reset.field.depths).not.toEqual(sim.field.depths);expect(reset.clock).toBe(0);expect(reset.foam.every(v=>v===0)).toBe(true);
    const positions=high.attributes.position.array,profile=high.attributes.riverProfile.array.slice();updateRiverProfile(high,reset.field);
    expect(high.attributes.position.array).toBe(positions);expect(high.attributes.riverProfile.array).not.toEqual(profile);high.dispose();low.dispose();
  });
});
