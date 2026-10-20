import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createSite,createLake,createRiver,evaluateProject,groundHeight} from '@openlandcraft/core';
import {lakeDistance} from '@openlandcraft/landscape';
import {clipWaterDomain,waterBoundary,updateWaterBoundary} from './inland-geometry';
import {inlandWaterCamera} from './inland-camera';
import {buildRiverField,riverWave} from './river-water';
import {riverGeometry} from './river-geometry';
import {sampleRiverVolume} from './inland-sampling';

function riverScene(){
  const project=createSite({name:'Inland test',width:60,depth:60,resolution:129,preset:'flat'});
  const river={...createRiver(project),points:[[-18,2,0],[0,1.5,0],[18,1,0]] as [number,number,number][],depth:1.4,width:4};
  project.entities=[river];return {river,site:evaluateProject(project).site};
}
describe('inland water volumes',()=>{
  it('closes a concave lake boundary without filling its dry notch',()=>{
    const points:[number,number][]=[[-8,-8],[8,-8],[8,0],[0,0],[0,8],[-8,8]];
    const plane=new THREE.PlaneGeometry(20,20,40,40);plane.rotateX(-Math.PI/2);
    const top=clipWaterDomain(plane,(x,z)=>lakeDistance(points,x,z)),boundary=waterBoundary(top);
    const p=top.attributes.position,index=top.index!;
    let area=0;
    for(let i=0;i<index.count;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(p,index.getX(i)),b=new THREE.Vector3().fromBufferAttribute(p,index.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(p,index.getX(i+2));
      area+=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
      const center=a.add(b).add(c).divideScalar(3);expect(lakeDistance(points,center.x,center.z)).toBeGreaterThanOrEqual(-1e-5);
    }
    expect(area).toBeCloseTo(192,3);
    const edges=new Map<string,number>();
    for(let i=0;i<index.count;i+=3)for(let n=0;n<3;n++){const a=index.getX(i+n),b=index.getX(i+(n+1)%3),key=[a,b].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)??0)+1);}
    expect(boundary.attributes.position.count/4).toBe([...edges.values()].filter(n=>n===1).length);
    // Every wall's top edge opposes the surface edge; adjacent endpoints coincide.
    const ids=boundary.userData.surfaceIds as number[];
    for(let i=0;i<ids.length;i+=4)expect([ids[i+2],ids[i+3]]).toEqual([ids[i],ids[i+1]]);
    plane.dispose();top.dispose();boundary.dispose();
  });
  it('retains river flow and phase on both banks and both end caps, including updated bed profiles',()=>{
    const {site,river}=riverScene(),field=buildRiverField(site,river),top=riverGeometry(field,river.water.wavelength,'low'),wall=waterBoundary(top);
    const ids=wall.userData.surfaceIds as number[],profile=top.getAttribute('riverProfile') as THREE.BufferAttribute;
    profile.setX(ids[0],17.25);profile.needsUpdate=true;updateWaterBoundary(wall,top);
    expect(wall.attributes.riverProfile.getX(0)).toBe(17.25);
    ids.forEach((id,i)=>expect(wall.attributes.flow.getX(i)).toBe(top.attributes.flow.getX(id)));
    expect(wall.attributes.position.count).toBe(8*(top.userData.riverRows-1+top.userData.riverAcross));
    top.dispose();wall.dispose();
  });
  it('samples the existing river waves at channel centers and excludes outside banks and end caps',()=>{
    const {site,river}=riverScene(),f=buildRiverField(site,river),row=Math.floor(f.rows/2),i=row*f.columns+Math.floor(f.columns/2);
    const x=f.positions[i*3],z=f.positions[i*3+2],time=1.7,hit=sampleRiverVolume(f,river,site,x,z,time)!;
    expect(hit.surface).toBeCloseTo(f.positions[i*3+1]+riverWave(f,river,i,time).height+0.012,4);
    expect(sampleRiverVolume(f,river,site,0,15,time)).toBeNull();
    expect(sampleRiverVolume(f,river,site,-20,0,time)).toBeNull();
    expect(sampleRiverVolume(f,river,site,20,0,time)).toBeNull();
    expect(sampleRiverVolume(f,river,site,x,z,time+1)!.surface).not.toBe(hit.surface);
  });
  it('frames lake and sloped river water without an ocean, with bed and trough clearance',()=>{
    const {site,river}=riverScene(),project=createSite({name:'Lake only',width:50,depth:50,resolution:129,preset:'flat'}),lake=createLake(project,[[-10,-10],[10,-10],[10,10],[-10,10]]);
    project.entities=[lake];const lakeSite=evaluateProject(project).site;
    for(const [water,ground] of [[river,site],[lake,lakeSite]] as const){
      const pose=inlandWaterCamera(ground,water)!;expect(pose).not.toBeNull();
      expect(pose.position[1]).toBeGreaterThan(groundHeight(pose.position[0],pose.position[2],ground)+0.2);
      expect(inlandWaterCamera(ground,{...water,visible:false})).toBeNull();
      const dry={...ground,terrain:{...ground.terrain,heights:ground.terrain.heights.map(()=>30)}};
      expect(inlandWaterCamera(dry,water)).toBeNull();
    }
    const pose=inlandWaterCamera(lakeSite,lake)!;expect(lakeDistance(lake.points,pose.position[0],pose.position[2])).toBeGreaterThan(0.5);
    const shallow={...lakeSite,terrain:{...lakeSite.terrain,heights:lakeSite.terrain.heights.map(()=>lake.level-0.15)}};
    expect(inlandWaterCamera(shallow,lake)).toBeNull();
    expect(inlandWaterCamera(site,river)!.position[0]).toBeLessThan(0);
  });
});
