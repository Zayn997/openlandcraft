import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import {groundHeight,snap,type Editor,type MaterialRegion,type Project,type Region} from '@openlandcraft/core';
import {lakeDistance,type PathPoint} from '@openlandcraft/landscape';
import {buildRegionMesh,updateRegionHeights} from './region-geometry';
import {intersectTerrain} from './terrain-picking';
import {PathDraft} from './path';
import {PointNumber} from './river';

function materialFor(region:Region){
  if(region.kind==='plantingRegion')return new THREE.MeshBasicMaterial({color:'#cbe29a',transparent:true,opacity:0.09,depthWrite:false});
  const material=new THREE.MeshStandardMaterial({color:region.color,roughness:region.roughness,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vRegion;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvRegion=uv;');
    shader.fragmentShader='varying vec2 vRegion;\nfloat regionHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vRegion/${region.detailScale.toFixed(4)};float grain=regionHash(floor(p*${region.surface==='grass'?'22.0':region.surface==='rock'?'3.0':'35.0'}));
      grain=mix(grain,0.5,smoothstep(0.01,0.15,max(length(dFdx(p)),length(dFdy(p)))));diffuseColor.rgb*=0.82+grain*0.32;`);
  };material.customProgramCacheKey=()=>`region-${region.surface}-${region.detailScale}`;return material;
}
export function RegionDraft({points,site}:{points:PathPoint[];site:Project['site']}){return <PathDraft points={points.length>=3?[...points,points[0]]:points} site={site}/>;}
export function RegionLayer({region,project,order,selected,enabled,snapping,editor,onSelect,onError}:{region:Region;project:Project;order:number;selected:boolean;enabled:boolean;snapping:boolean;editor:Editor;onSelect:(id:string)=>void;onError:(message:string)=>void}){
  const shape=JSON.stringify(region.points),site=project.site,lift=0.012+order*0.001;
  const mesh=useMemo(()=>buildRegionMesh(region.points,site,lift),[shape,site.width,site.depth,site.terrain.columns,site.terrain.rows]);
  useLayoutEffect(()=>updateRegionHeights(mesh,site,lift),[mesh,site.terrain,lift]);useEffect(()=>()=>mesh.geometry.dispose(),[mesh]);
  const material=useMemo(()=>materialFor(region),[region.kind,(region as MaterialRegion).surface,(region as MaterialRegion).color,(region as MaterialRegion).roughness,(region as MaterialRegion).detailScale]);useEffect(()=>()=>material.dispose(),[material]);
  const orbit=useThree(s=>s.controls) as unknown as {enabled:boolean}|null,allowed=useRef(enabled);allowed.current=enabled;
  const active=useRef<{region:MaterialRegion;index:number;pointer:number;release:()=>void;valid:boolean}|null>(null);
  const cancel=()=>{const session=active.current;active.current=null;if(session){session.release();editor.cancel();if(orbit)orbit.enabled=allowed.current;}};
  useEffect(()=>{const unsubscribe=editor.subscribe(()=>{if(!editor.getSnapshot().gestureLabel&&active.current)cancel();});window.addEventListener('blur',cancel);window.addEventListener('pointercancel',cancel);return()=>{unsubscribe();window.removeEventListener('blur',cancel);window.removeEventListener('pointercancel',cancel);cancel();};},[editor,orbit]);
  useEffect(()=>{if(!selected||!enabled)cancel();},[selected,enabled]);
  const down=(event:ThreeEvent<PointerEvent>,index:number)=>{
    if(region.kind!=='materialRegion'||!enabled||event.button!==0||editor.getSnapshot().gestureLabel)return;
    event.stopPropagation();editor.begin('Move region point');if(orbit)orbit.enabled=false;
    const target=event.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};target.setPointerCapture(event.pointerId);
    active.current={region,index,pointer:event.pointerId,valid:true,release:()=>{try{target.releasePointerCapture(event.pointerId);}catch{/* Browser may already have released it. */}}};
  };
  const move=(event:ThreeEvent<PointerEvent>)=>{const s=active.current;if(!s||s.pointer!==event.pointerId)return;event.stopPropagation();const hit=intersectTerrain(event.ray,site);if(!hit){s.valid=false;return;}
    const points=s.region.points.map(p=>[...p] as PathPoint);points[s.index]=[snapping?snap(hit.point.x):hit.point.x,snapping?snap(hit.point.z):hit.point.z];
    try{editor.preview({type:'replace',entity:{...s.region,points}});s.valid=true;onError('');}catch(error){s.valid=false;onError(error instanceof Error?error.message:'Invalid region.');}
  };
  const up=(event:ThreeEvent<PointerEvent>)=>{const s=active.current;if(!s||s.pointer!==event.pointerId)return;event.stopPropagation();active.current=null;s.valid?editor.commit():editor.cancel();s.release();if(orbit)orbit.enabled=allowed.current;};
  const surface=useRef<THREE.Mesh>(null),pick:THREE.Mesh['raycast']=(ray,hits)=>{if(!enabled||!surface.current||(region.kind==='plantingRegion'&&!selected))return;const liftedRay=ray.ray.clone();liftedRay.origin.y-=lift;const hit=intersectTerrain(liftedRay,site);if(hit&&lakeDistance(region.points,hit.point.x,hit.point.z)>=0&&hit.distance>=ray.near&&hit.distance<=ray.far)hits.push({...hit,object:surface.current});};
  return <group><mesh ref={surface} geometry={mesh.geometry} material={material} receiveShadow visible={region.kind==='materialRegion'||selected} raycast={pick} userData={{waterCaptureExclude:region.kind==='plantingRegion'}} onClick={e=>{if(enabled&&e.delta<=4){e.stopPropagation();onSelect(region.id);}}}/>
    {selected&&enabled&&<group userData={{waterCaptureExclude:true}}><RegionDraft points={region.points} site={site}/>{region.points.map((p,i)=><mesh key={i} position={[p[0],groundHeight(...p,site)+0.2,p[1]]} renderOrder={16} onPointerDown={e=>down(e,i)} onPointerMove={move} onPointerUp={up} onLostPointerCapture={cancel} onPointerCancel={cancel}><sphereGeometry args={[0.28,12,8]}/><meshBasicMaterial color="#cbe29a" depthTest={false}/><PointNumber number={i+1}/></mesh>)}</group>}
  </group>;
}


