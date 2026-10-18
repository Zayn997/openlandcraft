import {describe,expect,it} from 'vitest';
import {createSite} from '@openlandcraft/core';
import {lakeDistance,polygonArea,type PathPoint} from '@openlandcraft/landscape';
import {buildRegionMesh,updateRegionHeights} from './region-geometry';
describe('terrain-conforming region surfaces',()=>{
  it('covers a concave polygon without filling its notch and keeps all triangles upward',()=>{
    const site=createSite({name:'Region',width:40,depth:40,resolution:129,preset:'flat'}).site,points:PathPoint[]=[[-8,-8],[8,-8],[8,0],[0,0],[0,8],[-8,8]];
    const mesh=buildRegionMesh(points,site,0.012),p=mesh.geometry.getAttribute('position');let area=0;
    for(let i=0;i<p.count;i+=3){const a:[number,number]=[p.getX(i),p.getZ(i)],b:[number,number]=[p.getX(i+1),p.getZ(i+1)],c:[number,number]=[p.getX(i+2),p.getZ(i+2)];area+=polygonArea([a,b,c]);expect(lakeDistance(points,(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3)).toBeGreaterThanOrEqual(-1e-6);expect(mesh.geometry.getAttribute('normal').getY(i)).toBeGreaterThan(0.99);}
    expect(area).toBeCloseTo(polygonArea(points),4);mesh.geometry.dispose();
  });
  it('reuses topology and exact terrain-triangle weights through sculpting',()=>{
    const site=createSite({name:'Region',width:40,depth:40,resolution:129,preset:'flat'}).site,mesh=buildRegionMesh([[-5,-5],[5,-5],[5,5],[-5,5]],site,0.012),samples=mesh.samples;
    const changed={...site,terrain:{...site.terrain,heights:site.terrain.heights.map((h,i)=>h+Math.sin(i)*0.4)}};updateRegionHeights(mesh,changed,0.017);
    expect(mesh.samples).toBe(samples);samples.forEach((s,i)=>expect(mesh.geometry.getAttribute('position').getY(i)).toBeCloseTo(0.017+s.indices.reduce((sum,index,j)=>sum+changed.terrain.heights[index]*s.weights[j],0),5));mesh.geometry.dispose();
  });
});
