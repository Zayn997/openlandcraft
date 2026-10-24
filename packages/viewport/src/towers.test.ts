import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {applyCommand,connectStairFloor,createSite,createSpiralStairs,DEFAULT_TOWER,dragOutline,newTower,type Project,type Slab,type Wall} from '@openlandcraft/core';
import {buildPartGeometry} from './architecture-geometry';
const scene=()=>{const p=createSite({name:'Tower solids',width:100,depth:100,resolution:129,preset:'flat'});return applyCommand(p,{type:'batch',commands:[{type:'towerType',definition:{...DEFAULT_TOWER,id:'round',name:'Round tower'}},{type:'tower',...newTower('round',[0,2.2,0],'tower')}]});};
const floor=(p:Project)=>p.entities.find(e=>e.id==='tower-floor1') as Slab;
const hits=(g:THREE.BufferGeometry,x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,50,z),new THREE.Vector3(0,-1,0),0,100).intersectObject(new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})));
describe('tower floors reuse native geometry and stair connections',()=>{
 it('renders a closed circular floor rather than a square, with valid normals and editable radius/center grips',()=>{
  const p=scene(),f=floor(p),g=buildPartGeometry(f,[]);expect(hits(g,0,0)[0].point.y).toBeCloseTo(4);expect(hits(g,5.5,0).length).toBeGreaterThan(0);expect(hits(g,5,5)).toHaveLength(0);expect([...g.getAttribute('position').array,...g.getAttribute('normal').array].every(Number.isFinite)).toBe(true);g.dispose();
  const resized=dragOutline(f,'radius',0,[1,0],false) as Slab;expect(resized.disk!.radius).toBeCloseTo(6.71);const moved=dragOutline(resized,'move',0,[2,3],false);expect(moved.center).toEqual([2,3]);expect(()=>dragOutline(f,'vertex',0,[1,0],false)).toThrow('Center or Radius');
 });
 it('cuts a real spiral shaft and follows tower floor elevation changes while retaining separate editable stairs',()=>{
  let p=scene();const stairs=createSpiralStairs('tower-level',[0,0],[3,0],{radius:3,width:1,rise:4,steps:24,turns:1,clockwise:false},0,false,'stairs');p=applyCommand(p,{type:'add',entity:stairs});p=applyCommand(p,{type:'replace',entity:connectStairFloor(p,stairs,floor(p),'top')});expect(floor(p).stairOpenings).toHaveLength(1);
  let g=buildPartGeometry(floor(p),[]);expect(hits(g,0,0)).toHaveLength(0);expect(hits(g,4,0).length).toBeGreaterThan(0);g.dispose();
  p=applyCommand(p,{type:'towerType',definition:{...DEFAULT_TOWER,id:'round',name:'Round tower',height:15,radius:8}});const s=p.entities.find(e=>e.id==='stairs') as Slab;expect(s.stairs!.rise).toBeCloseTo(5);expect(s.stairs!.connections!.top!.floorId).toBe('tower-floor1');expect(floor(p).disk!.radius).toBeCloseTo(7.71);g=buildPartGeometry(floor(p),[]);expect(hits(g,0,0)).toHaveLength(0);g.dispose();
 });
});
