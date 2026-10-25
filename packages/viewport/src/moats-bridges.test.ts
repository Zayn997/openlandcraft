import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createSite,createMoat,createBridge,evaluateProject} from '@openlandcraft/core';
import {lakeWaterDistance,surfaceElevationAt} from '@openlandcraft/landscape';
import {clipWaterDomain,waterBoundary} from './inland-geometry';
import {buildPathMesh,PATH_LIFT} from './path-geometry';
import {bridgeShell} from './bridge';
import {LakeHistory} from './lake-water';
import {inlandWaterCamera} from './inland-camera';

describe('moat water domain and bridge geometry',()=>{
  it('cuts the dry island from surface and underwater volume, history and dive poses',()=>{
    const p=createSite({name:'Moat',width:80,depth:80,resolution:129,preset:'flat'}),lake=createMoat(p);p.entities.push(lake);const scene=evaluateProject(p),plane=new THREE.PlaneGeometry(70,70,140,140);plane.rotateX(-Math.PI/2);
    const water=clipWaterDomain(plane,(x,z)=>lakeWaterDistance(lake,x,z)+.8),position=water.getAttribute('position'),index=water.index!;
    for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],x=ids.reduce((sum,j)=>sum+position.getX(j),0)/3,z=ids.reduce((sum,j)=>sum+position.getZ(j),0)/3;expect(lakeWaterDistance(lake,x,z)).toBeGreaterThan(-.85);}
    const boundary=waterBoundary(water);expect(boundary.getAttribute('position').count).toBeGreaterThan(100);
    const history=new LakeHistory(scene.site,lake);expect(Math.min(...history.distances)).toBeLessThan(-10);
    const pose=inlandWaterCamera(scene.site,lake);expect(pose).not.toBeNull();expect(lakeWaterDistance(lake,pose!.position[0],pose!.position[2])).toBeGreaterThan(0);
    boundary.dispose();water.dispose();plane.dispose();
  });
  it('renders exact ramp breaks, upward deck faces, a full underside and no baked terrain',()=>{
    const p=createSite({name:'Bridge',width:100,depth:100,resolution:129,preset:'flat'}),lake=createMoat(p);p.entities.push(lake);const bridge=createBridge(p),mesh=buildPathMesh(bridge,p.site),position=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal');
    expect(position.count).toBe(18);
    for(let i=0;i<position.count;i++){expect(position.getY(i)).toBeCloseTo(surfaceElevationAt(bridge,p.site,[position.getX(i),position.getZ(i)])+PATH_LIFT,5);expect(normals.getY(i)).toBeGreaterThan(.9);}
    const shell=bridgeShell(bridge,p.site);expect(shell.getAttribute('position').count).toBe(66);expect(p.site.terrain.heights.every(h=>h===2)).toBe(true);shell.dispose();mesh.geometry.dispose();
  });
});
