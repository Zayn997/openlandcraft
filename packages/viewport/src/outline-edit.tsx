import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { dragOutline, footprint, type Editor, type Level, type OutlinePart, type OutlineDragMode } from '@openlandcraft/core';
import { buildPartGeometry } from './architecture-geometry';
import { ArchitectureLabel } from './architecture-label';
export type OutlineHandle = { mode: 'vertex' | 'edge'; index: number };
export type OutlineEditProps = { part: OutlinePart; level: Level; handle: OutlineHandle; onHandle: (handle: OutlineHandle) => void; onStatus: (message: string) => void };
type Drag = { part: OutlinePart; mode: OutlineDragMode; index: number; pointer: number; plane: THREE.Plane; origin: THREE.Vector3; screen: [number, number]; moved: boolean; valid: boolean; changed: boolean; release: () => void };
export function OutlineEdit({ part, level, handle, onHandle, editor, snapping, topView, onStatus }: OutlineEditProps & { editor: Editor; snapping: boolean; topView: boolean }) {
  const { gl }=useThree(), orbit=useThree(s=>s.controls) as unknown as {enabled:boolean}|null;
  const active=useRef<Drag|null>(null), [rejected,setRejected]=useState(false);
  const geometry=useMemo(()=>buildPartGeometry(part,[]),[part]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const cancel=()=>{const drag=active.current;active.current=null;if(!drag)return;editor.cancel();drag.release();if(orbit)orbit.enabled=true;setRejected(false);};
  useEffect(()=>{const unsubscribe=editor.subscribe(()=>{if(active.current&&!editor.getSnapshot().gestureLabel)cancel();});window.addEventListener('blur',cancel);gl.domElement.addEventListener('pointercancel',cancel);return()=>{unsubscribe();window.removeEventListener('blur',cancel);gl.domElement.removeEventListener('pointercancel',cancel);cancel();};},[editor,gl,orbit]);
  const down=(event:ThreeEvent<PointerEvent>,mode:OutlineDragMode,index=0)=>{
    if(event.button!==0||active.current||editor.getSnapshot().gestureLabel)return;event.stopPropagation();
    if(mode!=='move')onHandle({mode,index});
    if(Math.abs(event.ray.direction.y)<0.03){onStatus('Tilt the view down to edit on the horizontal outline plane.');return;}
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-event.point.y),origin=event.ray.intersectPlane(plane,new THREE.Vector3());if(!origin)return;
    const target=event.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};
    if(orbit)orbit.enabled=false;target.setPointerCapture(event.pointerId);
    active.current={part,mode,index,pointer:event.pointerId,plane,origin,screen:[event.clientX,event.clientY],moved:false,valid:true,changed:false,release:()=>{try{target.releasePointerCapture(event.pointerId);}catch{/* Already released. */}}};
    editor.begin(mode==='move'?'Move outline':'Edit outline '+mode);setRejected(false);
  };
  const move=(event:ThreeEvent<PointerEvent>)=>{
    const drag=active.current;if(!drag||drag.pointer!==event.pointerId)return;event.stopPropagation();
    if(!drag.moved&&Math.hypot(event.clientX-drag.screen[0],event.clientY-drag.screen[1])<4)return;drag.moved=true;
    try{
      if(Math.abs(event.ray.direction.y)<0.03)throw new Error('Keep the pointer on the outline plane.');
      const point=event.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!point)throw new Error('Keep the pointer on the outline plane.');
      const delta=point.sub(drag.origin).applyAxisAngle(new THREE.Vector3(0,1,0),-level.rotation*Math.PI/180);
      const next=dragOutline(drag.part,drag.mode,drag.index,[delta.x,delta.z],snapping);
      editor.preview({type:'replace',entity:next});drag.valid=true;drag.changed=JSON.stringify(next)!==JSON.stringify(drag.part);setRejected(false);onStatus('Previewing '+(drag.mode==='move'?'outline movement':drag.mode+' '+(drag.index+1))+'. Release to apply; Escape cancels.');
    }catch(error){drag.valid=false;setRejected(true);onStatus((error instanceof Error?error.message:'Invalid outline.')+' Release here cancels the entire drag.');}
  };
  const up=(event:ThreeEvent<PointerEvent>)=>{
    const drag=active.current;if(!drag||drag.pointer!==event.pointerId)return;move(event);event.stopPropagation();active.current=null;
    if(drag.valid&&drag.changed){editor.commit();onStatus('Outline updated. Each completed drag is one undo step.');}else{editor.cancel();onStatus(drag.valid?'Outline unchanged.':'Drag cancelled. Original outline restored.');}
    drag.release();if(orbit)orbit.enabled=true;setRejected(false);
  };
  const events={onPointerMove:move,onPointerUp:up,onPointerCancel:cancel,onLostPointerCapture:cancel,onClick:(e:ThreeEvent<MouseEvent>)=>e.stopPropagation(),onDoubleClick:(e:ThreeEvent<MouseEvent>)=>e.stopPropagation()};
  const points=footprint(part),color=rejected?'#ed775f':'#d7f29c';
  const heightAt=(x:number)=>part.elevation+(part.kind==='slab'?part.thickness:part.outline?part.rise:part.rise*Math.max(0,1-Math.abs(x-part.center[0])/(part.width/2)));
  const boundary=points.flatMap((p,i)=>{const q=points[(i+1)%points.length],x=(p[0]+q[0])/2,z=(p[1]+q[1])/2;return [[p[0],heightAt(p[0])+0.05,p[1]],[x,heightAt(x)+0.05,z]] as [number,number,number][];});
  return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true,copyEntityId:part.id}}>
    <mesh geometry={geometry} {...events} onPointerDown={e=>down(e,'move')}><meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>
    <Line points={[...boundary,boundary[0]]} color={color} lineWidth={2} depthTest={false} raycast={()=>undefined}/>
    {points.map((p,i)=>{const q=points[(i+1)%points.length],x=(p[0]+q[0])/2;return <group key={i}>
      <mesh position={[p[0],heightAt(p[0])+0.22,p[1]]} {...events} onPointerDown={e=>down(e,'vertex',i)}><sphereGeometry args={[0.22,16,12]}/><meshBasicMaterial color={rejected?color:handle.mode==='vertex'&&handle.index===i?'#ffffff':'#f6d49a'} depthTest={false}/></mesh>
      <ArchitectureLabel position={[p[0],heightAt(p[0])+0.7,p[1]+(topView?0.65:0)]} text={String(i+1)}/>
      <mesh position={[x,heightAt(x)+0.20,(p[1]+q[1])/2]} {...events} onPointerDown={e=>down(e,'edge',i)}><boxGeometry args={[0.3,0.22,0.3]}/><meshBasicMaterial color={rejected?color:handle.mode==='edge'&&handle.index===i?'#ffffff':'#a8d9d5'} depthTest={false}/></mesh>
    </group>;})}
  </group>;
}
