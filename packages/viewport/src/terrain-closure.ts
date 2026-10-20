import * as THREE from 'three';
import type { Project } from '@openlandcraft/core';

export const TERRAIN_BASE = -12;

/** Clockwise in XZ; each sample exactly matches the heightfield's outer edge. */
export function terrainPerimeter(columns: number, rows: number): number[] {
  const edge: number[] = [];
  for (let x=0;x<columns;x++) edge.push(x);
  for (let z=1;z<rows;z++) edge.push(z*columns+columns-1);
  for (let x=columns-2;x>=0;x--) edge.push((rows-1)*columns+x);
  for (let z=rows-2;z>0;z--) edge.push(z*columns);
  return edge;
}

/** Side quads and a bottom fan close the existing editable top surface. */
export function terrainClosure(site: Project['site']): THREE.BufferGeometry {
  const edge=terrainPerimeter(site.terrain.columns,site.terrain.rows), vertices:number[]=[],indices:number[]=[];
  const { columns, rows, heights }=site.terrain;
  const point=(id:number,y:number)=>vertices.push((id%columns)/(columns-1)*site.width-site.width/2,y,Math.floor(id/columns)/(rows-1)*site.depth-site.depth/2);
  edge.forEach((a,i)=>{
    const b=edge[(i+1)%edge.length],v=vertices.length/3;
    point(a,heights[a]);point(b,heights[b]);point(a,TERRAIN_BASE);point(b,TERRAIN_BASE);
    indices.push(v,v+1,v+2,v+1,v+3,v+2);
  });
  const center=vertices.length/3;vertices.push(0,TERRAIN_BASE,0);
  edge.forEach(id=>point(id,TERRAIN_BASE));
  edge.forEach((_,i)=>indices.push(center,center+1+i,center+1+(i+1)%edge.length));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function updateTerrainClosure(geometry: THREE.BufferGeometry, site: Project['site']) {
  const edge=terrainPerimeter(site.terrain.columns,site.terrain.rows),p=geometry.attributes.position;
  edge.forEach((id,i)=>{p.setY(i*4,site.terrain.heights[id]);p.setY(i*4+1,site.terrain.heights[edge[(i+1)%edge.length]]);});
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
