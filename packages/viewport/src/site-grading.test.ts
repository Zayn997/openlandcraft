import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createSite,createDrawnPath,createRegion,evaluateProject,parseProject,gardenSurfaceHeights,type Path,type MaterialRegion} from '@openlandcraft/core';
import {surfaceElevationAt,courtyardNetworkSurfaces,pathNetworkSurfaces,terrainTriangleHeight,type PathPoint} from '@openlandcraft/landscape';
import {buildPathMesh,updatePathHeights,PATH_LIFT} from './path-geometry';
import {buildRegionMesh,updateRegionHeights} from './region-geometry';

const project=createSite({name:'Surface elevations',width:60,depth:60,resolution:129,preset:'flat'});
const walk:Path={...createDrawnPath(project,[[-18,0],[18,0]],{width:4,surface:'paving'}),elevationMode:'fixed',elevation:4,endElevation:7};
const court:MaterialRegion={...createRegion(project,'courtyard',[[-6,-6],[6,-6],[6,6],[-6,6]]),elevationMode:'fixed',elevation:4} as MaterialRegion;
const area=(g:THREE.BufferGeometry)=>{const p=g.getAttribute('position');let sum=0;for(let i=0;i<p.count;i+=3)sum+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getX(i+2)-p.getX(i)))/2;return sum;};
describe('elevated and graded surface geometry',()=>{
  it('renders and raycasts a fixed sloping path at its real elevation after terrain sculpting',()=>{
    const mesh=buildPathMesh(walk,project.site),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),object=new THREE.Mesh(mesh.geometry,material);object.updateMatrixWorld();
    const pick=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)).intersectObject(object)[0];
    expect(pick(0.13,.17).point.y).toBeCloseTo(surfaceElevationAt(walk,project.site,[.13,.17])+PATH_LIFT,5);
    updatePathHeights(mesh,{...project.site,terrain:{...project.site.terrain,heights:project.site.terrain.heights.map(h=>h+8)}},walk);expect(pick(.13,.17).point.y).toBeCloseTo(surfaceElevationAt(walk,project.site,[.13,.17])+PATH_LIFT,5);mesh.geometry.dispose();material.dispose();
  });
  it('clips only matching elevations and restores a lower path below a raised courtyard',()=>{
    for(const elevation of [4,6]){
      const flat={...walk,endElevation:4},c={...court,elevation},height=(id:string,p:PathPoint)=>surfaceElevationAt(id===c.id?c:flat,project.site,p),courts=courtyardNetworkSurfaces([c],height);
      const paths=pathNetworkSurfaces([flat],[...courts].flatMap(([id,polys])=>polys.map(points=>({id,points}))),height);
      const m=buildPathMesh(flat,project.site,paths.get(flat.id)),n=buildRegionMesh(c.points,project.site,PATH_LIFT,courts.get(c.id),c);
      expect(area(m.geometry)).toBeCloseTo(elevation===4?96:144,4);expect(area(n.geometry)).toBeCloseTo(144,4);m.geometry.dispose();n.geometry.dispose();
    }
  });
  it('keeps a graded courtyard flat and flush with the cut/fill terrain and regenerates it after elevation edits',()=>{
    const c={...court,elevationMode:'graded' as const,gradingWidth:3},p=parseProject({...project,entities:[c]}),site=evaluateProject(p).site;
    const mesh=buildRegionMesh(c.points,site,PATH_LIFT,undefined,c),positions=mesh.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i+=17){expect(positions.getY(i)).toBeCloseTo(4+PATH_LIFT,5);expect(positions.getY(i)-terrainTriangleHeight(site,[positions.getX(i),positions.getZ(i)])).toBeCloseTo(PATH_LIFT,5);}
    const raised={...c,elevation:5},newSite=evaluateProject(parseProject({...p,entities:[raised]})).site;updateRegionHeights(mesh,newSite,PATH_LIFT,raised);expect(positions.getY(0)).toBeCloseTo(5+PATH_LIFT,5);mesh.geometry.dispose();
  });
  it('keeps one visible surface where a sloped grade, following path and level court meet',()=>{
    const c={...court,elevationMode:'graded' as const,gradingWidth:4},main={...walk,elevationMode:'terrain' as const,elevation:undefined,endElevation:undefined};
    const ramp:Path={...walk,id:'ramp',points:[[-20,0],[-6,0]],width:3,elevationMode:'graded',elevation:2,endElevation:4,gradingWidth:3};
    const p=evaluateProject(parseProject({...project,entities:[main,c,ramp]})),height=gardenSurfaceHeights(p),courts=courtyardNetworkSurfaces([c],height);
    const paths=pathNetworkSurfaces([main,ramp],[...courts].flatMap(([id,polys])=>polys.map(points=>({id,points}))),height);
    const meshes=[buildRegionMesh(c.points,p.site,PATH_LIFT,courts.get(c.id),c),...[main,ramp].map(w=>buildPathMesh(w,p.site,paths.get(w.id)))],material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const objects=meshes.map(m=>{const o=new THREE.Mesh(m.geometry,material);o.updateMatrixWorld();return o;});
    for(const [x,z] of [[.13,.17],[-5.97,.17],[-6.03,.17],[-12.13,.17]])expect(new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)).intersectObjects(objects)).toHaveLength(1);
    meshes.forEach(m=>m.geometry.dispose());material.dispose();
  });
});
