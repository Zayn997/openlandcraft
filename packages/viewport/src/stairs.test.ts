import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createStairs,updateStairs,type Slab} from '@openlandcraft/core';
import {buildPartGeometry} from './architecture-geometry';

const stairs=()=>createStairs('level',[0,0],[1,0],{width:2,rise:3,run:6,steps:12},1,false,'stairs');
const mesh=(s:Slab)=>{const m=new THREE.Mesh(buildPartGeometry(s,[]),new THREE.MeshBasicMaterial());m.updateMatrixWorld();return m;};
const down=(m:THREE.Mesh,x:number,z=0)=>new THREE.Raycaster(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0)).intersectObject(m);
const dispose=(m:THREE.Mesh)=>{m.geometry.dispose();(m.material as THREE.Material).dispose();};

describe('straight stair solids',()=>{
  it('renders exactly the chosen number of horizontal treads at the right heights',()=>{
    const s=stairs(),m=mesh(s);for(let i=0;i<12;i++){expect(down(m,(i+.5)*.5)[0].point.y).toBeCloseTo(1+(i+1)*.25);expect(down(m,(i+.1)*.5)[0].point.y).toBeCloseTo(down(m,(i+.9)*.5)[0].point.y);}expect(down(m,3,1.1)).toHaveLength(0);dispose(m);
  });
  it('is a closed finite flight with a sloped underside and valid riser/underside picking',()=>{
    const m=mesh(stairs());for(const attribute of ['position','normal','uv'])expect(Array.from(m.geometry.getAttribute(attribute).array).every(Number.isFinite)).toBe(true);m.geometry.computeBoundingBox();expect(m.geometry.boundingBox!.min.y).toBeCloseTo(.8);expect(m.geometry.boundingBox!.max.y).toBeCloseTo(4);
    const up=new THREE.Raycaster(new THREE.Vector3(3,-10,0),new THREE.Vector3(0,1,0)).intersectObject(m);expect(up[0].point.y).toBeCloseTo(2.3);
    const riser=new THREE.Raycaster(new THREE.Vector3(-1,1.1,0),new THREE.Vector3(1,0,0)).intersectObject(m);expect(riser[0].point.x).toBeCloseTo(0);dispose(m);
  });
  it('regenerates independent rise/run/width/count and direction without leaving obsolete treads',()=>{
    const s=updateStairs(stairs(),{rise:4,run:8,width:3,steps:20,direction:90,start:[2,-3]}),m=mesh(s);for(let i=0;i<20;i++)expect(down(m,2,-3+(i+.5)*.4)[0].point.y).toBeCloseTo(1+(i+1)*.2);expect(down(m,4,0)).toHaveLength(0);m.geometry.computeBoundingBox();expect(m.geometry.boundingBox!.min.x).toBeCloseTo(.5);expect(m.geometry.boundingBox!.max.z).toBeCloseTo(5);dispose(m);
  });
});
