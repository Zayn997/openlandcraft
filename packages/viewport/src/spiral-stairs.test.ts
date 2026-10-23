import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createSpiralStairs,railingRuns,spiralPoint,updateSpiralStairs,type Slab} from '@openlandcraft/core';
import {buildPartGeometry} from './architecture-geometry';
import {buildRailingGeometry} from './railing-geometry';

const flight=(clockwise=false)=>createSpiralStairs('level',[2,-3],[3,-3],{radius:3,width:1.3,rise:6,steps:32,turns:1.5,clockwise},1,false,'stairs');
const mesh=(g:THREE.BufferGeometry)=>{const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());m.updateMatrixWorld();return m;};
const down=(m:THREE.Mesh,x:number,z:number,y=40)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,-1,0)).intersectObject(m);
const dispose=(m:THREE.Mesh)=>{m.geometry.dispose();(m.material as THREE.Material).dispose();};

describe('spiral stair solids and railings',()=>{
  it('renders every horizontal tread in either winding with an empty central well and sloped underside',()=>{
    for(const clockwise of [false,true]){const s=flight(clockwise),m=mesh(buildPartGeometry(s,[])),n=s.stairs!.steps,dy=s.stairs!.rise/n;
      for(let i=0;i<n;i++){const p=spiralPoint(s,(i+.5)/n),y=1+(i+1)*dy;expect(down(m,p[0],p[1],y+.02)[0].point.y).toBeCloseTo(y,4);const up=new THREE.Raycaster(new THREE.Vector3(p[0],1+(i+.5)*dy-s.thickness-.02,p[1]),new THREE.Vector3(0,1,0)).intersectObject(m);expect(up[0].point.y).toBeCloseTo(1+(i+.5)*dy-s.thickness,3);}
      expect(down(m,2,-3)).toHaveLength(0);expect(down(m,5.1,-3)).toHaveLength(0);dispose(m);
    }
  });
  it('builds finite closed geometry with outward normals and editable bounds',()=>{
    const m=mesh(buildPartGeometry(flight(),[]));for(const name of ['position','normal','uv'])expect(Array.from(m.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);expect(m.geometry.boundingBox!.min.y).toBeCloseTo(.8);expect(m.geometry.boundingBox!.max.y).toBeCloseTo(7);
    const hits=new THREE.Raycaster(new THREE.Vector3(10,1.1,-2.9),new THREE.Vector3(-1,0,0)).intersectObject(m);expect(hits.length).toBeGreaterThan(0);dispose(m);
    const s=updateSpiralStairs(flight(),{center:[10,10],radius:4,width:1.7,rise:7,steps:40,turns:2,direction:25}),next=mesh(buildPartGeometry(s,[]));expect(down(next,2,-3)).toHaveLength(0);expect(next.geometry.boundingBox!.max.y).toBeCloseTo(8);dispose(next);
  });
  it('regenerates tread-supported inner and outer railings after radius, width, height and count edits',()=>{
    const s:Slab=flight();s.stairs!.railings={height:1.1,spacing:1.2,side:'both'};const changed=updateSpiralStairs(s,{radius:4,width:1.8,rise:7,steps:40,turns:2,clockwise:true}),rails=mesh(buildRailingGeometry(changed));
    for(const run of railingRuns(changed))for(const p of run.posts){const hits=down(rails,p.top[0],p.top[2],p.top[1]+.1);expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeGreaterThanOrEqual(p.top[1]-.001);expect(hits[0].point.y).toBeLessThan(p.top[1]+.02);}
    const full=mesh(buildPartGeometry(changed,[]));expect(full.geometry.boundingBox!.max.y).toBeCloseTo(9.1);expect(down(full,2,-3)).toHaveLength(0);dispose(full);dispose(rails);
  });
});
