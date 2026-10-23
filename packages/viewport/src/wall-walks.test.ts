import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {battlementLayout,createCurvedWall,defaultWallWalk,updateCurvedWall,wallPathPoint,wallWalkProfile,type Wall} from '@openlandcraft/core';
import {buildWallGeometry} from './architecture-geometry';

const tower=():Wall=>{const w=createCurvedWall('level','circle',[[0,0],[5,0]],.8,6,false,1,'tower');return {...w,walk:{...defaultWallWalk(w),parapetHeight:1},battlements:{width:1,height:1.2,spacing:1},openings:[{id:'gate',kind:'door',offset:3,width:2,height:3,sill:0,shape:'arch',archRise:1}]};};
const mesh=(w:Wall)=>{const m=new THREE.Mesh(buildWallGeometry(w,[w]),new THREE.MeshBasicMaterial());m.updateMatrixWorld();return m;};
const down=(m:THREE.Mesh,x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0)).intersectObject(m);
const dispose=(m:THREE.Mesh)=>{m.geometry.dispose();(m.material as THREE.Material).dispose();};

describe('wall-walk and parapet solids',()=>{
  it('builds inward annular decks, continuous thin parapets and aligned battlements in either ring direction',()=>{
    for(const sweepAngle of [360,-360]){
      const w=tower();w.curve!.sweepAngle=sweepAngle;const m=mesh(w),profile=wallWalkProfile(w),length=10*Math.PI;
      for(const angle of [0,.2,Math.PI,Math.PI*1.9])expect(down(m,4*Math.cos(angle),4*Math.sin(angle))[0].point.y).toBeCloseTo(6);
      expect(down(m,5.25,0)[0].point.y).toBeCloseTo(7);expect(down(m,0,0)).toHaveLength(0);expect(down(m,3,0)).toHaveLength(0);
      const [a,b]=battlementLayout(w).spans[0],center=(a+b)/2/length,p=wallPathPoint(w,center,profile.side*(profile.outer+profile.parapetInner)/2),behind=wallPathPoint(w,center,profile.side*.4);expect(down(m,...p)[0].point.y).toBeCloseTo(8.2);expect(down(m,...behind)[0].point.y).toBeCloseTo(6);
      const underneath=new THREE.Raycaster(new THREE.Vector3(4,0,0),new THREE.Vector3(0,1,0)).intersectObject(m);expect(underneath[0].point.y).toBeCloseTo(5.75);
      for(const name of ['position','normal','uv'])expect(Array.from(m.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);dispose(m);
    }
  });
  it('projects decks onto the chosen side of straight and diagonal hosts with clear surfaces behind the parapet',()=>{
    for(const end of [[10,0],[8,6]] as [number,number][])for(const side of ['left','right'] as const){
      const w:Wall={...tower(),curve:undefined,start:[0,0],end,walk:{...tower().walk!,side}},m=mesh(w),profile=wallWalkProfile(w),walk=wallPathPoint(w,.5,profile.side*1.2),outside=wallPathPoint(w,.5,-profile.side*.6),parapet=wallPathPoint(w,.2,profile.side*-.25);
      expect(down(m,...walk)[0].point.y).toBeCloseTo(6);expect(down(m,...outside)).toHaveLength(0);expect(down(m,...parapet)[0].point.y).toBeCloseTo(7);dispose(m);
    }
  });
  it('follows radius/center/height/base edits and keeps the walking surface at a fixed drop',()=>{
    const w=tower(),next={...updateCurvedWall(w,{radius:7,center:[2,-1]}),height:9,elevation:2},m=mesh(next);expect(down(m,8,-1)[0].point.y).toBeCloseTo(10);expect(down(m,2,-1)).toHaveLength(0);m.geometry.computeBoundingBox();expect(m.geometry.boundingBox!.max.y).toBeCloseTo(12.2);expect(m.geometry.boundingBox!.max.x).toBeCloseTo(9.4);dispose(m);
  });
  it('retains empty arched gates below the deck and restores the original wall when disabled',()=>{
    const w=tower(),m=mesh(w),o=w.openings![0],center=(o.offset+o.width/2)/(10*Math.PI),outside=wallPathPoint(w,center,-2),inside=wallPathPoint(w,center,2),direction=new THREE.Vector3(inside[0]-outside[0],0,inside[1]-outside[1]).normalize();expect(new THREE.Raycaster(new THREE.Vector3(outside[0],2,outside[1]),direction,0,4).intersectObject(m)).toHaveLength(0);dispose(m);
    const plain=mesh({...w,walk:undefined});expect(down(plain,4,0)).toHaveLength(0);expect(down(plain,4.8,0)[0].point.y).toBeCloseTo(7);dispose(plain);
  });
});
