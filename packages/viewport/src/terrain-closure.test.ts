import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createProject, groundHeight } from '@openlandcraft/core';
import { TERRAIN_BASE, terrainClosure, terrainPerimeter, updateTerrainClosure } from './terrain-closure';
import { oceanBoundary } from './ocean-volume';
import { underwaterCamera } from './underwater-camera';

describe('closed landscape and ocean volume',()=>{
  it('closes every boundary edge of the editable top with opposing triangle edges',()=>{
    const site=createProject().site, {columns,rows,heights}=site.terrain;
    const top=new THREE.PlaneGeometry(site.width,site.depth,columns-1,rows-1);top.rotateX(-Math.PI/2);
    heights.forEach((height,i)=>top.attributes.position.setY(i,height));
    const closure=terrainClosure(site),edges=new Map<string,number>(),directions=new Map<string,number>();
    for(const geometry of [top,closure]){
      const p=geometry.attributes.position,ids=geometry.index!;
      const vertex=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(',');
      for(let i=0;i<ids.count;i+=3)for(let side=0;side<3;side++){
        const a=vertex(ids.getX(i+side)),b=vertex(ids.getX(i+(side+1)%3)),key=[a,b].sort().join('|');
        edges.set(key,(edges.get(key)??0)+1);directions.set(key,(directions.get(key)??0)+(a<b?1:-1));
      }
    }
    expect([...edges.values()].every(n=>n===2)).toBe(true);
    expect([...directions.values()].every(n=>n===0)).toBe(true);
    top.dispose();closure.dispose();
  });
  it('updates wall heights for boundary sculpting while keeping its bottom below the entire supported field',()=>{
    const site=createProject().site,geometry=terrainClosure(site),edge=terrainPerimeter(site.terrain.columns,site.terrain.rows);
    site.terrain.heights[edge[2]]=35;site.terrain.heights[edge[3]]=-9;updateTerrainClosure(geometry,site);
    expect(geometry.attributes.position.getY(2*4)).toBe(35);
    expect(geometry.attributes.position.getY(3*4)).toBe(-9);
    edge.forEach((_,i)=>expect(geometry.attributes.position.getY(i*4+2)).toBe(TERRAIN_BASE));
    expect(geometry.boundingBox!.max.y).toBe(35);geometry.dispose();
  });
  it('connects the water boundary continuously around all four sides at the wave-grid spacing',()=>{
    const geometry=oceanBoundary(90,72,32,24),p=geometry.attributes.position;
    expect(p.count).toBe((32+24)*4);
    for(let i=0;i<p.count;i+=2){
      expect(Math.abs(p.getX(i))===45||Math.abs(p.getZ(i))===36).toBe(true);
      expect([p.getX(i),p.getZ(i)]).toEqual([p.getX(i+1),p.getZ(i+1)]);
      expect([p.getY(i),p.getY(i+1)]).toEqual([0,1]);
    }
    expect(geometry.index!.count).toBe((32+24)*12);geometry.dispose();
  });
  it('finds a submerged camera in real sea water and refuses dry or too-shallow sites',()=>{
    const project=createProject(),ocean=project.entities.find(e=>e.kind==='ocean')!;
    const pose=underwaterCamera(project.site,ocean)!;
    expect(pose).not.toBeNull();expect(pose.position[1]).toBeLessThan(ocean.level);
    expect(pose.position[1]).toBeGreaterThan(groundHeight(pose.position[0],pose.position[2],project.site)+0.2);
    const dry={...project.site,terrain:{...project.site.terrain,heights:project.site.terrain.heights.map(()=>ocean.level+1)}};
    expect(underwaterCamera(dry,ocean)).toBeNull();
    const shallow={...project.site,terrain:{...project.site.terrain,heights:project.site.terrain.heights.map(()=>ocean.level-0.5)}};
    expect(underwaterCamera(shallow,ocean)).toBeNull();
    expect(underwaterCamera(project.site,{...ocean,visible:false})).toBeNull();
  });
  it('does not enter a lake where the ocean surface has been masked out',()=>{
    const project=createProject(),ocean=project.entities.find(e=>e.kind==='ocean')!;
    const lakes=[{visible:true,points:[[-100,-100],[100,-100],[100,100],[-100,100]] as [number,number][]}];
    expect(underwaterCamera(project.site,ocean,lakes)).toBeNull();
    expect(underwaterCamera(project.site,ocean,[{...lakes[0],visible:false}])).not.toBeNull();
  });
});
