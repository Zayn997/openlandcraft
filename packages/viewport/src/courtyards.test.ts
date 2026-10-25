import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createSite,createDrawnPath} from '@openlandcraft/core';
import {courtyardNetworkSurfaces,pathNetworkSurfaces,type PathPoint} from '@openlandcraft/landscape';
import {buildRegionMesh,updateRegionHeights} from './region-geometry';
import {buildPathMesh,PATH_LIFT} from './path-geometry';
import {pathMaterial} from './path';
import {intersectTerrain} from './terrain-picking';

const project=createSite({name:'Courtyard meshes',width:60,depth:60,resolution:129,preset:'flat'});
const courtyard={id:'court',visible:true,points:[[-8,-8],[8,-8],[8,8],[-8,8]] as PathPoint[]};
const path=createDrawnPath(project,[[-20,0],[20,0]],{width:4,surface:'paving'});
const area=(g:THREE.BufferGeometry)=>{const p=g.getAttribute('position');let sum=0;for(let i=0;i<p.count;i+=3)sum+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getX(i+2)-p.getX(i)))/2;return sum;};
describe('courtyard and path joins',()=>{
  it('covers a courtyard and crossing exactly once on rough terrain, with matching paving UVs',()=>{
    const site=structuredClone(project.site);site.terrain.heights=site.terrain.heights.map((_,i)=>2+Math.sin(i*.8)*.7);
    const courts=courtyardNetworkSurfaces([courtyard]),paths=pathNetworkSurfaces([path],[...courts.values()].flat());
    const court=buildRegionMesh(courtyard.points,site,PATH_LIFT,courts.get(courtyard.id)),walk=buildPathMesh(path,site,paths.get(path.id));
    expect(area(court.geometry)+area(walk.geometry)).toBeCloseTo(352,4);
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),objects=[court,walk].map(m=>{const o=new THREE.Mesh(m.geometry,material);o.updateMatrixWorld();return o;});
    for(const [x,z] of [[.17,.23],[-7.99,.23],[-8.01,.23],[7.99,.23],[8.01,.23],[19.9,.23],[-2.31,7.97]]){
      const ray=new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)),hits=ray.intersectObjects(objects);expect(hits).toHaveLength(1);
      expect(hits[0].point.y-intersectTerrain(ray.ray,site)!.point.y).toBeCloseTo(PATH_LIFT,4);
    }
    for(const mesh of [court,walk]){const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');for(let i=0;i<p.count;i++){expect(uv.getX(i)).toBeCloseTo(p.getX(i),5);expect(uv.getY(i)).toBeCloseTo(p.getZ(i),5);}}
    const changed=structuredClone(site);changed.terrain.heights=changed.terrain.heights.map(h=>h+1);const before=court.geometry.getAttribute('position').getY(0);updateRegionHeights(court,changed,PATH_LIFT);expect(court.geometry.getAttribute('position').getY(0)).toBeCloseTo(before+1,4);
    court.geometry.dispose();walk.geometry.dispose();material.dispose();
  });
  it('resolves overlapping courtyards, then restores paths when a courtyard is hidden or resized',()=>{
    const other={...courtyard,id:'later',points:courtyard.points.map(([x,z]):PathPoint=>[x+8,z])};
    const courts=courtyardNetworkSurfaces([courtyard,other]);
    const a=buildRegionMesh(courtyard.points,project.site,PATH_LIFT,courts.get(courtyard.id)),b=buildRegionMesh(other.points,project.site,PATH_LIFT,courts.get(other.id));
    expect(area(a.geometry)).toBeCloseTo(128,4);expect(area(b.geometry)).toBeCloseTo(256,4);
    for(const c of [{...courtyard,visible:false},{...courtyard,points:courtyard.points.map(([x,z]):PathPoint=>[x+20,z])}]){
      const mask=courtyardNetworkSurfaces([c]),mesh=buildPathMesh(path,project.site,pathNetworkSurfaces([path],[...mask.values()].flat()).get(path.id));
      expect(area(mesh.geometry)).toBeCloseTo(c.visible?128:160,4);mesh.geometry.dispose();
    }
    a.geometry.dispose();b.geometry.dispose();
  });
  it('shares the actual stone shader and accepts courtyard color, scale and roughness',()=>{
    const m=pathMaterial('paving',{color:'#b8af98',roughness:.7,scale:2});
    const shader={vertexShader:'#include <uv_vertex>',fragmentShader:'#include <color_fragment>'} as THREE.WebGLProgramParametersWithUniforms;
    m.onBeforeCompile(shader,{} as THREE.WebGLRenderer);expect(shader.fragmentShader).toContain('vec2 p=vPathUV/2.0000');expect(shader.fragmentShader).toContain('p.x/0.5');expect(m.roughness).toBe(.7);expect(m.color.getHexString()).toBe('b8af98');m.dispose();
  });
});
