import {useEffect,useMemo} from 'react';
import type {ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import {footprint,stairFloorTargets,stairWalkTargets,wallWalkProfile,wallPathPoint,type Slab,type Project,type Wall,type Level,type PlanPoint,type StairEnd} from '@openlandcraft/core';
export type StairAttachmentProps={end:StairEnd;surface:'terrain'|'floor'|'walk';stairId:string;ready:boolean;onPick:(point:PlanPoint,wallId?:string)=>void};
function WalkTarget({wall,level,onPick}:{wall:Wall;level:Level;onPick:StairAttachmentProps['onPick']}){
 const geometry=useMemo(()=>{
  const {inner,outer,side,deckTop}=wallWalkProfile(wall),n=wall.curve?Math.ceil(Math.abs(wall.curve.sweepAngle)/3):1,vertices:number[]=[];
  for(let i=0;i<n;i++){const points=[wallPathPoint(wall,i/n,side*outer),wallPathPoint(wall,(i+1)/n,side*outer),wallPathPoint(wall,(i+1)/n,side*inner),wallPathPoint(wall,i/n,side*inner)];for(const j of [0,1,2,0,2,3])vertices.push(points[j][0],wall.elevation+deckTop+.04,points[j][1]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
 },[wall]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const click=(e:ThreeEvent<MouseEvent>)=>{if(e.button!==0||e.delta>4)return;e.stopPropagation();onPick([e.point.x,e.point.z],wall.id);};
 return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]}><mesh geometry={geometry} renderOrder={20} onPointerDown={e=>e.stopPropagation()} onClick={click}><meshBasicMaterial color="#a8e9b4" transparent opacity={.55} side={THREE.DoubleSide} depthTest={false} depthWrite={false}/></mesh></group>;
}
function FloorTarget({floor,level,onPick}:{floor:Slab;level:Level;onPick:StairAttachmentProps['onPick']}){
 const geometry=useMemo(()=>{const g=new THREE.ShapeGeometry(new THREE.Shape(footprint(floor).map(([x,z])=>new THREE.Vector2(x,-z))));g.rotateX(-Math.PI/2);g.translate(0,floor.elevation+floor.thickness+.04,0);return g;},[floor]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]}><mesh geometry={geometry} renderOrder={20} onPointerDown={e=>e.stopPropagation()} onClick={e=>{if(e.button!==0||e.delta>4)return;e.stopPropagation();onPick([e.point.x,e.point.z],floor.id);}}><meshBasicMaterial color="#9bceec" transparent opacity={.5} side={THREE.DoubleSide} depthWrite={false}/></mesh></group>;
}
export function StairAttachmentTargets({project,attachment,isolatedLayerId}:{project:Project;attachment:StairAttachmentProps;isolatedLayerId?:string|null}){
 if(attachment.end==='bottom'&&attachment.surface!=='floor')return null;
 const surfaces=stairFloorTargets(project,isolatedLayerId);
 return <>{surfaces.map(f=>{const level=project.entities.find((e):e is Level=>e.kind==='level'&&e.id===f.parentId);return level?<FloorTarget key={f.id} floor={f} level={level} onPick={attachment.onPick}/>:null;})}{attachment.end==='top'&&stairWalkTargets(project,attachment.stairId,isolatedLayerId).map(w=>{const level=project.entities.find((e):e is Level=>e.kind==='level'&&e.id===w.parentId);return level?<WalkTarget key={w.id} wall={w} level={level} onPick={attachment.onPick}/>:null;})}</>;
}
