import {ArchitectureLabel} from './architecture-label';
import { Line } from '@react-three/drei';
import type { Level, PlanPoint } from '@openlandcraft/core';
import { DoubleSide } from 'three';

export function ArchitectureDrawing({level,points,onPoint}:{level:Level;points:PlanPoint[];onPoint:(x:number,z:number)=>void}) {
  return <group userData={{waterCaptureExclude:true}} position={level.position} rotation={[0,level.rotation*Math.PI/180,0]}>
    <mesh rotation={[-Math.PI/2,0,0]} onClick={e=>{if(e.delta<=4){e.stopPropagation();onPoint(e.point.x,e.point.z);}}}>
      <planeGeometry args={[200,200]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide}/>
    </mesh>
    {points.length>1&&<Line points={points.map(p=>[p[0],0.08,p[1]])} color="#e3b349" lineWidth={3} depthTest={false} raycast={()=>undefined}/>}
    {points.map((p,i)=><ArchitectureLabel key={i} position={[p[0],0.12,p[1]]} text={String(i+1)}/>)}
  </group>;
}
