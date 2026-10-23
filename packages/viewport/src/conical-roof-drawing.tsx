import {useEffect,useMemo,useState} from 'react';
import {Line} from '@react-three/drei';
import {DoubleSide} from 'three';
import {conicalRoofForTower,createConicalRoof,drawingPoint,snapRoofDrawingPoint,type Level,type PlanPoint,type Wall} from '@openlandcraft/core';
import {buildPartGeometry} from './architecture-geometry';
import {ArchitectureLabel} from './architecture-label';

export function ConicalRoofDrawing({level,points,height,overhang,offset,snapping,tower,onPoint}:{level:Level;points:PlanPoint[];height:number;overhang:number;offset:number;snapping:boolean;tower?:Wall;onPoint:(x:number,z:number)=>void}){
  const [cursor,setCursor]=useState<PlanPoint|null>(null),next=cursor?snapRoofDrawingPoint(cursor,points,snapping):undefined,path=next?[...points,next]:points;
  const preview=useMemo(()=>{try{return {roof:tower?conicalRoofForTower(tower,height,overhang,'roof-preview'):path.length===2?createConicalRoof(level.id,path,height,overhang,offset,'roof-preview'):null,issue:''};}catch(error){return {roof:null,issue:error instanceof Error?error.message:'Choose another roof radius.'};}},[tower,level.id,height,overhang,offset,JSON.stringify(path)]);
  const geometry=useMemo(()=>preview.roof?buildPartGeometry(preview.roof,[]):null,[preview.roof]);useEffect(()=>()=>geometry?.dispose(),[geometry]);
  return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true}}>
    {!tower&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,offset,0]} onPointerMove={e=>{e.stopPropagation();setCursor(drawingPoint(level,e.point.x,e.point.z));}} onPointerOut={()=>setCursor(null)} onClick={e=>{if(e.button===0&&e.delta<=4){e.stopPropagation();onPoint(e.point.x,e.point.z);}}}><planeGeometry args={[200,200]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide}/></mesh>}
    {geometry&&<mesh geometry={geometry} raycast={()=>undefined}><meshBasicMaterial color="#e3b349" transparent opacity={.45} depthWrite={false} depthTest={false}/></mesh>}
    {!tower&&path.length===2&&<Line points={path.map(p=>[p[0],offset+.1,p[1]])} color="#e3b349" depthTest={false} raycast={()=>undefined}/>}
    {!tower&&points[0]&&<ArchitectureLabel position={[points[0][0],offset+.2,points[0][1]]} text="Center"/>}
    {preview.roof&&<ArchitectureLabel position={[preview.roof.center[0],preview.roof.elevation+height+.5,preview.roof.center[1]]} text={`R ${preview.roof.cone!.radius.toFixed(2)} m · height ${height.toFixed(2)} m · overhang ${overhang.toFixed(2)} m`}/>}
    {preview.issue&&(next||tower?.curve?.center)&&<ArchitectureLabel position={[(next??tower!.curve!.center)[0],offset+height+.5,(next??tower!.curve!.center)[1]]} text={preview.issue}/>}
  </group>;
}
