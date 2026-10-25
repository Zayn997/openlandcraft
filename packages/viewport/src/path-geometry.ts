import * as THREE from 'three';
import { clipPathPolygon, pathStrips, polygonArea, roundedRoutePoints, compileSurface, bridgeStation, surfaceElevationAt, type SiteSurface, type SurfaceElevation, type PathPoint, type PathSurface } from '@openlandcraft/landscape';
import type { Path, Project } from '@openlandcraft/core';

export const PATH_LIFT = 0.035;
export type PathMesh = { geometry: THREE.BufferGeometry; samples: { indices: [number, number, number]; weights: [number, number, number] }[] };

/** Clip the route to terrain triangles once; height edits only update vertex Y. */
export function buildPathMesh(path: Pick<Path,'points'|'width'|'cornerRounding'> & Partial<Pick<Path,'surface'>> & SurfaceElevation, site: Project['site'], surfaces?: PathSurface[]): PathMesh {
  if(path.bridge){
    const {length,tx,tz}=bridgeStation(path,path.points[0]),r=path.bridge.approachLength,stations=[0,r,length-r,length],vertices:number[]=[],uvs:number[]=[],samples:PathMesh['samples']=[];
    for(let i=1;i<stations.length;i++)for(const [s,c] of [[stations[i-1],-1],[stations[i],1],[stations[i],-1],[stations[i-1],-1],[stations[i-1],1],[stations[i],1]]){
      const x=path.points[0][0]+s*tx-c*path.width/2*tz,z=path.points[0][1]+s*tz+c*path.width/2*tx;
      vertices.push(x,surfaceElevationAt(path,site,[x,z])+PATH_LIFT,z);uvs.push(c*path.width/2,s);samples.push({indices:[0,0,0],weights:[1,0,0]});
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return {geometry,samples};
  }
  path={...path,points:roundedRoutePoints(path),cornerRounding:undefined};
  const positions: number[] = [], uvs: number[] = [], samples: PathMesh['samples'] = [];
  const { columns, rows } = site.terrain, dx = site.width / (columns - 1), dz = site.depth / (rows - 1);
  const distances=[0];
  path.points.slice(1).forEach((p,i)=>distances.push(distances[i]+Math.hypot(p[0]-path.points[i][0],p[1]-path.points[i][1])));
  (surfaces??pathStrips(path).map((points,segment)=>({points,segment}))).forEach(({points:strip,segment}) => {
    const along=distances[segment];
    const a = path.points[segment], b = path.points[segment + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
    const minX = Math.max(0, Math.floor((Math.min(...strip.map(p => p[0])) + site.width / 2) / dx));
    const maxX = Math.min(columns - 2, Math.floor((Math.max(...strip.map(p => p[0])) + site.width / 2) / dx));
    const minZ = Math.max(0, Math.floor((Math.min(...strip.map(p => p[1])) + site.depth / 2) / dz));
    const maxZ = Math.min(rows - 2, Math.floor((Math.max(...strip.map(p => p[1])) + site.depth / 2) / dz));
    for (let row = minZ; row <= maxZ; row++) for (let col = minX; col <= maxX; col++) {
      const x = col * dx - site.width / 2, z = row * dz - site.depth / 2, index = row * columns + col;
      const corners: PathPoint[] = [[x, z], [x + dx, z], [x, z + dz], [x + dx, z + dz]];
      const grid = [index, index + 1, index + columns, index + columns + 1];
      for (const ids of [[0, 1, 2], [1, 3, 2]]) {
        const triangle = ids.map(i => corners[i]), clipped = clipPathPolygon(strip, triangle);
        if (polygonArea(clipped) < 1e-10) continue;
        for (let j = 1; j < clipped.length - 1; j++) {
          // Reverse X/Z winding to face +Y.
          for (const p of [clipped[0], clipped[j + 1], clipped[j]]) {
            const [p0, p1, p2] = triangle, denominator = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
            const w0 = ((p1[1] - p2[1]) * (p[0] - p2[0]) + (p2[0] - p1[0]) * (p[1] - p2[1])) / denominator;
            const w1 = ((p2[1] - p0[1]) * (p[0] - p2[0]) + (p0[0] - p2[0]) * (p[1] - p2[1])) / denominator;
            positions.push(p[0], 0, p[1]);
            if(path.surface==='gravel'||path.surface==='paving')uvs.push(p[0],p[1]);
            else uvs.push(-(p[0] - a[0]) * tz + (p[1] - a[1]) * tx, along + (p[0] - a[0]) * tx + (p[1] - a[1]) * tz);
            samples.push({ indices: ids.map(i => grid[i]) as [number, number, number], weights: [w0, w1, 1 - w0 - w1] });
          }
        }
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const mesh = { geometry, samples }; updatePathHeights(mesh, site,path); return mesh;
}

export function updatePathHeights(mesh: PathMesh, site: Project['site'],surface?:SiteSurface) {
  const position = mesh.geometry.getAttribute('position');
  const height=surface?.bridge?(p:PathPoint)=>surfaceElevationAt(surface,site,p):surface?.elevationMode&&surface.elevationMode!=='terrain'?compileSurface(surface).height:null;
  mesh.samples.forEach(({ indices, weights }, i) => position.setY(i, height?height([position.getX(i),position.getZ(i)])+PATH_LIFT:indices.reduce((y, index, j) => y + site.terrain.heights[index] * weights[j], PATH_LIFT)));
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
}
