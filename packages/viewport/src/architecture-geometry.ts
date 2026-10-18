import * as THREE from 'three';
import { footprint, wallFootprint, wallLength, type BuildingPart, type PlanPoint, type Wall } from '@openlandcraft/core';

function prism(points: PlanPoint[], bottom: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.rotateX(-Math.PI/2); geometry.translate(0,bottom,0); return geometry;
}
/** Closed wall solids with actual empty apertures, including doors open at the base. */
export function buildWallGeometry(wall: Wall, walls: Wall[]): THREE.BufferGeometry {
  const polygon=wallFootprint(wall,walls), openings=wall.openings??[], length=wallLength(wall);
  const shape=new THREE.Shape();shape.moveTo(0,0);
  for(const o of openings.filter(o=>o.sill===0).sort((a,b)=>a.offset-b.offset)){
    shape.lineTo(o.offset,0);shape.lineTo(o.offset,o.height);shape.lineTo(o.offset+o.width,o.height);shape.lineTo(o.offset+o.width,0);
  }
  shape.lineTo(length,0);shape.lineTo(length,wall.height);shape.lineTo(0,wall.height);shape.closePath();
  for(const o of openings.filter(o=>o.sill>0)){
    const hole=new THREE.Path();hole.moveTo(o.offset,o.sill);hole.lineTo(o.offset,o.sill+o.height);hole.lineTo(o.offset+o.width,o.sill+o.height);hole.lineTo(o.offset+o.width,o.sill);hole.closePath();shape.holes.push(hole);
  }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:wall.thickness,bevelEnabled:false,steps:1,curveSegments:1});
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i), t=positions.getZ(i)/wall.thickness;
    if(Math.abs(x)<1e-5)positions.setX(i,polygon[0][0]*(1-t)+polygon[3][0]*t);
    if(Math.abs(x-length)<1e-5)positions.setX(i,polygon[1][0]*(1-t)+polygon[2][0]*t);
  }
  geometry.translate(0,wall.elevation,-wall.thickness/2);geometry.computeVertexNormals();
  const angle=Math.atan2(wall.end[1]-wall.start[1],wall.end[0]-wall.start[0]);
  geometry.rotateY(-angle);geometry.translate(wall.start[0],0,wall.start[1]);
  return geometry;
}
export function buildPartGeometry(part: BuildingPart, walls: Wall[]): THREE.BufferGeometry {
  if(part.kind==='wall')return buildWallGeometry(part,walls);
  if(part.kind==='slab'||part.outline)return prism(footprint(part),part.elevation,part.kind==='slab'?part.thickness:part.rise);
  const shape=new THREE.Shape();shape.moveTo(-part.width/2,0);shape.lineTo(part.width/2,0);shape.lineTo(0,part.rise);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:part.depth,bevelEnabled:false});
  geometry.translate(part.center[0],part.elevation,part.center[1]-part.depth/2);return geometry;
}
