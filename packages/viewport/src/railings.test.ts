import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createStairs,defaultWallWalk,railingRuns,updateCurvedWall,updateStairs,type Slab,type Wall} from '@openlandcraft/core';
import {buildPartGeometry} from './architecture-geometry';
import {buildRailingGeometry} from './railing-geometry';

const flight=():Slab=>{const s=createStairs('level',[0,0],[1,0],{width:2,rise:3,run:6,steps:12},1,false,'stairs');return {...s,stairs:{...s.stairs!,railings:{height:1.2,spacing:1.5,side:'both' as const}}};};
const wall=():Wall=>{const w:Wall={id:'wall',kind:'wall',parentId:'level',name:'Wall',visible:true,color:'#998877',start:[0,0],end:[12,0],height:6,thickness:.5,elevation:1};return {...w,walk:{...defaultWallWalk(w),railings:{height:1.2,spacing:1.5}}};};
const mesh=(geometry:THREE.BufferGeometry)=>{const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());m.updateMatrixWorld();return m;};
const cast=(m:THREE.Mesh,p:THREE.Vector3,d:THREE.Vector3)=>new THREE.Raycaster(p,d).intersectObject(m);
const dispose=(m:THREE.Mesh)=>{m.geometry.dispose();(m.material as THREE.Material).dispose();};

describe('railing solids and host picking',()=>{
  it('combines railings with the editable stair mesh without changing treads or leaving obsolete geometry',()=>{
    const s=flight(),m=mesh(buildPartGeometry(s,[]));for(let i=0;i<12;i++)expect(cast(m,new THREE.Vector3((i+.5)*.5,30,0),new THREE.Vector3(0,-1,0))[0].point.y).toBeCloseTo(1+(i+1)*.25);
    expect(cast(m,new THREE.Vector3(.02,1.8,-3),new THREE.Vector3(0,0,1)).length).toBeGreaterThan(0);m.geometry.computeBoundingBox();expect(m.geometry.boundingBox!.max.y).toBeCloseTo(5.2);dispose(m);
    const moved=updateStairs(s,{start:[10,10],width:3,run:8,rise:4,steps:20,direction:90}),next=mesh(buildPartGeometry(moved,[]));expect(cast(next,new THREE.Vector3(.02,1.8,-3),new THREE.Vector3(0,0,1))).toHaveLength(0);expect(next.geometry.boundingBox!.max.y).toBeCloseTo(6.2);dispose(next);
  });
  it('renders closed finite rails with normals/UVs and keeps each post supported after rotating and resizing',()=>{
    const s=updateStairs(flight(),{width:2.5,run:9,rise:5,steps:30,direction:38}),g=buildPartGeometry(s,[]);
    for(const name of ['position','normal','uv'])expect(Array.from(g.getAttribute(name).array).every(Number.isFinite)).toBe(true);expect(g.index).toBeNull();g.dispose();
    const only=mesh(buildRailingGeometry(s));for(const run of railingRuns(s))for(const post of run.posts){const p=new THREE.Vector3(...post.top);p.y+=1;const hit=cast(only,p,new THREE.Vector3(0,-1,0))[0].point.y;expect(hit).toBeGreaterThanOrEqual(post.top[1]-1e-5);expect(hit).toBeLessThan(post.top[1]+.005);}dispose(only);
  });
  it('follows both clockwise and counterclockwise curved walk edges at the deck elevation',()=>{
    for(const sweepAngle of [360,-360,150,-150]){const w=updateCurvedWall({...wall(),curve:{center:[3,-2],radius:8,startAngle:25,sweepAngle}},{radius:8}),m=mesh(buildPartGeometry(w,[w]));
      for(const run of railingRuns(w))for(const p of run.posts){const from=new THREE.Vector3(...p.top);from.y+=1;expect(cast(m,from,new THREE.Vector3(0,-1,0))[0].point.y).toBeCloseTo(p.top[1],4);}dispose(m);}
  });
  it('leaves a real opening in rails and removes all rail geometry when disabled',()=>{
    const w=wall();w.walk!.railings!.gap={position:.5,width:2};const m=mesh(buildRailingGeometry(w));expect(cast(m,new THREE.Vector3(6,6.8,0),new THREE.Vector3(0,0,1))).toHaveLength(0);expect(cast(m,new THREE.Vector3(3,6.5,0),new THREE.Vector3(0,0,1)).length).toBeGreaterThan(0);dispose(m);
    const s=flight(),withRails=buildPartGeometry(s,[]);delete s.stairs!.railings;const plain=buildPartGeometry(s,[]);expect(withRails.getAttribute('position').count).toBeGreaterThan(plain.getAttribute('position').count);plain.computeBoundingBox();expect(plain.boundingBox!.max.y).toBe(4);withRails.dispose();plain.dispose();
  });
});
