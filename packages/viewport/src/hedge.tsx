import {useEffect,useMemo,useRef,type ReactNode} from 'react';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import {hedgeTop,type Editor,type Hedge,type Project} from '@openlandcraft/core';
import {hedgeShapeIssue,type PathPoint} from '@openlandcraft/landscape';
import {buildHedgeGeometry,hedgeMaterial} from './hedge-geometry';
import {PointNumber} from './river';
import {PathCornerPopover} from './path-corner-popover';
import {useDrawingClick} from './drawing-gesture';

export function HedgeLayer({hedge,project,editor,selected,enabled,snapping,onSelect,onError,draft=false,selectedAnchor,onAnchorSelect,cornerControls}:{hedge:Hedge;project:Project;editor:Editor;selected:boolean;enabled:boolean;snapping:boolean;onSelect:(id:string)=>void;onError:(s:string)=>void;draft?:boolean;selectedAnchor?:number|null;onAnchorSelect?:(i:number)=>void;cornerControls?:ReactNode}){
 const geometry=useMemo(()=>buildHedgeGeometry(hedge,project.site),[hedge,project.site]),material=useMemo(()=>hedgeMaterial(hedge),[hedge.color,hedge.leafSize,hedge.roughness]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
 const orbit=useThree(s=>s.controls) as unknown as {enabled:boolean}|null,allowed=useRef(enabled);allowed.current=enabled;
 const active=useRef<{hedge:Hedge;index:number;pointer:number;valid:boolean;start:[number,number];moved:boolean;release:()=>void}|null>(null);
 const cancel=()=>{const a=active.current;active.current=null;if(a){a.release();editor.cancel();if(orbit)orbit.enabled=allowed.current;}};
 useEffect(()=>{const off=editor.subscribe(()=>{if(!editor.getSnapshot().gestureLabel&&active.current)cancel();});window.addEventListener('blur',cancel);window.addEventListener('pointercancel',cancel);return()=>{off();window.removeEventListener('blur',cancel);window.removeEventListener('pointercancel',cancel);cancel();};},[editor,orbit]);
 useEffect(()=>{if(!selected||!enabled)cancel();},[selected,enabled]);
 const down=(e:ThreeEvent<PointerEvent>,index:number)=>{if(e.button!==0||!enabled||editor.getSnapshot().gestureLabel)return;e.stopPropagation();if(orbit)orbit.enabled=false;const target=e.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};target.setPointerCapture(e.pointerId);active.current={hedge,index,pointer:e.pointerId,valid:true,start:[e.clientX,e.clientY],moved:false,release:()=>{try{target.releasePointerCapture(e.pointerId);}catch{}}};};
 const move=(e:ThreeEvent<PointerEvent>)=>{const a=active.current;if(!a||a.pointer!==e.pointerId)return;e.stopPropagation();if(!a.moved){if(Math.hypot(e.clientX-a.start[0],e.clientY-a.start[1])<=4)return;a.moved=true;editor.begin('Move hedge point');}const y=hedgeTop(a.hedge,project.site,a.hedge.points[a.index])+.15,p=e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-y),new THREE.Vector3());if(!p)return;const points=a.hedge.points.map(p=>[...p] as PathPoint);points[a.index]=[snapping?Math.round(p.x*2)/2:p.x,snapping?Math.round(p.z*2)/2:p.z];try{editor.preview({type:'replace',entity:{...a.hedge,points}});a.valid=true;onError('');}catch(error){a.valid=false;onError((error as Error).message);}};
 const up=(e:ThreeEvent<PointerEvent>)=>{const a=active.current;if(!a||a.pointer!==e.pointerId)return;e.stopPropagation();active.current=null;if(a.moved){a.valid?editor.commit():editor.cancel();}else onAnchorSelect?.(a.index);a.release();if(orbit)orbit.enabled=allowed.current;};
 return <group userData={{copyEntityId:draft?undefined:hedge.id}}>
  <mesh geometry={geometry} material={draft?undefined:material} castShadow={!draft} receiveShadow={!draft} raycast={draft?()=>undefined:THREE.Mesh.prototype.raycast} onClick={e=>{if(enabled&&e.delta<=4){e.stopPropagation();onSelect(hedge.id);}}}>{draft&&<meshBasicMaterial color="#bbd99b" transparent opacity={.5} depthWrite={false}/>}</mesh>
  {selected&&enabled&&!draft&&<group userData={{waterCaptureExclude:true}}>{hedge.points.map((p,i)=><mesh key={i} position={[p[0],hedgeTop(hedge,project.site,p)+.15,p[1]]} renderOrder={15} onPointerDown={e=>down(e,i)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={e=>e.stopPropagation()}><sphereGeometry args={[i===selectedAnchor? .34:.25,10,8]}/><meshBasicMaterial color={i===selectedAnchor?'#d7f29c':'#e7d4a1'} depthTest={false}/><PointNumber number={i+1}/></mesh>)}{selectedAnchor!=null&&hedge.points[selectedAnchor]&&cornerControls&&<PathCornerPopover point={hedge.points[selectedAnchor]} site={project.site} height={hedgeTop(hedge,project.site,hedge.points[selectedAnchor])}>{cornerControls}</PathCornerPopover>}</group>}
 </group>;
}
export function HedgeDraft(props:Omit<Parameters<typeof HedgeLayer>[0],'selected'|'enabled'|'draft'>){
 const {gl}=useThree(),click=useDrawingClick(gl.domElement,!!props.onAnchorSelect);
 const valid=props.hedge.points.length>=2&&!hedgeShapeIssue(props.hedge,props.project.site);
 return <group userData={{waterCaptureExclude:true}}>{valid&&<HedgeLayer {...props} selected={false} enabled={false} draft/>}{props.hedge.points.map((p,i)=><mesh key={i} position={[p[0],hedgeTop(props.hedge,props.project.site,p)+.15,p[1]]} raycast={props.onAnchorSelect?THREE.Mesh.prototype.raycast:()=>undefined} onClick={e=>{if(props.onAnchorSelect){e.stopPropagation();if(e.delta<=4&&click(e.button))props.onAnchorSelect(i);}}}><sphereGeometry args={[i===props.selectedAnchor? .3:.2,10,8]}/><meshBasicMaterial color={i===props.selectedAnchor?'#d7f29c':'#e7d4a1'} depthTest={false}/><PointNumber number={i+1}/></mesh>)}{props.selectedAnchor!=null&&props.hedge.points[props.selectedAnchor]&&props.cornerControls&&<PathCornerPopover point={props.hedge.points[props.selectedAnchor]} site={props.project.site} height={hedgeTop(props.hedge,props.project.site,props.hedge.points[props.selectedAnchor])}>{props.cornerControls}</PathCornerPopover>}</group>;
}
