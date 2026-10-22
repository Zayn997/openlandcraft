import { useEffect, useMemo, useRef, type RefObject } from 'react';
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
  const panelSize=useRef({width:220,height:120});
  useEffect(()=>{
    const panel=element.current;
    if(!panel)return;
    const observer=new ResizeObserver(([entry])=>{
      panelSize.current={width:entry.target.clientWidth,height:entry.target.clientHeight};
    });
    observer.observe(panel);
    return()=>observer.disconnect();
  },[element,id]);
  useFrame(()=>{
    const panel=element.current;
    if(!panel)return;
    if(!bounds){panel.style.visibility='hidden';return;}
    point.set(bounds.max[0],bounds.max[1]+0.7,(bounds.min[2]+bounds.max[2])/2).project(camera);
    panel.style.visibility=point.z < -1 || point.z > 1 ? 'hidden':'visible';
    const maxX=Math.max(14,size.width-panelSize.current.width-14);
    const x=Math.min(Math.max(Math.min(70,maxX),(point.x+1)*size.width/2+14),maxX);
    const y=Math.min(Math.max(14,(1-point.y)*size.height/2),Math.max(14,size.height-panelSize.current.height-14));
    panel.style.transform=`translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  });
  return null;
}
