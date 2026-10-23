import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {applyCommand,connectStairFloor,createSite,createStairs,createSpiralStairs,detachStairEnd,footprint,parseProject,updateSpiralStairs,type Level,type Project,type Slab} from '@openlandcraft/core';
import {clipPathPolygon,polygonArea} from '@openlandcraft/landscape';
import {buildPartGeometry} from './architecture-geometry';
const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[0,0,0],rotation:0};
const floor=():Slab=>({id:'floor',kind:'slab',parentId:'level',name:'Upper floor',visible:true,color:'#aabbcc',center:[1,0],width:14,depth:10,elevation:7.7,thickness:.3});
const flight=()=>createStairs('level',[-6,0],[6,0],{width:1.5,rise:6,run:10,steps:30},2,false,'stairs');
const scene=(f:Slab,s:Slab)=>parseProject({...createSite({name:'Floor apertures',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,f,s]});
const getFloor=(p:Project)=>p.entities.find((e):e is Slab=>e.kind==='slab'&&!e.stairs)!,getStairs=(p:Project)=>p.entities.find((e):e is Slab=>e.kind==='slab'&&!!e.stairs)!;
const mesh=(p:Slab)=>{const m=new THREE.Mesh(buildPartGeometry(p,[]),new THREE.MeshBasicMaterial());m.updateMatrixWorld();return m;};
const ray=(m:THREE.Mesh,p:[number,number,number],d:[number,number,number],far=100)=>new THREE.Raycaster(new THREE.Vector3(...p),new THREE.Vector3(...d),0,far).intersectObject(m);
const dispose=(m:THREE.Mesh)=>{m.geometry.dispose();(m.material as THREE.Material).dispose();};
function linked(f=floor(),s=flight(),point:[number,number]=[6,0]){const p=scene(f,s);return applyCommand(p,{type:'replace',entity:connectStairFloor(p,s,f,'top',point)});}
const areaAt=(g:THREE.BufferGeometry,y:number)=>{const p=g.getAttribute('position');let area=0;for(let i=0;i<p.count;i+=3)if([0,1,2].every(j=>Math.abs(p.getY(i+j)-y)<1e-5))area+=polygonArea([0,1,2].map(j=>[p.getX(i+j),p.getZ(i+j)]));return area;};
describe('floor stair shaft solids',()=>{
 it('cuts the entire slab thickness, retains closed reveals, and gives the arrival a solid landing',()=>{
  const p=linked(),f=getFloor(p),s=getStairs(p),m=mesh(f),pad=mesh(s);expect(ray(m,[3,30,0],[0,-1,0])).toHaveLength(0);expect(ray(m,[3,0,0],[0,1,0])).toHaveLength(0);expect(ray(m,[6,30,0],[0,-1,0])[0].point.y).toBeCloseTo(8);expect(ray(m,[3,7.85,0],[0,0,1],2)[0]?.point.z).toBeCloseTo(.83,5);expect(ray(pad,[5.4,30,0],[0,-1,0])[0].point.y).toBeCloseTo(8);
  for(const name of ['position','normal','uv'])expect(Array.from(m.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);const clipped=clipPathPolygon(f.stairOpenings![0].points,footprint(f));expect(areaAt(m.geometry,8)).toBeCloseTo(f.width*f.depth-polygonArea(clipped),4);dispose(m);dispose(pad);
 });
 it('clears two metres above each upper tread, and regenerates the aperture after raising or thickening the floor',()=>{
  let p=linked(),s=getStairs(p),f=getFloor(p),m=mesh(f);for(let i=0;i<s.stairs!.steps;i++){const x=-6+s.depth*(i+.5)/s.stairs!.steps,tread=s.elevation+(i+1)*s.stairs!.rise/s.stairs!.steps;if(f.elevation-tread<2)expect(ray(m,[x,tread+.01,0],[0,1,0],2)).toHaveLength(0);}dispose(m);
  p=applyCommand(p,{type:'replace',entity:{...f,elevation:9.7,thickness:.5}});f=getFloor(p);m=mesh(f);expect(ray(m,[3,30,0],[0,-1,0])).toHaveLength(0);expect(ray(m,[6,30,0],[0,-1,0])[0].point.y).toBeCloseTo(10.2);const stairs=mesh(getStairs(p));expect(ray(stairs,[5.4,30,0],[0,-1,0])[0].point.y).toBeCloseTo(10.2);dispose(m);dispose(stairs);
 });
 it('clips shafts against custom concave outlines and edge arrivals without false caps or walls',()=>{
  const f={...floor(),outline:[[-5,-4],[7,-4],[7,4],[1,4],[1,2],[-5,2]] as [number,number][]},p=linked(f,flight(),[5,0]),host=getFloor(p),m=mesh(host),opening=host.stairOpenings![0].points;expect(ray(m,[3,30,0],[0,-1,0])).toHaveLength(0);expect(ray(m,[5,30,0],[0,-1,0])[0].point.y).toBeCloseTo(8);expect(areaAt(m.geometry,8)).toBeCloseTo(polygonArea(footprint(f))-polygonArea(clipPathPolygon(footprint(f),opening)),4);dispose(m);
  const edgeFloor={...floor(),center:[6,0] as [number,number],width:6},edge=linked(edgeFloor,flight(),[5,0]),solid=mesh(getFloor(edge));expect(ray(solid,[3.2,30,0],[0,-1,0])).toHaveLength(0);expect(ray(solid,[5,30,0],[0,-1,0])[0].point.y).toBeCloseTo(8);dispose(solid);
 });
 it('restores the uncut floor after detach, deletion or a cancelled opening preview',()=>{
  const p=linked(),s=getStairs(p),back=applyCommand(p,{type:'replace',entity:detachStairEnd(s,'top')}),m=mesh(getFloor(back));expect(ray(m,[3,30,0],[0,-1,0])[0].point.y).toBeCloseTo(8);dispose(m);const removed=applyCommand(p,{type:'remove',id:'stairs'}),floorMesh=mesh(getFloor(removed));expect(ray(floorMesh,[3,30,0],[0,-1,0])[0].point.y).toBeCloseTo(8);dispose(floorMesh);
 });
 it('cuts a circular shaft and joins a spiral landing in both windings, following editable radius and width',()=>{
  for(const clockwise of [false,true]){const f={...floor(),center:[0,0] as [number,number],width:14,depth:14},s=createSpiralStairs('level',[0,0],[3,0],{radius:3,width:1.3,rise:6,steps:40,turns:1,clockwise},2,false,'stairs');let p=linked(f,s,[3,0]);const initial=getFloor(p).stairOpenings;p=applyCommand(p,{type:'replace',entity:updateSpiralStairs(getStairs(p),{radius:3.5,width:1.5})});expect(getFloor(p).stairOpenings).not.toEqual(initial);const m=mesh(getFloor(p));for(const q of [[0,0],[3.4,0],[-3.4,0]] as [number,number][])expect(ray(m,[q[0],30,q[1]],[0,-1,0])).toHaveLength(0);expect(ray(m,[4,30,0],[0,-1,0])[0].point.y).toBeCloseTo(8);const t=getStairs(p),pad=t.stairs!.landings!.top!,a=t.stairs!.direction*Math.PI/180+(t.stairs!.spiral!.clockwise?-1:1)*t.stairs!.spiral!.turns*Math.PI*2,angle=a+(clockwise?-1:1)*.1,body=mesh(t);expect(ray(body,[3.6*Math.cos(angle),30,3.6*Math.sin(angle)],[0,-1,0])[0]?.point.y).toBeCloseTo(pad.elevation,5);dispose(m);dispose(body);}
 });
});
