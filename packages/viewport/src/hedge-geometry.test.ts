import {describe,it,expect} from 'vitest';
import {createHedge,createSite,hedgeTop,type Hedge} from '@openlandcraft/core';
import {hedgeStrips,lakeDistance,terrainTriangleHeight} from '@openlandcraft/landscape';
import {buildHedgeGeometry,hedgeMaterial} from './hedge-geometry';
const site=createSite({name:'Hedge mesh',width:40,depth:40,resolution:129,preset:'flat'}).site;
const hedge=(patch:Partial<Hedge>={}):Hedge=>({...createHedge({site} as never,[[-8,-5],[-8,5],[5,5]]),...patch});
describe('clipped hedge solids',()=>{
 it('makes a manifold volume with actual clipped top, sides, root embed and no internal seam walls',()=>{
  const h=hedge(),g=buildHedgeGeometry(h,site),p=g.getAttribute('position'),normals=g.getAttribute('normal'),edges=new Map<string,number>();
  const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e5)).join(':');
  for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const a=key(i+j),b=key(i+(j+1)%3),k=a<b?`${a}|${b}`:`${b}|${a}`;edges.set(k,(edges.get(k)??0)+1);}
  expect([...edges.values()].every(n=>n===2)).toBe(true);expect(g.boundingBox!.min.y).toBeCloseTo(1.92);expect(g.boundingBox!.max.y).toBeCloseTo(3.5);expect(g.userData.boundaryEdges).toBeGreaterThan(4);
  expect(Array.from({length:normals.count},(_,i)=>normals.getY(i)).some(n=>n>.99)).toBe(true);g.dispose();
 });
 it('keeps loop centers empty and supports either winding and softened open bends',()=>{
  for(const points of [[[-8,-8],[8,-8],[8,8],[-8,8]],[[-8,-8],[-8,8],[8,8],[8,-8]]] as [number,number][][]){const h=hedge({closed:true,points}),g=buildHedgeGeometry(h,site),p=g.getAttribute('position');for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;expect(Math.hypot(x,z)).toBeGreaterThan(7);}g.dispose();}
  const h=hedge({rounding:.7}),g=buildHedgeGeometry(h,site);expect(hedgeStrips(h).length).toBeGreaterThan(2);expect(g.getAttribute('position').count).toBeGreaterThan(100);g.dispose();
 });
 it('follows sloped ground at roots while retaining a level top, material color and physical leaf size',()=>{
  const sloped={...site,terrain:{...site.terrain,heights:site.terrain.heights.map((_,i)=>2+(i%129)/128)}},h=hedge({topMode:'level',topElevation:4}),g=buildHedgeGeometry(h,sloped),p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){const y=p.getY(i),ground=terrainTriangleHeight(sloped,[p.getX(i),p.getZ(i)]);expect(y===4||Math.abs(y-ground+.08)<1e-5).toBe(true);}
  expect(hedgeTop(h,sloped,[0,0])).toBe(4);const material=hedgeMaterial(h);expect(material.color.getHexString()).toBe(h.color.slice(1));expect(material.roughness).toBe(h.roughness);material.dispose();g.dispose();
 });
 it('closes the solid through independently rounded loop corners and either winding',()=>{
  const points:[number,number][]=[[-8,-8],[8,-8],[8,8],[-8,8]],amounts=[.4,0,.8,.3];
  for(const reverse of [false,true]){
   const h=hedge({closed:true,points:reverse?[...points].reverse():points,cornerRounding:reverse?[...amounts].reverse():amounts}),g=buildHedgeGeometry(h,site),p=g.getAttribute('position'),edges=new Map<string,number>();
   const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e5)).join(':');
   for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const a=key(i+j),b=key(i+(j+1)%3),k=a<b?`${a}|${b}`:`${b}|${a}`;edges.set(k,(edges.get(k)??0)+1);}
   expect([...edges.values()].every(n=>n===2)).toBe(true);g.dispose();
  }
 });
});
