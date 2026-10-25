import {createContext,useContext,useEffect,useLayoutEffect,useMemo,useRef,type ReactNode} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import type {Lake,Project} from '@openlandcraft/core';
import {LakeHistory} from './lake-water';
import {startWork,endWork} from './frame-profile';

type Resources={simulation:LakeHistory;history:THREE.DataTexture;distance:THREE.DataTexture};
const Context=createContext<Resources|null>(null);
export const useLakeWater=()=>useContext(Context);
export function LakeSystem({site,lake,playing,preview,transient,children}:{site:Project['site'];lake?:Lake;playing:boolean;preview:{reset:number;step:number};transient:boolean;children:ReactNode}){
  const shape=JSON.stringify([lake?.points,lake?.holes]);
  const resources=useMemo<Resources|null>(()=>{
    if(!lake?.visible)return null;
    const simulation=new LakeHistory(site,lake),history=new THREE.DataTexture(simulation.pixels,simulation.columns,simulation.rows,THREE.RGBAFormat);
    history.minFilter=history.magFilter=THREE.LinearFilter;history.needsUpdate=true;
    const distance=new THREE.DataTexture(simulation.distances,simulation.columns,simulation.rows,THREE.RedFormat,THREE.FloatType);distance.needsUpdate=true;
    return {simulation,history,distance};
  },[site.terrain,site.width,site.depth,shape,lake?.id,lake?.visible,lake?.level,lake?.bank,lake?.amplitude,lake?.wavelength,lake?.direction,preview.reset]);
  useEffect(()=>()=>{resources?.history.dispose();resources?.distance.dispose();},[resources]);
  useLayoutEffect(()=>{if(transient&&resources){resources.simulation.clearHistory();resources.history.needsUpdate=true;}},[transient,resources]);
  const lastStep=useRef(preview.step);
  useEffect(()=>{if(lastStep.current===preview.step)return;lastStep.current=preview.step;if(resources&&lake&&!playing){resources.simulation.lake=lake;resources.simulation.advance(0.25);resources.simulation.advance(0.25);resources.history.needsUpdate=true;}},[preview.step,resources,playing,lake]);
  useFrame((_,delta)=>{if(!resources||!lake)return;resources.simulation.lake=lake;if(!playing)return;const start=startWork();if(transient)resources.simulation.advanceClock(delta);else if(resources.simulation.advance(delta))resources.history.needsUpdate=true;endWork('lake-history',start);},-1);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}

export const lakeFieldGLSL=/* glsl */`
  uniform sampler2D uLakeDistance,uLakeHistory;
  uniform vec4 uLakeBounds;
  uniform vec2 uLakeGrid;
  uniform float uLakeEnabled,uLakeWetBank,uLakeLevel;
  vec2 lakeUV(vec2 point){return ((point-uLakeBounds.xy)/uLakeBounds.zw*(uLakeGrid-1.0)+0.5)/uLakeGrid;}
  float lakeDistanceAt(vec2 point){
    vec2 g=clamp((point-uLakeBounds.xy)/uLakeBounds.zw*(uLakeGrid-1.0),vec2(0.0),uLakeGrid-1.0);
    ivec2 cell=ivec2(min(floor(g),uLakeGrid-2.0));vec2 f=g-vec2(cell);
    return mix(mix(texelFetch(uLakeDistance,cell,0).r,texelFetch(uLakeDistance,cell+ivec2(1,0),0).r,f.x),mix(texelFetch(uLakeDistance,cell+ivec2(0,1),0).r,texelFetch(uLakeDistance,cell+ivec2(1,1),0).r,f.x),f.y);
  }
  float lakeWetAt(vec2 point){vec2 uv=lakeUV(point);if(uLakeEnabled<0.5||any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return 0.0;return texture2D(uLakeHistory,uv).g*uLakeWetBank;}
`;
export function lakeUniforms(empty:THREE.Texture){return {uLakeDistance:{value:empty},uLakeHistory:{value:empty},uLakeBounds:{value:new THREE.Vector4(0,0,1,1)},uLakeGrid:{value:new THREE.Vector2(2,2)},uLakeEnabled:{value:0},uLakeWetBank:{value:0},uLakeLevel:{value:0}};}
export function updateLakeUniforms(u:ReturnType<typeof lakeUniforms>,resources:Resources|null,fallback:THREE.Texture){
  u.uLakeEnabled.value=resources?1:0;
  if(!resources){
    // Disabled samplers are still bound by WebGL. Never resurrect a disposed lake texture.
    u.uLakeDistance.value=fallback;u.uLakeHistory.value=fallback;u.uLakeWetBank.value=0;
    return;
  }
  const s=resources.simulation,b=s.bounds;u.uLakeDistance.value=resources.distance;u.uLakeHistory.value=resources.history;u.uLakeBounds.value.set(b.minX,b.minZ,b.width,b.depth);u.uLakeGrid.value.set(s.columns,s.rows);u.uLakeWetBank.value=s.lake.wetBank;u.uLakeLevel.value=s.lake.level;
}
