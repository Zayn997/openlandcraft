/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {encodeGlb} from '@openlandcraft/core';
import {loadModel,disposeModel} from './models';
import {combineCharacterSkin} from './character-skin';

describe('character skin batching',()=>{
  it.each(['person-male','person-female'])('renders %s as one skin with its complete palette and triangles',async id=>{
    const bytes=readFileSync(new URL(`../../../apps/web/public/models/characters/${id}.glb`,import.meta.url)),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    const model=await loadModel({id,name:id,data:encodeGlb(bytes),attribution:''}),meshes:THREE.SkinnedMesh[]=[];
    model.traverse(object=>{if(object instanceof THREE.SkinnedMesh)meshes.push(object);});expect(meshes).toHaveLength(1);
    const mesh=meshes[0],material=mesh.material as THREE.MeshStandardMaterial,colors=mesh.geometry.getAttribute('color');
    expect(mesh.geometry.index!.count).toBe(doc.meshes.flatMap((m:{primitives:{indices:number}[]})=>m.primitives).reduce((sum:number,p:{indices:number})=>sum+doc.accessors[p.indices].count,0));
    expect(mesh.geometry.groups).toHaveLength(0);expect(material.vertexColors).toBe(true);expect(material.color.getHex()).toBe(0xffffff);
    const palette=new Set(Array.from({length:colors.count},(_,i)=>[colors.getX(i),colors.getY(i),colors.getZ(i)].map(v=>v.toFixed(4)).join(',')));
    expect(palette.size).toBe(doc.materials.length);expect(model.animations.map(clip=>clip.name)).toEqual(['Idle','Walk']);disposeModel(model);
  });
  it('preserves source meshes that cannot be batched safely',async()=>{
    const id='horse',bytes=readFileSync(new URL(`../../../apps/web/public/models/characters/${id}.glb`,import.meta.url)),model=await loadModel({id,name:id,data:encodeGlb(bytes),attribution:''}),meshes:THREE.SkinnedMesh[]=[];
    model.traverse(object=>{if(object instanceof THREE.SkinnedMesh)meshes.push(object);});expect(meshes).toHaveLength(2);
    expect(combineCharacterSkin(model)).toBe(false);expect(new Set(meshes.map(mesh=>(mesh.material as THREE.MeshStandardMaterial).color.getHex())).size).toBe(2);disposeModel(model);
  });
  it('leaves ordinary meshes and incompatible materials intact',()=>{
    const root=new THREE.Group(),a=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()),b=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());root.add(a,b);
    expect(combineCharacterSkin(root)).toBe(false);expect(root.children).toEqual([a,b]);disposeModel(root);
  });
});
