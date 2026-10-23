import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {applyCommand,connectStairBottom,connectStairTop,createSite,createStairs,defaultWallWalk,detachStairEnd,parseProject,railingRuns,spiralStairsForTower,updateCurvedWall,wallPathPoint,wallWalkProfile,type Level,type Project,type Slab,type Wall} from '@openlandcraft/core';
import {intersectTerrain} from './terrain-picking';
import {buildPartGeometry} from './architecture-geometry';
import {buildRailingGeometry} from './railing-geometry';
const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',visible:true,position:[0,0,0],rotation:0};
const wall=():Wall=>{const w:Wall={id:'wall',kind:'wall',parentId:'level',name:'Curtain',visible:true,color:'#998877',start:[-10,0],end:[10,0],height:8,thickness:.6,elevation:0};return {...w,walk:{...defaultWallWalk(w),railings:{height:1.1,spacing:1}},battlements:{width:1,height:1,spacing:1}};};
const mesh=(g:THREE.BufferGeometry)=>{const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());m.updateMatrixWorld();return m;};
const down=(m:THREE.Mesh,x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0)).intersectObject(m);
const dispose=(m:THREE.Mesh)=>{m.geometry.dispose();(m.material as THREE.Material).dispose();};
function connected(w:Wall,spiral=false,edge:'inner'|'outer'='outer',clockwise=false,position=.5){
 const f=spiral?spiralStairsForTower(w,{width:1.3,rise:5,steps:40,radius:3,turns:1,clockwise},0,'stairs'):createStairs('level',edge==='outer'?[0,-14]:[0,14],edge==='outer'?[0,0]:[0,0],{width:2,rise:6,run:12,steps:32},0,false,'stairs');f.stairs!.railings={height:1.1,spacing:1,side:'both'};
 let p=parseProject({...createSite({name:'Landings',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,w,f]});
 const profile=wallWalkProfile(w),q=wallPathPoint(w,position,profile.side*(edge==='inner'?profile.inner:profile.outer));p=applyCommand(p,{type:'replace',entity:connectStairTop(p,f,w,q)});const s=p.entities.find((e):e is Slab=>e.kind==='slab')!;return applyCommand(p,{type:'replace',entity:connectStairBottom(p,s)});
}
const stair=(p:Project)=>p.entities.find((e):e is Slab=>e.kind==='slab')!,host=(p:Project)=>p.entities.find((e):e is Wall=>e.kind==='wall')!;
describe('attached stair landing and access geometry',()=>{
 it('renders solid level landings at both ends of a straight flight and keeps every cached vertex finite',()=>{
  const p=connected(wall()),s=stair(p),m=mesh(buildPartGeometry(s,[]));
  for(const pad of Object.values(s.stairs!.landings!)){const q=pad.points.reduce((a,b)=>[a[0]+b[0]/pad.points.length,a[1]+b[1]/pad.points.length],[0,0]);expect(down(m,...q as [number,number])[0]?.point.y).toBeCloseTo(pad.elevation,5);const underside=new THREE.Raycaster(new THREE.Vector3(q[0],pad.base-1,q[1]),new THREE.Vector3(0,1,0),0,2).intersectObject(m);expect(underside[0]?.point.y).toBeCloseTo(pad.base,5);}
  for(const name of ['position','normal','uv'])expect(Array.from(m.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);dispose(m);
 });
 it('supports a landing above steep clipped terrain peaks and follows subsequent sculpting',()=>{
  const f=createStairs('level',[.17,-.03],[1,-.03],{width:2,rise:6,run:6,steps:32},0,false,'stairs'),site=createSite({name:'Rough ground',width:80,depth:80,resolution:129,preset:'flat'}),field={...site.site.terrain,heights:site.site.terrain.heights.map(()=>2)};field.heights[64*129+65]=10;
  let p=parseProject({...site,site:{...site.site,terrain:field},entities:[level,f]});p=applyCommand(p,{type:'replace',entity:connectStairBottom(p,f)});const pad=stair(p).stairs!.landings!.bottom!,terrainHit=intersectTerrain(new THREE.Ray(new THREE.Vector3(.17,30,0),new THREE.Vector3(0,-1,0)),p.site)!;expect(pad.elevation).toBeCloseTo(terrainHit.point.y+.08,7);
  const m=mesh(buildPartGeometry(stair(p),[]));expect(down(m,-.2,-.03)[0].point.y).toBeCloseTo(pad.elevation,5);expect(pad.base).toBeCloseTo(1.92);dispose(m);
  const changed={...field,heights:[...field.heights]};changed.heights[64*129+65]=12;p=applyCommand(p,{type:'terrain',field:changed});expect(stair(p).stairs!.landings!.bottom!.elevation).toBeCloseTo(pad.elevation+.544,7);
 });
 it('cuts the real parapet and any battlements at an outer arrival, restoring them on detach',()=>{
  const p=connected(wall()),w=host(p),profile=wallWalkProfile(w),q=wallPathPoint(w,.5,profile.side*(profile.outer+profile.parapetInner)/2),m=mesh(buildPartGeometry(w,[w]));expect(down(m,...q)[0]?.point.y).toBeCloseTo(profile.deckTop);expect(down(m,4,q[1])[0]?.point.y).toBeGreaterThan(profile.deckTop+.5);dispose(m);
  const detached=applyCommand(p,{type:'replace',entity:detachStairEnd(stair(p),'top')}),back=host(detached),solid=mesh(buildPartGeometry(back,[back]));expect(down(solid,...q)[0]?.point.y).toBeGreaterThan(profile.deckTop+.5);dispose(solid);
 });
 it('opens the inner railing across a straight arrival while leaving the walk deck continuous',()=>{
  const p=connected(wall(),false,'inner'),w=host(p),profile=wallWalkProfile(w),rails=mesh(buildRailingGeometry(w)),at=wallPathPoint(w,.5,profile.side*(profile.inner-.02));expect(down(rails,...at)).toHaveLength(0);const away=wallPathPoint(w,.25,profile.side*(profile.inner-.02));expect(down(rails,...away).length).toBeGreaterThan(0);dispose(rails);
  const body=mesh(buildPartGeometry(w,[w])),walk=wallPathPoint(w,.5,profile.side*(profile.inner-.3));expect(down(body,...walk)[0].point.y).toBeCloseTo(profile.deckTop);dispose(body);
 });
 it('opens curved parapets and battlements across a circular seam and along an arc',()=>{
  for(const sweepAngle of [360,180,-180]){const w=updateCurvedWall({...wall(),curve:{center:[0,0],radius:7,startAngle:sweepAngle===360?0:-sweepAngle/2,sweepAngle}},{radius:7}),f=createStairs('level',[20,0],[7,0],{width:2,rise:6,run:12,steps:32},2,false,'stairs');let p=parseProject({...createSite({name:'Curved arrivals',width:80,depth:80,resolution:129,preset:'flat'}),entities:[level,w,f]});const at=sweepAngle===360?0:.5,profile=wallWalkProfile(w),q=wallPathPoint(w,at,profile.side*profile.outer);p=applyCommand(p,{type:'replace',entity:connectStairTop(p,f,w,q)});const h=host(p),m=mesh(buildPartGeometry(h,[h])),parapet=wallPathPoint(h,at,profile.side*(profile.outer+profile.parapetInner)/2);expect(down(m,...parapet)[0]?.point.y).toBeCloseTo(profile.deckTop);const beside=wallPathPoint(h,at+.06,profile.side*(profile.outer+profile.parapetInner)/2);expect(down(m,...beside)[0]?.point.y).toBeGreaterThan(profile.deckTop+.5);dispose(m);}
 });
 it('keeps circular rail openings clear across the seam in both stair windings',()=>{
  for(const clockwise of [false,true]){const w=updateCurvedWall({...wall(),curve:{center:[0,0],radius:7,startAngle:0,sweepAngle:360}},{radius:7}),p=connected(w,true,'inner',clockwise,0),h=host(p),rails=mesh(buildRailingGeometry(h)),profile=wallWalkProfile(h);for(const t of [0,.005,.995]){const q=wallPathPoint(h,t,profile.side*(profile.inner-.02));expect(down(rails,...q)).toHaveLength(0);}expect(railingRuns(h)).toHaveLength(1);dispose(rails);}
 });
 it('joins a spiral landing to the inner tower walk in both windings, with a matching seam-safe rail gap',()=>{
  for(const sweepAngle of [360,-360])for(const clockwise of [true,false]){const w=updateCurvedWall({...wall(),curve:{center:[0,0],radius:7,startAngle:0,sweepAngle}},{radius:7}),p=connected(w,true,'inner',clockwise),s=stair(p),h=host(p),pad=s.stairs!.landings!.top!,profile=wallWalkProfile(h),m=mesh(buildPartGeometry(s,[])),angle=(h.walk!.stairOpenings![0].position*h.curve!.sweepAngle)*Math.PI/180,radius=h.curve!.radius-profile.inner+.02;
   expect(down(m,radius*Math.cos(angle),radius*Math.sin(angle))[0]?.point.y).toBeCloseTo(pad.elevation,5);const rail=mesh(buildRailingGeometry(h)),q=wallPathPoint(h,.5,profile.side*(profile.inner-.02));expect(down(rail,...q)).toHaveLength(0);expect(railingRuns(s)).toHaveLength(6);dispose(m);dispose(rail);
  }
 });
});
