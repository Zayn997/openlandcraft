import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Project, River } from '@openlandcraft/core';
import { RiverHistory } from './river-water';

type RiverResources={simulation:RiverHistory;history:THREE.DataTexture;map:THREE.DataTexture};
const Context=createContext<RiverResources|null>(null);
export const useRiverWater=()=>useContext(Context);

export function RiverSystem({site,river,playing,preview,transient,children}:{site:Project['site'];river?:River;playing:boolean;preview:{reset:number;step:number};transient:boolean;children:ReactNode}) {
  // Parsing an appearance edit can clone points; compare shape values to retain the engine.
  const points=JSON.stringify(river?.points);
  const resources=useMemo<RiverResources|null>(()=>{
    if(!river?.visible)return null;
    const simulation=new RiverHistory(site,river),f=simulation.field;
    const history=new THREE.DataTexture(simulation.pixels,f.columns,f.rows,THREE.RGBAFormat);
    history.minFilter=history.magFilter=THREE.LinearFilter;history.needsUpdate=true;
    const map=new THREE.DataTexture(f.map,f.mapColumns,f.mapRows,THREE.RGBAFormat,THREE.FloatType);map.needsUpdate=true;
    return {simulation,history,map};
  },[site.terrain,site.width,site.depth,river?.id,river?.visible,points,river?.width,river?.depth,river?.bank,river?.water.amplitude,river?.water.wavelength,preview.reset]);
  useEffect(()=>()=>{resources?.history.dispose();resources?.map.dispose();},[resources]);
  useLayoutEffect(()=>{if(transient&&resources){resources.simulation.clearHistory();resources.history.needsUpdate=true;}},[transient,resources]);
  const lastStep=useRef(preview.step);
  useEffect(()=>{
    if(lastStep.current===preview.step)return;lastStep.current=preview.step;
    if(resources&&river&&!playing){resources.simulation.river=river;resources.simulation.advance(0.25);resources.simulation.advance(0.25);resources.history.needsUpdate=true;}
  },[preview.step,resources,playing,river]);
  useFrame((_,delta)=>{
    if(!resources||!river)return;
    resources.simulation.river=river;
    if(!playing)return;
    if(transient)resources.simulation.advanceClock(delta);
    else if(resources.simulation.advance(delta))resources.history.needsUpdate=true;
  },-1);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}
