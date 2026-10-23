import * as THREE from 'three';
import {buildFloorGeometry} from './floor-geometry';
import {buildRailingGeometry,mergeSolidGeometry} from './railing-geometry';
import {buildSpiralStairGeometry} from './spiral-stair-geometry';
import { buildBattlementGeometry,buildWallProfileGeometry,buildWallWalkGeometry } from './wall-profile-geometry';
import { wallWalkProfile,curvedCapSlices, mixedWallCap, wallTangent, footprint, wallFootprint, wallLength, type Slab, type BuildingPart, type PlanPoint, type Wall } from '@openlandcraft/core';

function prism(points: PlanPoint[], bottom: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.rotateX(-Math.PI/2); geometry.translate(0,bottom,0); return geometry;
}
/** Closed wall solids with actual empty apertures, including doors open at the base. */
export function buildWallGeometry(wall: Wall, walls: Wall[]): THREE.BufferGeometry {
  const body=buildWallBodyGeometry(wall.walk?{...wall,height:wallWalkProfile(wall).bottom}:wall,walls);if(!wall.battlements&&!wall.walk)return body;
  return mergeSolidGeometry([body,...(wall.walk?[buildWallWalkGeometry(wall,walls)]:[]),...(wall.battlements?[buildBattlementGeometry(wall,walls)]:[]),...(wall.walk?.railings?[buildRailingGeometry(wall)]:[])]);
}
function buildWallBodyGeometry(wall: Wall, walls: Wall[]): THREE.BufferGeometry {
  if(wall.curve||wall.openings?.some(o=>o.shape==='arch'))return buildWallProfileGeometry(wall,walls);
  const polygon=wallFootprint(wall,walls), openings=wall.openings??[], length=wallLength(wall);
  const shape=new THREE.Shape();shape.moveTo(0,0);
  for(const o of openings.filter(o=>o.sill===0).sort((a,b)=>a.offset-b.offset)){
    shape.lineTo(o.offset,0);shape.lineTo(o.offset,o.height);shape.lineTo(o.offset+o.width,o.height);shape.lineTo(o.offset+o.width,0);
  }
  shape.lineTo(length,0);shape.lineTo(length,wall.height);shape.lineTo(0,wall.height);shape.closePath();
  for(const o of openings.filter(o=>o.sill>0)){
    const hole=new THREE.Path();hole.moveTo(o.offset,o.sill);hole.lineTo(o.offset,o.sill+o.height);hole.lineTo(o.offset+o.width,o.sill+o.height);hole.lineTo(o.offset+o.width,o.sill);hole.closePath();shape.holes.push(hole);
  }
  const slices=curvedCapSlices(wall,walls),steps=slices.length-1,direction=wallTangent(wall,0);
  const offsets=(end:'start'|'end')=>slices.map(lateral=>{const t=lateral/wall.thickness+.5,p=mixedWallCap(wall,end,lateral,walls);return p?(p[0]-wall.start[0])*direction[0]+(p[1]-wall.start[1])*direction[1]:end==='start'?polygon[0][0]*(1-t)+polygon[3][0]*t:polygon[1][0]*(1-t)+polygon[2][0]*t;});
  const startOffsets=offsets('start'),endOffsets=offsets('end');
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:wall.thickness,bevelEnabled:false,steps,curveSegments:1});
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),slice=Math.max(0,Math.min(steps,Math.round(positions.getZ(i)/wall.thickness*steps))),lateral=slices[slice];
    if(Math.abs(x)<1e-5)positions.setX(i,startOffsets[slice]);
    if(Math.abs(x-length)<1e-5)positions.setX(i,endOffsets[slice]);
    positions.setZ(i,lateral+wall.thickness/2);
  }
  geometry.translate(0,wall.elevation,-wall.thickness/2);geometry.computeVertexNormals();
  const angle=Math.atan2(wall.end[1]-wall.start[1],wall.end[0]-wall.start[0]);
  geometry.rotateY(-angle);geometry.translate(wall.start[0],0,wall.start[1]);
  return geometry;
}
function stairExtras(part:Slab,body:THREE.BufferGeometry){
  const pads=Object.values(part.stairs!.landings??{}).map(p=>prism(p.points,p.base,p.elevation-p.base));
  return pads.length||part.stairs!.railings?mergeSolidGeometry([body,...pads,...(part.stairs!.railings?[buildRailingGeometry(part)]:[])]):body;
}
export function buildPartGeometry(part: BuildingPart, walls: Wall[]): THREE.BufferGeometry {
  if(part.kind==='wall')return buildWallGeometry(part,walls);
  if(part.kind==='slab'&&part.stairs){
    if(part.stairs.spiral){const geometry=buildSpiralStairGeometry(part);return stairExtras(part,geometry);}
    const {rise,steps,direction}=part.stairs,shape=new THREE.Shape();shape.moveTo(0,-part.thickness);shape.lineTo(0,rise/steps);
    for(let i=1;i<=steps;i++){shape.lineTo(part.depth*i/steps,rise*i/steps);if(i<steps)shape.lineTo(part.depth*i/steps,rise*(i+1)/steps);}
    shape.lineTo(part.depth,rise-part.thickness);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:part.width,bevelEnabled:false,steps:1,curveSegments:1});geometry.translate(-part.depth/2,0,-part.width/2);geometry.rotateY(-direction*Math.PI/180);geometry.translate(part.center[0],part.elevation,part.center[1]);return stairExtras(part,geometry);
  }
  if(part.kind==='roof'&&part.cone){const geometry=new THREE.ConeGeometry(part.cone.radius+part.cone.overhang,part.rise,120,1,false);geometry.translate(part.center[0],part.elevation+part.rise/2,part.center[1]);return geometry;}
  if(part.kind==='slab'&&part.stairOpenings?.length)return buildFloorGeometry(part);
  if(part.kind==='slab'||part.outline)return prism(footprint(part),part.elevation,part.kind==='slab'?part.thickness:part.rise);
  const shape=new THREE.Shape();shape.moveTo(-part.width/2,0);shape.lineTo(part.width/2,0);shape.lineTo(0,part.rise);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:part.depth,bevelEnabled:false});
  geometry.translate(part.center[0],part.elevation,part.center[1]-part.depth/2);return geometry;
}
