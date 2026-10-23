import { useEffect, useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import { DoubleSide } from 'three';
import { architectureIssue, connectCurvedWall, snapCurveDrawingPoint, createCurvedWall, drawingPoint, type Level, type PlanPoint, type Project, type Wall } from '@openlandcraft/core';
import { buildWallGeometry } from './architecture-geometry';
import { ArchitectureLabel } from './architecture-label';

export function CurvedWallDrawing({project,level,points,shape,thickness,height,offset,clockwise,snapping,onPoint}:{project:Project;level:Level;points:PlanPoint[];shape:'arc'|'circle';thickness:number;height:number;offset:number;clockwise:boolean;snapping:boolean;onPoint:(x:number,z:number)=>void}){
  const [cursor,setCursor]=useState<PlanPoint|null>(null);
  const walls=project.entities.filter((e):e is Wall=>e.kind==='wall'&&e.parentId===level.id&&!!e.joins);
  const next=cursor?snapCurveDrawingPoint(cursor,points,walls,snapping):undefined;
  const path=next?[...points,next]:points;
  const preview=useMemo(()=>{
    if(path.length<(shape==='circle'?2:3))return null;
    try{const wall=connectCurvedWall(project,createCurvedWall(level.id,shape,path,thickness,height,clockwise,offset,'curve-preview'));return {wall,issue:architectureIssue([...project.entities,wall])};}
    catch(error){return {wall:null,issue:error instanceof Error?error.message:'Choose another point.'};}
  },[project,level.id,shape,JSON.stringify(path),thickness,height,clockwise,offset]);
  const geometry=useMemo(()=>preview?.wall?buildWallGeometry(preview.wall,[...walls,preview.wall]):null,[preview]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true}}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,offset,0]}
      onPointerMove={e=>{e.stopPropagation();setCursor(drawingPoint(level,e.point.x,e.point.z));}} onPointerOut={()=>setCursor(null)}
      onClick={e=>{if(e.button===0&&e.delta<=4){e.stopPropagation();onPoint(e.point.x,e.point.z);}}}>
      <planeGeometry args={[200,200]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide}/>
    </mesh>
    {geometry&&<mesh geometry={geometry} raycast={()=>undefined}><meshBasicMaterial color={preview?.issue?'#ed7770':'#e3b349'} transparent opacity={0.4} depthWrite={false} depthTest={false}/></mesh>}
    {path.length>1&&<Line points={[[path[0][0],offset+0.1,path[0][1]],[path.at(-1)![0],offset+0.1,path.at(-1)![1]]]} raycast={()=>undefined} color="#e3b349" dashed dashSize={0.3} gapSize={0.2} depthTest={false}/>}
    {points[0]&&<ArchitectureLabel position={[points[0][0],offset+0.2,points[0][1]]} text="Center"/>}
    {next&&<ArchitectureLabel position={[next[0],offset+height+0.4,next[1]]} text={preview?.issue??(preview?.wall?.curve?`R ${preview.wall.curve.radius.toFixed(2)} m · ${Math.abs(preview.wall.curve.sweepAngle).toFixed(1)}°`:points.length?'Click to set radius / start':'Click center')}/>}
  </group>;
}
