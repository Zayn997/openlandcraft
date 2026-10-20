import {ArchitectureLabel} from './architecture-label';
import { Line } from '@react-three/drei';
import { architectureIssue, createWallChain, drawingPoint, snapWallPoint, type Project, type Level, type PlanPoint, type Wall } from '@openlandcraft/core';
import { useEffect, useMemo, useState } from 'react';
import { DoubleSide } from 'three';
import { buildWallGeometry } from './architecture-geometry';

function DraftWall({wall,walls,invalid}:{wall:Wall;walls:Wall[];invalid:boolean}) {
  const geometry=useMemo(()=>buildWallGeometry(wall,walls),[wall,walls]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} raycast={()=>undefined}><meshBasicMaterial color={invalid?'#ed7770':'#e3b349'} transparent opacity={0.4} depthWrite={false} depthTest={false}/></mesh>;
}

export function ArchitectureDrawing({project,level,points,onPoint,kind,offset,thickness,snapping,walls}:{project:Project;level:Level;points:PlanPoint[];onPoint:(x:number,z:number)=>void;kind:'wall'|'floor'|'roof';offset:number;thickness:number;snapping:boolean;walls:Wall[]}) {
  const [cursor,setCursor]=useState<PlanPoint|null>(null);
  const next=cursor?(snapping?snapWallPoint(cursor,walls,points.at(-1)):cursor):null;
  const last=points.at(-1);
  const extendsDraft=next&&(!last||Math.hypot(next[0]-last[0],next[1]-last[1])>=0.2);
  const path=extendsDraft?[...points,next]:points;
  const height=offset+0.08;
  const preview=useMemo(()=>{
    if(kind!=='wall'||path.length<2)return {walls:[],all:walls,issue:''};
    const closes=path.length>3&&Math.hypot(path.at(-1)![0]-path[0][0],path.at(-1)![1]-path[0][1])<0.2;
    const draft=closes?path.slice(0,-1):path;
    if(draft.some((p,i)=>i>0&&Math.hypot(p[0]-draft[i-1][0],p[1]-draft[i-1][1])<0.2))return {walls:[],all:walls,issue:''};
    try {
      const created=createWallChain(project,level.id,draft,closes,'wall-preview',false,thickness),all=[...walls,...created];
      return {walls:created,all,issue:architectureIssue([...project.entities,...created])??''};
    } catch(error) { return {walls:[],all:walls,issue:error instanceof Error?error.message:'Cannot join this wall.'}; }
  },[project,level.id,kind,JSON.stringify(path),thickness]);
  return <group userData={{waterCaptureExclude:true}} position={level.position} rotation={[0,level.rotation*Math.PI/180,0]}>
    <mesh position={[0,offset,0]} rotation={[-Math.PI/2,0,0]} onPointerMove={e=>{e.stopPropagation();setCursor(drawingPoint(level,e.point.x,e.point.z));}} onPointerOut={()=>setCursor(null)} onClick={e=>{if(e.button===0&&e.delta<=4){e.stopPropagation();onPoint(e.point.x,e.point.z);}}}>
      <planeGeometry args={[200,200]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide}/>
    </mesh>
    {preview.walls.map(wall=><DraftWall key={wall.id} wall={wall} walls={preview.all} invalid={!!preview.issue}/>)}
    {path.length>1&&<Line points={path.map(p=>[p[0],height,p[1]])} color="#e3b349" lineWidth={3} depthTest={false} raycast={()=>undefined}/>}
    {kind!=='wall'&&path.length>2&&<Line points={[[path.at(-1)![0],height,path.at(-1)![1]],[path[0][0],height,path[0][1]]]} color="#e3b349" lineWidth={1} dashed dashSize={0.3} gapSize={0.2} depthTest={false} raycast={()=>undefined}/>}
    {next&&<mesh position={[next[0],height,next[1]]} rotation={[-Math.PI/2,0,0]} raycast={()=>undefined}><ringGeometry args={[0.08,0.14,24]}/><meshBasicMaterial color="#e3b349" depthTest={false} side={DoubleSide}/></mesh>}
    {last&&next&&extendsDraft&&<ArchitectureLabel position={[(last[0]+next[0])/2,height+0.08,(last[1]+next[1])/2]} text={`${Math.hypot(next[0]-last[0],next[1]-last[1]).toFixed(2)} m`}/>}
    {preview.issue&&next&&<ArchitectureLabel position={[next[0],height+0.2,next[1]]} text={preview.issue}/>}
    {points.map((p,i)=><ArchitectureLabel key={i} position={[p[0],height+0.04,p[1]]} text={String(i+1)}/>)}
  </group>;
}
