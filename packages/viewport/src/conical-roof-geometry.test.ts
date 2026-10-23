import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createConicalRoof,updateConicalRoof} from '@openlandcraft/core';
import {buildPartGeometry} from './architecture-geometry';

describe('conical roof solids',()=>{
  it('creates a finite closed cone with the right eaves radius, elevation and apex',()=>{
    const roof=createConicalRoof('level',[[2,-3],[6,-3]],5,.75,8,'roof'),geometry=buildPartGeometry(roof,[]);geometry.computeBoundingBox();const box=geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(-2.75);expect(box.max.x).toBeCloseTo(6.75);expect(box.min.z).toBeCloseTo(-7.75);expect(box.max.z).toBeCloseTo(1.75);expect(box.min.y).toBeCloseTo(8);expect(box.max.y).toBeCloseTo(13);
    for(const attribute of ['position','normal','uv'])expect(Array.from(geometry.getAttribute(attribute).array).every(Number.isFinite)).toBe(true);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();const down=new THREE.Raycaster(new THREE.Vector3(2,20,-3),new THREE.Vector3(0,-1,0)).intersectObject(mesh);expect(down[0].point.y).toBeCloseTo(13);
    const up=new THREE.Raycaster(new THREE.Vector3(2,0,-3),new THREE.Vector3(0,1,0)).intersectObject(mesh);expect(up[0].point.y).toBeCloseTo(8);geometry.dispose();
  });
  it('keeps each dimension independent when rebuilding the existing roof',()=>{
    const roof=createConicalRoof('level',[[0,0],[4,0]],5,.5,8,'roof');
    for(const [patch,radius,height] of [[{radius:6},6.5,5],[{rise:7},4.5,7],[{overhang:1.5},5.5,5]] as const){const next=updateConicalRoof(roof,patch),geometry=buildPartGeometry(next,[]);geometry.computeBoundingBox();expect(geometry.boundingBox!.max.x).toBeCloseTo(radius);expect(geometry.boundingBox!.max.y).toBeCloseTo(8+height);expect(next.id).toBe(roof.id);geometry.dispose();}
  });
  it('has a circular eaves boundary and a linear conical slope rather than a square pyramid',()=>{
    const roof=createConicalRoof('level',[[0,0],[4,0]],4,1,8,'roof'),geometry=buildPartGeometry(roof,[]),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
    for(const angle of [0,Math.PI/4,Math.PI/2]){const hits=new THREE.Raycaster(new THREE.Vector3(2.5*Math.cos(angle),20,2.5*Math.sin(angle)),new THREE.Vector3(0,-1,0)).intersectObject(mesh);expect(hits[0].point.y).toBeCloseTo(10,2);}
    expect(new THREE.Raycaster(new THREE.Vector3(4.5,20,4.5),new THREE.Vector3(0,-1,0)).intersectObject(mesh)).toHaveLength(0);geometry.dispose();
  });
});
