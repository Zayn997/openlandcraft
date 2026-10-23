import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createCurvedWall,openingTop,updateCurvedWall,wallLength,wallPathPoint,type Opening,type Wall} from '@openlandcraft/core';
import {buildWallGeometry} from './architecture-geometry';
import {buildOpeningGeometry} from './wall-profile-geometry';

const gate:Opening={id:'gate',kind:'door',offset:3,width:2,height:3,sill:0,shape:'arch',archRise:1};
const window:Opening={id:'slit',kind:'window',offset:8,width:.8,height:1.5,sill:2};
function model(w:Wall){const g=buildWallGeometry(w,[w]),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld();return m;}
function across(m:THREE.Mesh,w:Wall,x:number,y:number){const a=wallPathPoint(w,x/wallLength(w),-2),b=wallPathPoint(w,x/wallLength(w),2),from=new THREE.Vector3(a[0],w.elevation+y,a[1]),to=new THREE.Vector3(b[0],w.elevation+y,b[1]);return new THREE.Raycaster(from,to.clone().sub(from).normalize(),0,from.distanceTo(to)).intersectObject(m).length;}
const dispose=(m:THREE.Mesh)=>{m.geometry.dispose();(m.material as THREE.Material).dispose();};

describe('real arched and rectangular aperture solids',()=>{
  it('cuts a doorway through both faces and leaves arch shoulders, crown and window sills solid',()=>{
    for(const clockwise of [false,true]){
      const w={...createCurvedWall('level','arc',[[0,0],[5,0],[0,5]],.6,6,clockwise,1),openings:[gate]},m=model(w);
      expect(across(m,w,4,.05)).toBe(0);expect(across(m,w,4,2.85)).toBe(0);expect(across(m,w,3.05,2.8)).toBeGreaterThan(0);expect(across(m,w,4,3.15)).toBeGreaterThan(0);expect(across(m,w,2.5,1)).toBeGreaterThan(0);dispose(m);
    }
    const w={...createCurvedWall('level','circle',[[0,0],[5,0]],.6,6,false,1),openings:[gate,window]},m=model(w);
    expect(across(m,w,8.4,2.5)).toBe(0);expect(across(m,w,8.4,1.8)).toBeGreaterThan(0);expect(across(m,w,8.4,3.7)).toBeGreaterThan(0);dispose(m);
  });
  it('uses the same arch on straight hosts, including real jambs, sill and soffit surfaces',()=>{
    const w:Wall={id:'straight',kind:'wall',name:'Gate',parentId:'level',visible:true,color:'#eeeeee',start:[0,0],end:[12,0],height:6,elevation:1,thickness:.8,openings:[gate,{...window,shape:'arch',archRise:.4}]},m=model(w);
    expect(across(m,w,4,2.8)).toBe(0);expect(across(m,w,3.05,2.8)).toBeGreaterThan(0);expect(across(m,w,8.4,3.45)).toBe(0);
    const vertical=new THREE.Raycaster(new THREE.Vector3(4,2,0),new THREE.Vector3(0,1,0),0,3).intersectObject(m);expect(vertical[0].point.y).toBeCloseTo(4);dispose(m);
  });
  it('retains an open hollow ring and equivalent apertures after radius changes',()=>{
    let w:Wall={...createCurvedWall('level','circle',[[0,0],[5,0]],.6,6,false,1),openings:[gate,window]};w=updateCurvedWall(w,{radius:7});const m=model(w),o=w.openings![0];
    expect(across(m,w,o.offset+o.width/2,1)).toBe(0);expect(new THREE.Raycaster(new THREE.Vector3(0,10,0),new THREE.Vector3(0,-1,0)).intersectObject(m)).toHaveLength(0);
    expect(Array.from(m.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);dispose(m);
  });
  it('shares aperture outlines with preview and selection volumes rather than filling arch shoulders',()=>{
    const w={...createCurvedWall('level','circle',[[0,0],[5,0]],.6,6,false,1),openings:[gate]},g=buildOpeningGeometry(w,gate),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld();
    expect(across(m,w,4,2.8)).toBeGreaterThan(0);expect(across(m,w,3.05,2.8)).toBe(0);expect(openingTop(gate,3)).toBe(2);dispose(m);
  });
  it('cuts an arched entrance across the circular seam without a false jamb or filled panel',()=>{
    const base=createCurvedWall('level','circle',[[0,0],[5,0]],.6,6,false,1),length=wallLength(base),w={...base,openings:[{...gate,offset:length-1}]},m=model(w);
    for(const x of [length-.5,length-.01,.01,.5])expect(across(m,w,x,.2)).toBe(0);
    expect(across(m,w,0,2.85)).toBe(0);expect(across(m,w,length-.95,2.8)).toBeGreaterThan(0);expect(across(m,w,0,3.2)).toBeGreaterThan(0);dispose(m);
  });
});
