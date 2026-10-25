import * as THREE from 'three';
import {clipPathPolygon,polygonArea,regionTriangles,compileSurface,type SiteSurface,type PathPoint} from '@openlandcraft/landscape';
import type {Project} from '@openlandcraft/core';
import type {PathMesh} from './path-geometry';

/** Triangulate a concave outline, then clip to the terrain triangles for exact following. */
export function buildRegionMesh(points:PathPoint[],site:Project['site'],lift:number,surfaces?:PathPoint[][],surface?:SiteSurface):PathMesh {
  const positions:number[]=[],uvs:number[]=[],samples:PathMesh['samples']=[];
  const triangles=surfaces??regionTriangles(points);
  const {columns,rows}=site.terrain,dx=site.width/(columns-1),dz=site.depth/(rows-1);
  for(const outline of triangles){
    const minC=Math.max(0,Math.floor((Math.min(...outline.map(p=>p[0]))+site.width/2)/dx)),maxC=Math.min(columns-2,Math.floor((Math.max(...outline.map(p=>p[0]))+site.width/2)/dx));
    const minR=Math.max(0,Math.floor((Math.min(...outline.map(p=>p[1]))+site.depth/2)/dz)),maxR=Math.min(rows-2,Math.floor((Math.max(...outline.map(p=>p[1]))+site.depth/2)/dz));
    for(let r=minR;r<=maxR;r++)for(let c=minC;c<=maxC;c++){
      const x=c*dx-site.width/2,z=r*dz-site.depth/2,index=r*columns+c,corners:PathPoint[]=[[x,z],[x+dx,z],[x,z+dz],[x+dx,z+dz]],grid=[index,index+1,index+columns,index+columns+1];
      for(const t of [[0,1,2],[1,3,2]]){
        const triangle=t.map(i=>corners[i]),clipped=clipPathPolygon(outline,triangle);if(polygonArea(clipped)<1e-10)continue;
        for(let j=1;j<clipped.length-1;j++){
          const face=[clipped[0],clipped[j+1],clipped[j]];if(polygonArea(face)<1e-10)continue;
          if((face[1][0]-face[0][0])*(face[2][1]-face[0][1])-(face[1][1]-face[0][1])*(face[2][0]-face[0][0])>0)[face[1],face[2]]=[face[2],face[1]];
          for(const p of face){
          const [a,b,d]=triangle,den=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);
          const w0=((b[1]-d[1])*(p[0]-d[0])+(d[0]-b[0])*(p[1]-d[1]))/den,w1=((d[1]-a[1])*(p[0]-d[0])+(a[0]-d[0])*(p[1]-d[1]))/den;
          positions.push(p[0],0,p[1]);uvs.push(p[0],p[1]);samples.push({indices:t.map(i=>grid[i]) as [number,number,number],weights:[w0,w1,1-w0-w1]});
          }
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  const mesh={geometry,samples};updateRegionHeights(mesh,site,lift,surface);return mesh;
}
export function updateRegionHeights(mesh:PathMesh,site:Project['site'],lift:number,surface?:SiteSurface){
  const positions=mesh.geometry.getAttribute('position'),height=surface?.elevationMode&&surface.elevationMode!=='terrain'?compileSurface(surface).height:null;
  mesh.samples.forEach(({indices,weights},i)=>positions.setY(i,height?height([positions.getX(i),positions.getZ(i)])+lift:indices.reduce((y,index,j)=>y+site.terrain.heights[index]*weights[j],lift)));
  positions.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
}
