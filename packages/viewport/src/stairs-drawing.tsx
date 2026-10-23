import {useEffect,useMemo,useState} from 'react';
import {Line} from '@react-three/drei';
import {DoubleSide} from 'three';
import {createStairs,createSpiralStairs,spiralStairsForTower,drawingPoint,stairEndpoints,spiralPoint,type StairDrawingDimensions,type StairShape,type Wall,type Level,type PlanPoint} from '@openlandcraft/core';
import {buildPartGeometry} from './architecture-geometry';
import {ArchitectureLabel} from './architecture-label';

export function StairsDrawing({shape,tower,level,points,dimensions,offset,snapping,onPoint}:{shape:StairShape;tower?:Wall;level:Level;points:PlanPoint[];dimensions:StairDrawingDimensions;offset:number;snapping:boolean;onPoint:(x:number,z:number)=>void}){
  const [cursor,setCursor]=useState<PlanPoint|null>(null);
  const preview=useMemo(()=>{try{return {part:shape==='spiral'&&tower?spiralStairsForTower(tower,dimensions,0,'stairs-preview'):points[0]&&cursor?(shape==='spiral'?createSpiralStairs(level.id,points[0],cursor,dimensions,offset,snapping,'stairs-preview'):createStairs(level.id,points[0],cursor,dimensions,offset,snapping,'stairs-preview')):null,issue:''};}catch(error){return {part:null,issue:error instanceof Error?error.message:'Choose another direction.'};}},[shape,tower,level.id,JSON.stringify(points),JSON.stringify(cursor),JSON.stringify(dimensions),offset,snapping]);
  const geometry=useMemo(()=>preview.part?buildPartGeometry(preview.part,[]):null,[preview.part]);useEffect(()=>()=>geometry?.dispose(),[geometry]);
  const ends=preview.part?stairEndpoints(preview.part):null;
  return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true}}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,offset,0]} onPointerMove={e=>{e.stopPropagation();setCursor(drawingPoint(level,e.point.x,e.point.z));}} onPointerOut={()=>setCursor(null)} onClick={e=>{if(e.button===0&&e.delta<=4){e.stopPropagation();onPoint(e.point.x,e.point.z);}}}><planeGeometry args={[200,200]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide}/></mesh>
    {geometry&&<mesh geometry={geometry} raycast={()=>undefined}><meshBasicMaterial color="#e3b349" transparent opacity={.45} depthWrite={false} depthTest={false}/></mesh>}
    {ends&&<Line points={preview.part?.stairs?.spiral?Array.from({length:121},(_,i)=>{const p=spiralPoint(preview.part!,i/120);return [p[0],preview.part!.elevation+dimensions.rise*i/120+.1,p[1]] as [number,number,number];}):[[ends.start[0],offset+.1,ends.start[1]],[ends.end[0],offset+dimensions.rise+.1,ends.end[1]]]} color="#e3b349" depthTest={false} raycast={()=>undefined}/>}
    {points[0]&&<ArchitectureLabel position={[points[0][0],offset+.25,points[0][1]]} text={shape==='spiral'?'Center':'Lower start'}/>}
    {ends&&<ArchitectureLabel position={[ends.end[0],(preview.part?.elevation??offset)+dimensions.rise+.5,ends.end[1]]} text={`${dimensions.steps} steps · rise ${dimensions.rise.toFixed(2)} m · ${shape==='spiral'?'radius':'run'} ${(shape==='spiral'?dimensions.radius:dimensions.run).toFixed(2)} m`}/>}
    {preview.issue&&cursor&&<ArchitectureLabel position={[cursor[0],offset+.5,cursor[1]]} text={preview.issue}/>}
  </group>;
}
