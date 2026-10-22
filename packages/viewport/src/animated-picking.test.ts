/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {encodeGlb} from '@openlandcraft/core';
import {loadModel,disposeModel} from './models';
import {createAnimatedRaycast} from './animated-picking';

const asset=(id:string)=>({id,name:id,data:encodeGlb(readFileSync(new URL(`../../../apps/web/public/models/characters/${id}.glb`,import.meta.url))),attribution:''});
const skinned=(root:THREE.Object3D)=>{const meshes:THREE.SkinnedMesh[]=[];root.traverse(object=>{if(object instanceof THREE.SkinnedMesh)meshes.push(object);});return meshes;};

describe('animated model picking',()=>{
  it('rejects a ray far from two characters without deforming any vertices',async()=>{
    const source=await loadModel(asset('person-male')),copies=[clone(source),clone(source)];copies[1].position.x=5;
    const ray=new THREE.Raycaster(new THREE.Vector3(50,10,50),new THREE.Vector3(0,-1,0));
    for(const copy of copies){copy.updateMatrixWorld(true);for(const mesh of skinned(copy)){
      mesh.raycast=createAnimatedRaycast(mesh);const vertices=vi.spyOn(mesh,'getVertexPosition');
      const hits:THREE.Intersection[]=[];for(let i=0;i<10;i++)mesh.raycast(ray,hits);
      expect(hits).toHaveLength(0);expect(vertices).not.toHaveBeenCalled();vertices.mockRestore();mesh.skeleton.dispose();
    }}disposeModel(source);
  });
  it.each(['person-male','person-female','horse'])('contains every animated vertex and preserves precise hits for %s',async id=>{
    const source=await loadModel(asset(id)),copy=clone(source),meshes=skinned(copy),mixer=new THREE.AnimationMixer(copy);
    copy.position.set(3,2,-4);copy.rotation.y=.7;copy.scale.set(1.3,.8,1.6);
    const exact=meshes.map(mesh=>mesh.raycast),fast=meshes.map(createAnimatedRaycast),point=new THREE.Vector3();let hitCount=0;
    for(const clip of source.animations){mixer.stopAllAction();mixer.clipAction(clip).play();for(const fraction of [0,.23,.67,.95]){
      mixer.setTime(clip.duration*fraction);copy.updateMatrixWorld(true);
      for(const [i,mesh]of meshes.entries()){
        mesh.skeleton.update();const miss=new THREE.Raycaster(new THREE.Vector3(100,100,100),new THREE.Vector3(1,0,0));fast[i].call(mesh,miss,[]);
        for(let vertex=0;vertex<mesh.geometry.getAttribute('position').count;vertex++){mesh.getVertexPosition(vertex,point);expect(mesh.boundingBox!.containsPoint(point)).toBe(true);}
        const center=mesh.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,0,10)),new THREE.Vector3(0,0,-1));
        const a:THREE.Intersection[]=[],b:THREE.Intersection[]=[];fast[i].call(mesh,ray,a);mesh.computeBoundingSphere();mesh.computeBoundingBox();exact[i].call(mesh,ray,b);
        expect(a.map(hit=>hit.distance)).toEqual(b.map(hit=>hit.distance));hitCount+=b.length;
      }
    }}expect(hitCount).toBeGreaterThan(0);mixer.stopAllAction();mixer.uncacheRoot(copy);meshes.forEach(mesh=>mesh.skeleton.dispose());disposeModel(source);
  },30000);
});
