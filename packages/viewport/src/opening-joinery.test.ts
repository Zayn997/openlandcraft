import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createCurvedWall,defaultOpeningJoinery,openingTop,updateCurvedWall,wallLength,wallPathPoint,type Opening,type Wall} from '@openlandcraft/core';
import {buildOpeningComponentGeometry,openingInnerProfile,type OpeningComponent} from './opening-joinery';
const gate:Opening={id:'gate',kind:'door',offset:2,width:2,height:3,sill:0,shape:'arch',archRise:1,joinery:defaultOpeningJoinery('door')};
const ring=(clockwise=false)=>{const w=createCurvedWall('level','circle',[[0,0],[6,0]],.6,7,false,1,'wall');return clockwise?updateCurvedWall(w,{sweepAngle:-360}):w;};
const ray=(w:Wall,g:THREE.BufferGeometry,x:number,y:number)=>{const q=wallPathPoint(w,x/wallLength(w)),side=wallPathPoint(w,x/wallLength(w),1),normal=new THREE.Vector3(side[0]-q[0],0,side[1]-q[1]).normalize(),start=new THREE.Vector3(q[0],w.elevation+y,q[1]).addScaledVector(normal,2),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());return new THREE.Raycaster(start,normal.negate(),0,4).intersectObject(mesh);};
describe('profile-based hosted opening solids',()=>{
 it('builds open door frames and closed panels with real arch contours on straight and both curved windings',()=>{
  const straight:Wall={id:'wall',kind:'wall',parentId:'level',name:'Wall',visible:true,color:'#ffffff',start:[0,0],end:[10,0],thickness:.25,height:7,elevation:1};
  for(const w of [straight,ring(false),ring(true)])for(const shape of ['rectangle','arch'] as const){const o={...gate,shape},frame=buildOpeningComponentGeometry(w,o,'frame'),panel=buildOpeningComponentGeometry(w,o,'panel'),mid=o.offset+o.width/2;
   expect(ray(w,frame,mid,1)).toHaveLength(0);expect(ray(w,frame,mid,o.height-.04).length).toBeGreaterThan(0);expect(ray(w,frame,o.offset+.03,.8).length).toBeGreaterThan(0);expect(ray(w,frame,mid,.01)).toHaveLength(0);expect(ray(w,panel,mid,1).length).toBeGreaterThan(0);
   if(shape==='arch')expect(ray(w,panel,o.offset+.12,o.height-.1)).toHaveLength(0);
   for(const g of [frame,panel]){expect([...g.getAttribute('position').array,...g.getAttribute('normal').array].every(Number.isFinite)).toBe(true);expect(g.boundingBox!.min.y).toBeGreaterThanOrEqual(w.elevation-1e-5);g.dispose();}
  }
 });
 it('keeps window sills framed, glass inset, and a circular seam as one continuous hosted object',()=>{
  for(const clockwise of [false,true]){const w=ring(clockwise),o:Opening={...gate,kind:'window',offset:wallLength(w)-1,sill:2,joinery:defaultOpeningJoinery('window')},mid=o.offset+1,frame=buildOpeningComponentGeometry(w,o,'frame'),glass=buildOpeningComponentGeometry(w,o,'glass');expect(ray(w,frame,mid,2.03).length).toBeGreaterThan(0);expect(ray(w,frame,mid,3)).toHaveLength(0);expect(ray(w,glass,mid,3).length).toBeGreaterThan(0);expect(ray(w,glass,o.offset+.02,3)).toHaveLength(0);expect(ray(w,glass,mid,openingTop(o,mid)+.05)).toHaveLength(0);frame.dispose();glass.dispose();}
 });
 it('rebuilds radius-aware vertices and profiles after edits, caps depth at wall thickness and removes disabled components',()=>{
  const w=ring(),o=gate,next=updateCurvedWall({...w,openings:[o],thickness:.05},{radius:9,center:[2,3]}),hosted=next.openings![0];expect(openingInnerProfile(hosted).width).toBeCloseTo(1.84);
  for(const component of ['frame','panel'] as OpeningComponent[]){const g=buildOpeningComponentGeometry(next,hosted,component),p=g.getAttribute('position');for(let i=0;i<p.count;i++)expect(Math.abs(Math.hypot(p.getX(i)-2,p.getZ(i)-3)-9)).toBeLessThanOrEqual(.02501);expect(ray(next,g,hosted.offset+(component==='frame'?.03:1),1).length).toBeGreaterThan(0);g.dispose();}
  expect(buildOpeningComponentGeometry(w,{...gate,joinery:undefined},'frame').getAttribute('position').count).toBe(0);
 });
});
