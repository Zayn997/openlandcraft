import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { canEditObject, curvePoint, resizeWallBase, resizeWallHeight, type Editor, type Level, type Wall } from '@openlandcraft/core';
import { ArchitectureLabel } from './architecture-label';
import { worldUnitsPerPixel } from './camera-projection';

export type WallHeightHandleProps = { wall: Wall; level: Level; onStatus: (message: string) => void };
type Edge = 'top'|'base';
type Drag = { wall: Wall; edge: Edge; pointer: number; screen: [number,number]; plane?: THREE.Plane; origin?: THREE.Vector3; units: number; moved: boolean; valid: boolean; changed: boolean; issue: string; release: () => void; orbitEnabled?: boolean };

export function WallHeightHandle({ wall, level, editor, snapping, onStatus, onError }: WallHeightHandleProps & { editor: Editor; snapping: boolean; onError: (message:string)=>void }) {
  const { camera, gl, size } = useThree();
  const orbit = useThree(s=>s.controls) as unknown as {enabled:boolean}|null;
  const active = useRef<Drag|null>(null), sprites = useRef<(THREE.Sprite|null)[]>([]);
  const world = useMemo(()=>new THREE.Vector3(),[]);
  const [hover,setHover]=useState<Edge|null>(null), [dragging,setDragging]=useState<Edge|null>(null), [rejected,setRejected]=useState(false);
  const middle=wall.curve?curvePoint(wall.curve,.5):[(wall.start[0]+wall.end[0])/2,(wall.start[1]+wall.end[1])/2];
  const top=wall.elevation+wall.height;
  const textures=useMemo(()=>(['top','base'] as const).map(edge=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d')!, pressed=dragging===edge;
    // Match the editor's accent/accent-ink/danger palette and 4 px control corners.
    ctx.globalAlpha=hover===edge||pressed?1:.88;
    ctx.fillStyle=rejected&&pressed?'#f2b1a7':pressed?'#263321':'#d1e6a2';
    ctx.beginPath();ctx.roundRect(8,8,48,48,8);ctx.fill();ctx.globalAlpha=1;
    if(edge==='base'){ctx.translate(64,64);ctx.rotate(Math.PI);}
    ctx.strokeStyle=pressed&&!rejected?'#d1e6a2':'#263321';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(22,36);ctx.lineTo(32,26);ctx.lineTo(42,36);ctx.stroke();
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
  }),[hover,dragging,rejected]);
  useEffect(()=>()=>textures.forEach(texture=>texture.dispose()),[textures]);
  useFrame(({camera,size})=>{
    for(const sprite of sprites.current){
      if(!sprite)continue;
      sprite.getWorldPosition(world);
      const unit=worldUnitsPerPixel(camera,world,size.height);
      sprite.scale.set(32*unit,32*unit,1);
    }
  });
  useEffect(()=>{
    if(!hover&&!dragging)return;
    const previous=gl.domElement.style.cursor;gl.domElement.style.cursor='ns-resize';
    return()=>{gl.domElement.style.cursor=previous;};
  },[hover,dragging,gl]);
  const release=(drag:Drag)=>{drag.release();if(orbit)orbit.enabled=drag.orbitEnabled??true;setDragging(null);setRejected(false);};
  const cancel=()=>{
    const drag=active.current;active.current=null;if(!drag)return;
    editor.cancel();release(drag);onStatus('Height change cancelled.');
  };
  useEffect(()=>{
    const unsubscribe=editor.subscribe(()=>{if(active.current&&!editor.getSnapshot().gestureLabel)cancel();});
    window.addEventListener('blur',cancel);gl.domElement.addEventListener('pointercancel',cancel);
    return()=>{unsubscribe();window.removeEventListener('blur',cancel);gl.domElement.removeEventListener('pointercancel',cancel);cancel();};
  },[editor,gl,orbit]);
  const down=(event:ThreeEvent<PointerEvent>,edge:Edge)=>{
    if(event.button!==0)return;event.stopPropagation();
    const snapshot=editor.getSnapshot();
    if(active.current||snapshot.gestureLabel||!canEditObject(snapshot.project,wall.id,snapshot.isolatedLayerId))return;
    // A vertical plane follows true height in 3D. In a top view, screen-up/down provides a usable fallback.
    const normal=camera.getWorldDirection(new THREE.Vector3());normal.y=0;
    const plane=normal.lengthSq()>.02?new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(),event.point):undefined;
    const origin=plane?event.ray.intersectPlane(plane,new THREE.Vector3())??undefined:undefined;
    const target=event.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};
    target.setPointerCapture(event.pointerId);
    const drag:Drag={wall,edge,pointer:event.pointerId,screen:[event.clientX,event.clientY],plane:origin?plane:undefined,origin,units:worldUnitsPerPixel(camera,event.point,size.height),moved:false,valid:true,changed:false,issue:'',orbitEnabled:orbit?.enabled,release:()=>{try{target.releasePointerCapture(event.pointerId);}catch{/* Already released. */}}};
    active.current=drag;if(orbit)orbit.enabled=false;setDragging(edge);setRejected(false);
    editor.begin('Resize wall height');onStatus(edge==='top'?'Height · drag the top edge; the base stays fixed. Release to apply; Escape cancels.':'Height · drag the bottom edge; the top stays fixed. Release to apply; Escape cancels.');
  };
  const move=(event:ThreeEvent<PointerEvent>)=>{
    const drag=active.current;if(!drag||event.pointerId!==drag.pointer)return;event.stopPropagation();
    if(!drag.moved&&Math.hypot(event.clientX-drag.screen[0],event.clientY-drag.screen[1])<4)return;
    drag.moved=true;
    try{
      const hit=drag.plane?event.ray.intersectPlane(drag.plane,new THREE.Vector3()):null;
      if(drag.plane&&!hit)throw new Error('Keep the pointer on the height editing plane.');
      const delta=hit&&drag.origin?hit.y-drag.origin.y:(drag.screen[1]-event.clientY)*drag.units;
      const next=drag.edge==='top'?resizeWallHeight(drag.wall,delta,snapping):resizeWallBase(drag.wall,delta,snapping);
      editor.preview({type:'replace',entity:next});
      drag.changed=Math.abs(next.height-drag.wall.height)>1e-8;drag.valid=true;drag.issue='';setRejected(false);
      onStatus(`Height ${next.height.toFixed(2)} m${wall.joins?' · connected walls follow':''}. Release to apply; Escape cancels.`);
    }catch(error){drag.valid=false;drag.issue=error instanceof Error?error.message:'Invalid wall height.';setRejected(true);onStatus(`Height · ${drag.issue} Release here cancels the change.`);}
  };
  const up=(event:ThreeEvent<PointerEvent>)=>{
    const drag=active.current;if(!drag||event.pointerId!==drag.pointer)return;
    move(event);event.stopPropagation();active.current=null;
    if(drag.valid&&drag.changed){editor.commit();onStatus('Height updated. Drag the arrows again to adjust.');}
    else{editor.cancel();onStatus('Height unchanged.');if(!drag.valid)onError(drag.issue);}
    release(drag);
  };
  return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]} userData={{waterCaptureExclude:true}}>
    {(['top','base'] as const).map((edge,index)=><sprite key={edge} ref={node=>{sprites.current[index]=node;}} position={[middle[0],edge==='top'?top+.06:wall.elevation-.06,middle[1]]} center={[.5,edge==='top'?-.5:1.5]} renderOrder={1100}
      raycast={function(this:THREE.Sprite,raycaster,hits){const first=hits.length;THREE.Sprite.prototype.raycast.call(this,raycaster,hits);for(let i=first;i<hits.length;i++)hits[i].distance=0;}}
      onPointerDown={event=>down(event,edge)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onPointerOver={event=>{event.stopPropagation();setHover(edge);}} onPointerOut={()=>setHover(null)}
      onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()}>
      <spriteMaterial map={textures[index]} transparent depthTest={false} depthWrite={false} toneMapped={false}/>
    </sprite>)}
    {(hover||dragging)&&<ArchitectureLabel position={[middle[0],wall.elevation+wall.height/2,middle[1]]} screenOffset={[74,0]} text={`${wall.height.toFixed(2)} m · Height`}/>}
  </group>;
}
