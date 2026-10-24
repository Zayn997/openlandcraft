import {useEffect,useMemo,useState} from 'react';
import {DoubleSide} from 'three';
import {applyCommand,groundHeight,type Command,type Project,type TowerType} from '@openlandcraft/core';
import {buildPartGeometry} from './architecture-geometry';
import {ArchitectureLabel} from './architecture-label';
export type TowerDrawingProps={definition:TowerType;center:[number,number]|null;ready:boolean;snapping:boolean;assemblyId:string;commandAt:(at:[number,number],params?:TowerType)=>Command};
export function TowerDrawing({project,draft,onPoint}:{project:Project;draft:TowerDrawingProps;onPoint:(x:number,z:number)=>void}){
 const [cursor,setCursor]=useState<[number,number]|null>(null),center=draft.center??cursor;
 const preview=useMemo(()=>{if(!center)return null;try{let radius=draft.definition.radius;if(draft.center&&cursor&&!draft.ready){radius=Math.hypot(cursor[0]-center[0],cursor[1]-center[1]);if(draft.snapping)radius=Math.round(radius*4)/4;}const candidate=applyCommand(project,draft.commandAt(center,{...draft.definition,radius}));return {parts:candidate.entities.filter(e=>e.parentId===draft.assemblyId+'-level').filter(e=>e.kind==='wall'||e.kind==='slab'||e.kind==='roof'),radius};}catch{return null;}},[project,draft,cursor]);
 const geometries=useMemo(()=>preview?.parts.map(p=>({geometry:buildPartGeometry(p,[]),kind:p.kind}))??[],[preview]);useEffect(()=>()=>geometries.forEach(g=>g.geometry.dispose()),[geometries]);
 const y=(center?groundHeight(...center,project.site):groundHeight(0,0,project.site))+.2;
 return <group userData={{waterCaptureExclude:true}}><mesh rotation={[-Math.PI/2,0,0]} position={[0,groundHeight(0,0,project.site)+.02,0]} onPointerMove={e=>{e.stopPropagation();setCursor(draft.snapping?[Math.round(e.point.x*4)/4,Math.round(e.point.z*4)/4]:[e.point.x,e.point.z]);}} onPointerOut={()=>setCursor(null)} onClick={e=>{if(e.button===0&&e.delta<=4){e.stopPropagation();onPoint(e.point.x,e.point.z);}}}><planeGeometry args={[project.site.width,project.site.depth]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide}/></mesh>{center&&<group position={[center[0],y,center[1]]}>{geometries.map((g,i)=><mesh key={i} geometry={g.geometry} raycast={()=>undefined}><meshStandardMaterial color={g.kind==='roof'?'#7b8b83':'#dfca99'} transparent opacity={.55}/></mesh>)}<ArchitectureLabel position={[0,draft.definition.height+1,0]} text={preview?`Tower · radius ${preview.radius.toFixed(2)} m · ${draft.definition.floorCount} floors`:'Choose a valid tower size'}/></group>}</group>;
}
