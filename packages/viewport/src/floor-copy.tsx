import { useEffect, useMemo, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { isBuildingPart, ownerLevel, scopeBounds, type BuildingPart, type DuplicateAbove, type Project, type Wall } from '@openlandcraft/core';
import { buildPartGeometry } from './architecture-geometry';

function GhostPart({part,walls}: {part:BuildingPart;walls:Wall[]}){
  const geometry=useMemo(()=>buildPartGeometry(part,walls),[part,walls]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} raycast={()=>null} userData={{waterCaptureExclude:true}}><meshBasicMaterial color="#9cdece" transparent opacity={0.25} depthWrite={false}/><Edges color="#246958" lineWidth={1.5} raycast={()=>null}/></mesh>;
}
export function FloorCopyGhost({copy}:{copy:DuplicateAbove}){
  const hidden=new Set(copy.project.entities.flatMap(e=>e.kind==='unit'&&!e.visible?e.memberIds:[]));
  const ids=[...copy.addedIds,...copy.movedRoofIds],parts=copy.project.entities.filter((e):e is BuildingPart=>isBuildingPart(e)&&ids.includes(e.id)&&e.visible&&!hidden.has(e.id));
  const level=ownerLevel(copy.project,parts[0]?.id??null);
  const walls=useMemo(()=>parts.filter((p):p is Wall=>p.kind==='wall'),[copy]);
  if(!level)return null;
  return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true}}>{parts.map(p=><GhostPart key={p.id} part={p} walls={walls}/>)}</group>;
}
/** Keep accessible DOM controls beside the geometry without creating a second React root. */
export function FloorCopyAnchor({project,id,element}:{project:Project;id:string;element:RefObject<HTMLDivElement|null>}){
  const {camera,size}=useThree();
  const bounds=useMemo(()=>scopeBounds(project,id),[project,id]);
  const point=useMemo(()=>new THREE.Vector3(),[]);
  useFrame(()=>{
    if(!bounds||!element.current)return;
    point.set(bounds.max[0],bounds.max[1]+0.7,(bounds.min[2]+bounds.max[2])/2).project(camera);
    const x=Math.min(Math.max(14,(point.x+1)*size.width/2+14),Math.max(14,size.width-240));
    const y=Math.min(Math.max(122,(1-point.y)*size.height/2),Math.max(122,size.height-230));
    element.current.style.transform=`translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  });
  return null;
}
