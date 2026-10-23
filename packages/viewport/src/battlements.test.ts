import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {battlementLayout,createCurvedWall,updateCurvedWall,wallPathPoint,type Wall} from '@openlandcraft/core';
import {buildWallGeometry} from './architecture-geometry';

const circle=():Wall=>({...createCurvedWall('level','circle',[[0,0],[5,0]],.6,6,false,1,'tower'),battlements:{width:1,height:1.2,spacing:1},openings:[{id:'gate',kind:'door',offset:3,width:2,height:3,sill:0,shape:'arch',archRise:1}]});
const mesh=(w:Wall)=>{const m=new THREE.Mesh(buildWallGeometry(w,[w]),new THREE.MeshBasicMaterial());m.updateMatrixWorld();return m;};
const hits=(m:THREE.Mesh,x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0)).intersectObject(m);
const dispose=(m:THREE.Mesh)=>{m.geometry.dispose();(m.material as THREE.Material).dispose();};

describe('battlement solids and picking',()=>{
  it('renders separate curved blocks and clear gaps across the seam, with finite attributes and a hollow tower',()=>{
    for(const sweepAngle of [360,-360]){
      const w=circle();w.curve!.sweepAngle=sweepAngle;const m=mesh(w),length=2*Math.PI*5;
      for(const [a,b] of battlementLayout(w).spans){const p=wallPathPoint(w,(a+b)/2/length);expect(hits(m,...p)[0].point.y).toBeCloseTo(8.2,4);}
      for(const distance of [0,battlementLayout(w).spans[0][1]+.2]){const p=wallPathPoint(w,distance/length);expect(hits(m,...p)[0].point.y).toBeCloseTo(7);}
      expect(hits(m,0,0)).toHaveLength(0);
      for(const name of ['position','normal','uv'])expect(Array.from(m.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
      dispose(m);
    }
  });
  it('keeps straight and diagonal blocks flush to the wall thickness and existing opening cuts empty',()=>{
    for(const diagonal of [false,true]){
      const w:Wall={id:'straight',kind:'wall',parentId:'level',name:'Wall',visible:true,color:'#eee',start:[0,0],end:diagonal?[8,6]:[10,0],height:5,thickness:.8,elevation:1,battlements:{width:1,height:1,spacing:1},openings:[{id:'window',kind:'window',offset:2,width:1,height:1,sill:1}]},m=mesh(w);
      const block=wallPathPoint(w,.1);expect(hits(m,...block)[0].point.y).toBeCloseTo(7);const gap=wallPathPoint(w,.2);expect(hits(m,...gap)[0].point.y).toBeCloseTo(6);
      const outside=wallPathPoint(w,.1,.41);expect(hits(m,...outside)).toHaveLength(0);
      const p=wallPathPoint(w,.25,2),toward=wallPathPoint(w,.25,-2);expect(new THREE.Raycaster(new THREE.Vector3(p[0],2.5,p[1]),new THREE.Vector3(toward[0]-p[0],0,toward[1]-p[1]).normalize()).intersectObject(m)).toHaveLength(0);
      dispose(m);
    }
  });
  it('updates radius, block top and thickness with the host while retaining arched apertures',()=>{
    const w=circle(),next={...updateCurvedWall(w,{radius:7,center:[2,-1]}),height:8,thickness:1,elevation:2},m=mesh(next);m.geometry.computeBoundingBox();expect(m.geometry.boundingBox!.max.y).toBeCloseTo(11.2);expect(m.geometry.boundingBox!.min.y).toBeCloseTo(2);
    const [a,b]=battlementLayout(next).spans[0],p=wallPathPoint(next,(a+b)/2/(14*Math.PI));expect(hits(m,...p)[0].point.y).toBeCloseTo(11.2);expect(hits(m,2,-1)).toHaveLength(0);dispose(m);
  });
});
