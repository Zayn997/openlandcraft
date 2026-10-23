import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree,useFrame, type ThreeEvent,type ThreeElements } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { spiralPoint,stairEndpoints,stairAxes,dragOutline, footprint,roofEavesRadius, type Editor, type Level, type OutlinePart, type OutlineDragMode } from '@openlandcraft/core';
import { buildPartGeometry } from './architecture-geometry';
import { ArchitectureLabel } from './architecture-label';
import {worldUnitsPerPixel} from './camera-projection';
export type OutlineHandle = { mode: 'vertex' | 'edge'; index: number };
export type OutlineEditProps = { part: OutlinePart; level: Level; handle: OutlineHandle; onHandle: (handle: OutlineHandle) => void; onStatus: (message: string) => void };
type Drag = { part: OutlinePart; mode: OutlineDragMode; index: number; pointer: number; plane: THREE.Plane; origin: THREE.Vector3; screen: [number, number]; moved: boolean; valid: boolean; changed: boolean; release: () => void };
type GripEvents=Pick<ThreeElements['mesh'],'onPointerMove'|'onPointerUp'|'onPointerCancel'|'onLostPointerCapture'|'onClick'|'onDoubleClick'>;
/** Keep stair grips and label clearance usable when framing a long flight. */
function StairGrip({position,label,color,events,onDown}:{position:[number,number,number];label:string;color:string;events:GripEvents;onDown:(e:ThreeEvent<PointerEvent>)=>void}){
  const group=useRef<THREE.Group>(null),mesh=useRef<THREE.Mesh>(null),anchor=useRef<THREE.Group>(null);
  const temp=useMemo(()=>({point:new THREE.Vector3(),up:new THREE.Vector3(),rotation:new THREE.Quaternion()}),[]);
  useFrame(({camera,size})=>{
    if(!group.current||!mesh.current||!anchor.current)return;
    group.current.getWorldPosition(temp.point);const unit=worldUnitsPerPixel(camera,temp.point,size.height);
    mesh.current.scale.setScalar(unit*7);
    const labelOffset=label==='Width'?-24:label==='Rise'?52:24;
    group.current.getWorldQuaternion(temp.rotation).invert();temp.up.set(0,1,0).applyQuaternion(camera.quaternion).applyQuaternion(temp.rotation).multiplyScalar(unit*labelOffset);anchor.current.position.copy(temp.up);
  });
  return <group ref={group} position={position}><mesh ref={mesh} {...events} onPointerDown={onDown}><sphereGeometry args={[1,16,12]}/><meshBasicMaterial color={color} depthTest={false}/></mesh><group ref={anchor}><ArchitectureLabel position={[0,0,0]} text={label}/></group></group>;
}
export function OutlineEdit({ part, level, handle, onHandle, editor, snapping, topView, onStatus }: OutlineEditProps & { editor: Editor; snapping: boolean; topView: boolean }) {
  const { gl,camera }=useThree(), orbit=useThree(s=>s.controls) as unknown as {enabled:boolean}|null;
  const active=useRef<Drag|null>(null), [rejected,setRejected]=useState(false);
  const geometry=useMemo(()=>buildPartGeometry(part,[]),[part]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const cancel=()=>{const drag=active.current;active.current=null;if(!drag)return;editor.cancel();drag.release();if(orbit)orbit.enabled=true;setRejected(false);};
  useEffect(()=>{const unsubscribe=editor.subscribe(()=>{if(active.current&&!editor.getSnapshot().gestureLabel)cancel();});window.addEventListener('blur',cancel);gl.domElement.addEventListener('pointercancel',cancel);return()=>{unsubscribe();window.removeEventListener('blur',cancel);gl.domElement.removeEventListener('pointercancel',cancel);cancel();};},[editor,gl,orbit]);
  const down=(event:ThreeEvent<PointerEvent>,mode:OutlineDragMode,index=0)=>{
    if(event.button!==0||active.current||editor.getSnapshot().gestureLabel)return;event.stopPropagation();
    if(part.kind==='slab'&&part.stairs&&(part.stairs.connections?.top&&['move','run','height'].includes(mode)||part.stairs.connections?.bottom&&mode==='move')){onStatus('Use Reattach bottom or Reattach top to move the connection, or detach it first.');return;}
    if(part.kind==='roof'&&part.cone?.wallId&&(mode==='move'||mode==='radius')){onStatus('Move or resize the tower, or detach the roof in Properties. Height and Overhang stay editable.');return;}
    if(mode==='vertex'||mode==='edge')onHandle({mode,index});
    if(mode==='height'&&topView){onStatus(part.kind==='slab'&&part.stairs?'Use Total rise in Properties, or orbit into 3D to drag Rise.':'Use Roof height in Properties, or orbit into 3D to drag the apex.');return;}
    if(mode!=='height'&&Math.abs(event.ray.direction.y)<0.03){onStatus('Tilt the view down to edit on the horizontal outline plane.');return;}
    const normal=mode==='height'?camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize():new THREE.Vector3(0,1,0);
    if(normal.lengthSq()<1e-6){onStatus('Orbit slightly to drag the height.');return;}
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,event.point),origin=event.ray.intersectPlane(plane,new THREE.Vector3());if(!origin)return;
    const target=event.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};
    if(orbit)orbit.enabled=false;target.setPointerCapture(event.pointerId);
    active.current={part,mode,index,pointer:event.pointerId,plane,origin,screen:[event.clientX,event.clientY],moved:false,valid:true,changed:false,release:()=>{try{target.releasePointerCapture(event.pointerId);}catch{/* Already released. */}}};
    const subject=part.kind==='slab'&&part.stairs?'stairs':part.kind==='roof'&&part.cone?'roof':'outline';editor.begin(mode==='move'?'Move '+subject:'Edit '+subject+' '+mode);setRejected(false);
  };
  const move=(event:ThreeEvent<PointerEvent>)=>{
    const drag=active.current;if(!drag||drag.pointer!==event.pointerId)return;event.stopPropagation();
    if(!drag.moved&&Math.hypot(event.clientX-drag.screen[0],event.clientY-drag.screen[1])<4)return;drag.moved=true;
    try{
      if(drag.mode!=='height'&&Math.abs(event.ray.direction.y)<0.03)throw new Error('Keep the pointer on the outline plane.');
      const point=event.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!point)throw new Error('Keep the pointer on the outline plane.');
      const delta=point.sub(drag.origin).applyAxisAngle(new THREE.Vector3(0,1,0),-level.rotation*Math.PI/180);
      const next=dragOutline(drag.part,drag.mode,drag.index,drag.mode==='height'?[delta.y,0]:[delta.x,delta.z],snapping);
      editor.preview({type:'replace',entity:next});drag.valid=true;drag.changed=JSON.stringify(next)!==JSON.stringify(drag.part);setRejected(false);onStatus('Previewing '+(drag.part.kind==='roof'&&drag.part.cone?'roof '+(drag.mode==='move'?'movement':drag.mode):drag.mode==='move'?'outline movement':drag.mode+' '+(drag.index+1))+'. Release to apply; Escape cancels.');
    }catch(error){drag.valid=false;setRejected(true);onStatus((error instanceof Error?error.message:'Invalid outline.')+' Release here cancels the entire drag.');}
  };
  const up=(event:ThreeEvent<PointerEvent>)=>{
    const drag=active.current;if(!drag||drag.pointer!==event.pointerId)return;move(event);event.stopPropagation();active.current=null;
    const subject=drag.part.kind==='slab'&&drag.part.stairs?'Stairs':drag.part.kind==='roof'&&drag.part.cone?'Roof':'Outline';if(drag.valid&&drag.changed){editor.commit();onStatus(subject+' updated. Each completed drag is one undo step.');}else{editor.cancel();onStatus(drag.valid?subject+' unchanged.':'Drag cancelled. Original '+subject.toLowerCase()+' restored.');}
    drag.release();if(orbit)orbit.enabled=true;setRejected(false);
  };
  const events={onPointerMove:move,onPointerUp:up,onPointerCancel:cancel,onLostPointerCapture:cancel,onClick:(e:ThreeEvent<MouseEvent>)=>e.stopPropagation(),onDoubleClick:(e:ThreeEvent<MouseEvent>)=>e.stopPropagation()};
  const points=footprint(part),color=rejected?'#ed775f':'#d7f29c';
  if(part.kind==='slab'&&part.stairs){
    if(part.stairs.spiral){
      const {radius}=part.stairs.spiral,[cx,cz]=part.center,base=part.elevation,rise=part.stairs.rise;
      const handles:{mode:OutlineDragMode;position:[number,number,number];label:string}[]=[{mode:'move',position:[cx,base+.2,cz],label:'Center'},{mode:'radius',position:[cx+radius,base+rise+.3,cz],label:'Radius'},{mode:'width',position:[cx,base+rise/2+.3,cz+radius-part.width],label:'Width'},{mode:'height',position:[cx,base+rise+.4,cz],label:'Rise'}];
      const path=Array.from({length:121},(_,i)=>{const p=spiralPoint(part,i/120);return [p[0],base+rise*i/120+.06,p[1]] as [number,number,number];});
      return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true,copyEntityId:part.id}}>
        <mesh geometry={geometry} {...events} onPointerDown={e=>down(e,'move')}><meshBasicMaterial color={color} transparent opacity={.2} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>
        <Line points={path} color={color} lineWidth={2} depthTest={false} raycast={()=>undefined}/>
        {handles.filter(h=>!(part.kind==='slab'&&part.stairs?.connections?.top&&['move','run','height'].includes(h.mode)||part.kind==='slab'&&part.stairs?.connections?.bottom&&h.mode==='move')).map(h=><StairGrip key={h.mode} position={h.position} label={h.label} color={rejected?color:'#f6d49a'} events={events} onDown={e=>down(e,h.mode)}/>)}
      </group>;
    }
    const {start,end}=stairEndpoints(part),{across}=stairAxes(part),base=part.elevation,rise=part.stairs.rise;
    const handles:{mode:OutlineDragMode;position:[number,number,number];label:string}[]=[
      {mode:'run',position:[end[0],base+rise+.2,end[1]],label:'Run / direction'},
      {mode:'width',position:[part.center[0]+across[0]*part.width/2,base+rise/2+.25,part.center[1]+across[1]*part.width/2],label:'Width'},
      {mode:'height',position:[end[0]+across[0]*(part.width/2+1.2),base+rise+.5,end[1]+across[1]*(part.width/2+1.2)],label:'Rise'},
    ];
    return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true,copyEntityId:part.id}}>
      <mesh geometry={geometry} {...events} onPointerDown={e=>down(e,'move')}><meshBasicMaterial color={color} transparent opacity={.2} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>
      <Line points={[[start[0],base+.05,start[1]],[end[0],base+rise+.05,end[1]]]} color={color} lineWidth={2} depthTest={false} raycast={()=>undefined}/>
      {handles.filter(h=>!(part.kind==='slab'&&part.stairs?.connections?.top&&['move','run','height'].includes(h.mode)||part.kind==='slab'&&part.stairs?.connections?.bottom&&h.mode==='move')).map(h=><StairGrip key={h.mode} position={h.position} label={h.label} color={rejected?color:'#f6d49a'} events={events} onDown={e=>down(e,h.mode)}/>)}
      <ArchitectureLabel position={[start[0],base+.35,start[1]]} text="Lower start"/>
    </group>;
  }
  if(part.kind==='roof'&&part.cone){
    const radius=roofEavesRadius(part),[cx,cz]=part.center,base=part.elevation,handles:{mode:OutlineDragMode;position:[number,number,number];label:string}[]=[
      ...(!part.cone.wallId?[{mode:'radius' as const,position:[cx+part.cone.radius,base+part.rise*(1-part.cone.radius/radius)+.22,cz] as [number,number,number],label:'Radius'}]:[]),
      {mode:'overhang',position:[cx,base+.22,cz+radius],label:'Overhang'},
      {mode:'height',position:[cx,base+part.rise+.22,cz],label:'Height'},
    ];
    const boundary=points.map(([x,z])=>[x,base+.04,z] as [number,number,number]);
    return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true,copyEntityId:part.id}}>
      <mesh geometry={geometry} {...events} onPointerDown={e=>down(e,'move')}><meshBasicMaterial color={color} transparent opacity={.2} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>
      <Line points={[...boundary,boundary[0]]} color={color} lineWidth={2} depthTest={false} raycast={()=>undefined}/>
      {handles.map(h=><group key={h.mode}><mesh position={h.position} {...events} onPointerDown={e=>down(e,h.mode)}><sphereGeometry args={[.22,16,12]}/><meshBasicMaterial color={rejected?color:'#f6d49a'} depthTest={false}/></mesh><ArchitectureLabel position={[h.position[0],h.position[1]+.55,h.position[2]]} text={h.label}/></group>)}
    </group>;
  }
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
