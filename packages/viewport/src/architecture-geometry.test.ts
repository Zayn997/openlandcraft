import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createSite,createBuilding,wallFootprint,type Wall,type Slab} from '@openlandcraft/core';
import {buildWallGeometry,buildPartGeometry} from './architecture-geometry';
const wall:Wall={id:'wall',parentId:'level',name:'Wall',visible:true,kind:'wall',start:[0,0],end:[8,0],height:3.2,thickness:0.3,elevation:0,color:'#ddddee',openings:[{id:'d',kind:'door',offset:1,width:1,height:2.1,sill:0},{id:'w',kind:'window',offset:4,width:2,height:1.2,sill:1}]};
function hits(mesh:THREE.Mesh,x:number,y:number){mesh.updateMatrixWorld();return new THREE.Raycaster(new THREE.Vector3(x,y,4),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length;}
describe('architectural solids',()=>{
  it('the placement target catches existing apertures while the authored wall remains cut',()=>{
    const target=buildWallGeometry({...wall,openings:[]},[wall]);
    const mesh=new THREE.Mesh(target,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    expect(hits(mesh,1.5,1.5)).toBeGreaterThan(0);expect(hits(mesh,5,1.6)).toBeGreaterThan(0);
    expect(wall.openings).toHaveLength(2);target.dispose();
  });
  it('rays pass through doors and windows but hit jambs, lintels, and wall below windows',()=>{
    const geometry=buildWallGeometry(wall,[wall]),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    expect(hits(mesh,1.5,0.1)).toBe(0);expect(hits(mesh,1.5,1.5)).toBe(0);expect(hits(mesh,5,1.6)).toBe(0);
    for(const [x,y]of[[0.5,1],[2.2,1],[1.5,2.5],[5,0.5],[5,2.5]])expect(hits(mesh,x,y)).toBeGreaterThan(0);
    geometry.dispose();
  });
  it('shares exact inner and outer miter corners at a right angle and an oblique angle',()=>{
    for(const angle of [Math.PI/2,Math.PI/3,Math.PI*0.8])for(const thickness of [0.15,0.3,0.6]){
      const a={...wall,joins:true,openings:[]},b:Wall={...a,id:'b',thickness,start:[8,0],end:[8+8*Math.cos(angle),8*Math.sin(angle)]};
      const pa=wallFootprint(a,[a,b]).slice(1,3),pb=wallFootprint(b,[a,b]);
      const world=(p:[number,number])=>[8+p[0]*Math.cos(angle)-p[1]*Math.sin(angle),p[0]*Math.sin(angle)+p[1]*Math.cos(angle)];
      for(const p of pa)expect([world(pb[0]),world(pb[3])].some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6)).toBe(true);
    }
  });
  it('builds a thin partition flush to a thicker host without filling its window',()=>{
    const host={...wall,joins:true,thickness:0.4};
    const branch:Wall={...host,id:'partition',start:[3,4],end:[3,0],thickness:0.15,openings:[],junctions:{end:host.id}};
    const walls=[host,branch],geometry=buildWallGeometry(branch,walls);geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.z).toBeCloseTo(0.2,6);
    expect(geometry.boundingBox!.max.z).toBeCloseTo(4,6);
    expect(geometry.boundingBox!.min.x).toBeCloseTo(2.925,6);
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    const hostGeometry=buildWallGeometry(host,walls),mesh=new THREE.Mesh(hostGeometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    expect(hits(mesh,5,1.6)).toBe(0);expect(hits(mesh,3,1.6)).toBeGreaterThan(0);
    geometry.dispose();hostGeometry.dispose();
  });
  it('leaves the concave floor notch empty and uses the same outline for flat roofs',()=>{
    const p=createSite({name:'Test',width:40,depth:40,resolution:129,preset:'flat'}),slab=createBuilding(p,0,0).find((e):e is Slab=>e.kind==='slab')!;
    const outline:[number,number][]=[[-5,-4],[5,-4],[5,0],[0,0],[0,4],[-5,4]];
    for(const part of [{...slab,outline},{...slab,kind:'roof' as const,rise:0.3,outline}]){
      const geometry=buildPartGeometry(part,[]),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
      const ray=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh).length;
      expect(ray(3,2)).toBe(0);expect(ray(-3,2)).toBeGreaterThan(0);expect(ray(3,-2)).toBeGreaterThan(0);geometry.dispose();
    }
  });
});
