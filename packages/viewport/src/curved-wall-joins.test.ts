import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createCurvedWall,createSite,createWallChain,curveBoundary,mixedWallCap,parseProject,wallPathPoint,type Level,type Wall,type PlanPoint} from '@openlandcraft/core';
import {buildWallGeometry} from './architecture-geometry';

const level:Level={id:'level',kind:'level',parentId:'site',name:'Castle',position:[0,0,0],rotation:0,visible:true};
const circle=()=>createCurvedWall(level.id,'circle',[[0,0],[5,0]],.8,4,false,.2,'circle');
const meshes=(walls:Wall[])=>walls.map(w=>{const mesh=new THREE.Mesh(buildWallGeometry(w,walls),new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();return mesh;});
const down=(models:THREE.Mesh[],p:PlanPoint)=>models.filter(m=>new THREE.Raycaster(new THREE.Vector3(p[0],10,p[1]),new THREE.Vector3(0,-1,0)).intersectObject(m).length>0).length;
const dispose=(models:THREE.Mesh[])=>models.forEach(m=>{m.geometry.dispose();(m.material as THREE.Material).dispose();});

describe('clean mixed-thickness curved join solids',()=>{
  it('leaves no crack or overlapping top faces along arc/straight miter caps',()=>{
    for(const thickness of [.15,.6,1.2])for(const clockwise of [false,true]){
      const a=createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.3,4,clockwise,.2,'arc');
      const b:Wall={...a,id:'straight',curve:undefined,start:a.end,end:[0,10],thickness},walls=[a,b],models=meshes(walls);
      const ends=[-.15,.15].map(s=>mixedWallCap(a,'end',s,walls)!);
      const dx=ends[1][0]-ends[0][0],dz=ends[1][1]-ends[0][1],length=Math.hypot(dx,dz);
      for(const t of [.1,.3,.5,.7,.9])for(const side of [-.001,.001]){
        const p:PlanPoint=[ends[0][0]+dx*t-dz/length*side,ends[0][1]+dz*t+dx/length*side];expect(down(models,p)).toBe(1);
      }
      for(const side of [-.15,.15]){const boundary=curveBoundary(a,side,walls),angles=boundary.map(p=>Math.atan2(p[1],p[0]));expect(angles.every(Number.isFinite)).toBe(true);}
      dispose(models);
    }
  });
  it('shares the host polygon at every depth slice on either side of a circular wall',()=>{
    const host=circle(),p=parseProject({...createSite({name:'Test',width:60,depth:60,resolution:129,preset:'flat'}),entities:[level,host]});
    for(const inside of [false,true])for(const thickness of [.15,.6,1.2]){
      const branch=createWallChain(p,level.id,inside?[[0,0],[5,0]]:[[10,0],[5,0]],false,'branch',false,thickness)[0],walls=[host,branch],models=meshes(walls);
      for(const fraction of [-.45,-.2,0,.2,.45]){
        const contact=mixedWallCap(branch,'end',fraction*thickness,walls)!;
        for(const side of [-.001,.001])expect(down(models,[contact[0]+side,contact[1]])).toBe(1);
      }
      expect(down([models[0]],[0,0])).toBe(0);dispose(models);
    }
  });
  it('retains real straight-wall windows next to a curved cap and finite editable geometry',()=>{
    const host=circle(),p=parseProject({...createSite({name:'Test',width:60,depth:60,resolution:129,preset:'flat'}),entities:[level,host]});
    const source=createWallChain(p,level.id,[[10,0],[5,0]],false,'branch',false,.4)[0],branch={...source,openings:[{id:'window',kind:'window' as const,offset:1,width:1,height:1,sill:1}]},models=meshes([host,branch]);
    const ray=(x:number)=>new THREE.Raycaster(new THREE.Vector3(x,1.7,3),new THREE.Vector3(0,0,-1)).intersectObject(models[1]);
    expect(ray(8.5)).toHaveLength(0);expect(ray(7.5).length).toBeGreaterThan(0);
    for(const m of models)expect(Array.from(m.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);dispose(models);
  });
  it('keeps tangent thickness transitions closed and arc-to-straight side contacts flush',()=>{
    const a=createCurvedWall(level.id,'arc',[[0,0],[5,0],[0,5]],.3,4,false,.2,'arc');
    const tangent:Wall={...a,id:'tangent',curve:undefined,start:a.end,end:[-5,5],thickness:.7},models=meshes([a,tangent]);
    expect(down(models,[-.01,5])).toBe(1);expect(down(models,[.01,5])).toBe(1);dispose(models);
    const host:Wall={...tangent,id:'host',start:[-8,0],end:[8,0]},branch={...a,junctions:{start:host.id}},joined=meshes([host,branch]);
    for(const lateral of [-.15,.15])expect(mixedWallCap(branch,'start',lateral,[host,branch])![1]).toBeCloseTo(.35);
    expect(down(joined,wallPathPoint(branch,.5))).toBe(1);dispose(joined);
  });
});
