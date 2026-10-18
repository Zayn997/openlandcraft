import { expect, it } from 'vitest';
import { createHeightfield, sampleHeight } from '@openlandcraft/landscape';
import { createSite, createOcean } from '@openlandcraft/core';
import { shoreCamera } from './shore-camera';
import { oceanHorizonGeometry } from './ocean-horizon';
import { opticsSize } from './optics-budget';

it('frames actual sea-level contours on either coast orientation without moving authored terrain',()=>{
  for(const sign of [-1,1]) for(const level of [-8,0,8]) {
    const project=createSite({name:'Camera coast',width:90,depth:72,resolution:129,preset:'flat'});
    project.site.terrain=createHeightfield(project.site,(x,z)=>Math.max(-9,Math.min(35,level+sign*(x-Math.sin(z*0.1)*2)*0.15)));
    const before=[...project.site.terrain.heights],ocean={...createOcean(),level};
    const pose=shoreCamera(project.site,ocean);
    expect(pose.position.every(Number.isFinite)).toBe(true); expect(pose.target.every(Number.isFinite)).toBe(true);
    expect(Math.abs(pose.position[0])).toBeLessThan(45);expect(Math.abs(pose.position[2])).toBeLessThan(36);
    expect(pose.position[1]).toBeGreaterThan(sampleHeight(project.site.terrain,project.site,pose.position[0],pose.position[2]));
    expect(pose.position[1]).toBeGreaterThan(ocean.level+ocean.amplitude*1.7);
    expect(project.site.terrain.heights).toEqual(before);
  }
});

it('returns finite above-ground views when a flat site has no sea-level contour',()=>{
  const project=createSite({name:'Flat',width:20,depth:200,resolution:129,preset:'flat'});
  for(const level of [-8,8]) {
    const pose=shoreCamera(project.site,{...createOcean(),level});
    expect(pose.position.every(Number.isFinite)).toBe(true);expect(pose.position[1]).toBeGreaterThan(Math.max(2,level));
  }
});

it('keeps the horizon mesh outside the authored rectangle with a dense shared boundary',()=>{
  const g=oceanHorizonGeometry(90,72),p=g.attributes.position,indices=g.index!;
  expect(p.count).toBeLessThan(17000);expect(indices.count/3).toBeLessThan(25000);
  for(let i=0;i<indices.count;i+=3){
    const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];
    const x=ids.reduce((sum,id)=>sum+p.getX(id),0)/3,z=ids.reduce((sum,id)=>sum+p.getZ(id),0)/3;
    expect(Math.abs(x)>=45-0.001 || Math.abs(z)>=36-0.001).toBe(true);
    const ax=p.getX(ids[1])-p.getX(ids[0]),az=p.getZ(ids[1])-p.getZ(ids[0]);
    const bx=p.getX(ids[2])-p.getX(ids[0]),bz=p.getZ(ids[2])-p.getZ(ids[0]);
    expect(az*bx-ax*bz).toBeGreaterThan(0);
  }
  g.dispose();
});

it('bounds refraction allocation on high-DPI landscape and portrait displays',()=>{
  for(const [w,h] of [[1370,930],[375,812],[800,4000],[4000,800]]) for(const dpr of [1,1.5,3]) {
    const high=opticsSize(w,h,dpr,'high'),low=opticsSize(w,h,dpr,'low');
    expect(Math.max(...high)).toBeLessThanOrEqual(1280);expect(Math.max(...low)).toBeLessThanOrEqual(768);
    expect(high.every((size,i)=>size>=low[i] && size>=1)).toBe(true);
    expect(Math.abs(high[0]/high[1]-w/h)).toBeLessThan(0.04);
  }
});
