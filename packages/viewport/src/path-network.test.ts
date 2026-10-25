import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createSite,createDrawnPath,type Path} from '@openlandcraft/core';
import {pathNetworkSurfaces,type PathPoint} from '@openlandcraft/landscape';
import {buildPathMesh,PATH_LIFT,updatePathHeights} from './path-geometry';
import {intersectTerrain} from './terrain-picking';

const project=createSite({name:'Junction mesh',width:60,depth:60,resolution:129,preset:'flat'});
const path=(id:string,points:PathPoint[],width=4):Path=>({...createDrawnPath(project,points,{width,surface:'paving'}),id});
const main=path('main',[[-20,0],[20,0]]);
function area(g:THREE.BufferGeometry){const p=g.getAttribute('position');let sum=0;for(let i=0;i<p.count;i+=3)sum+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getX(i+2)-p.getX(i)))/2;return sum;}
describe('joined garden path surfaces',()=>{
  it.each([
    {name:'cross',other:path('other',[[0,-20],[0,20]]),area:304},
    {name:'T',other:path('other',[[0,0],[0,20]]),area:232},
    {name:'unequal widths',other:path('other',[[0,-20],[0,20]],2),area:232},
    {name:'collinear overlap',other:path('other',[[-10,0],[10,0]]),area:160},
    {name:'parallel touch',other:path('other',[[-20,4],[20,4]]),area:320},
    {name:'diagonal cross',other:path('other',[[-10,-10],[10,10]]),area:160+Math.sqrt(800)*4-16*Math.sqrt(2)},
  ])('triangulates $name once without stacked faces',({other,area:expected})=>{
    const surfaces=pathNetworkSurfaces([main,other]),meshes=[main,other].map(p=>buildPathMesh(p,project.site,surfaces.get(p.id)));
    expect(meshes.reduce((sum,m)=>sum+area(m.geometry),0)).toBeCloseTo(expected,3);
    for(const mesh of meshes){const positions=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
      for(let i=0;i<positions.count;i++){expect(Number.isFinite(positions.getX(i))).toBe(true);expect(uv.getX(i)).toBeCloseTo(positions.getX(i),5);expect(uv.getY(i)).toBeCloseTo(positions.getZ(i),5);}
      mesh.geometry.dispose();
    }
  });
  it('leaves no gaps or duplicate coverage through a junction on sculpted terrain',()=>{
    const site=structuredClone(project.site);site.terrain.heights=site.terrain.heights.map((_,i)=>2+Math.sin(i*.8)*.7);
    const cross=path('cross',[[0,-20],[0,20]]),surfaces=pathNetworkSurfaces([main,cross]);
    const meshes=[main,cross].map(p=>buildPathMesh(p,site,surfaces.get(p.id))),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const objects=meshes.map(m=>{const o=new THREE.Mesh(m.geometry,material);o.updateMatrixWorld();return o;});
    for(const [x,z] of [[.11,.23],[-1.9,.17],[1.9,.17],[2.1,.17],[.13,-2.1],[.13,2.1],[0.11,19.9]]){
      const ray=new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)),hits=ray.intersectObjects(objects);
      expect(hits).toHaveLength(1);const ground=intersectTerrain(ray.ray,site)!;expect(hits[0].point.y-ground.point.y).toBeCloseTo(PATH_LIFT,4);
    }
    const changed=structuredClone(site);changed.terrain.heights=changed.terrain.heights.map(v=>v+1);
    for(const mesh of meshes){const before=mesh.geometry.getAttribute('position').getY(0);updatePathHeights(mesh,changed);expect(mesh.geometry.getAttribute('position').getY(0)).toBeCloseTo(before+1,4);mesh.geometry.dispose();}material.dispose();
  });
});
