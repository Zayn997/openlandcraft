import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createCurvedWall,curvePoint,updateCurvedWall} from '@openlandcraft/core';
import {buildWallGeometry} from './architecture-geometry';

describe('curved wall solids and picking',()=>{
  it.each(['circle','arc'] as const)('keeps the %s hollow and gives it real thickness and height',shape=>{
    const wall=createCurvedWall('level',shape,[[0,0],[5,0],[0,5]],.6,4),geometry=buildWallGeometry(wall,[]),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld();
    const down=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
    expect(down(0,0)).toHaveLength(0);expect(down(3.5,3.5).length).toBeGreaterThan(0);expect(down(7,0)).toHaveLength(0);
    expect(down(-5,0).length>0).toBe(shape==='circle');
    const fromCenter=new THREE.Raycaster(new THREE.Vector3(0,2,0),new THREE.Vector3(Math.SQRT1_2,0,Math.SQRT1_2)).intersectObject(mesh);
    expect(fromCenter.length).toBeGreaterThan(0);expect(fromCenter[0].distance).toBeCloseTo(4.7,2);
    geometry.computeBoundingBox();expect(geometry.boundingBox!.min.y).toBeCloseTo(.2);expect(geometry.boundingBox!.max.y).toBeCloseTo(4.2);
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);geometry.dispose();material.dispose();
  });
  it('supports clockwise arcs and their end caps without filling the missing sector',()=>{
    const arc=createCurvedWall('level','arc',[[2,3],[7,3],[2,-2]],.4,3,true),geometry=buildWallGeometry(arc,[]),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld();
    for(const t of [.1,.4,.9]){const [x,z]=curvePoint(arc.curve!,t);expect(new THREE.Raycaster(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh).length).toBeGreaterThan(0);}
    expect(new THREE.Raycaster(new THREE.Vector3(-3,10,3),new THREE.Vector3(0,-1,0)).intersectObject(mesh)).toHaveLength(0);
    geometry.dispose();material.dispose();
  });
  it('rebuilds edited dimensions without changing the authored shape or entity identity',()=>{
    const wall=createCurvedWall('level','circle',[[0,0],[4,0]],.4,3),before=structuredClone(wall),next={...updateCurvedWall(wall,{radius:8}),thickness:.8,height:6},geometry=buildWallGeometry(next,[]);
    geometry.computeBoundingBox();expect(geometry.boundingBox!.max.x).toBeCloseTo(8.4);expect(geometry.boundingBox!.max.y).toBeCloseTo(6.2);expect(next.id).toBe(wall.id);expect(wall).toEqual(before);geometry.dispose();
  });
});
