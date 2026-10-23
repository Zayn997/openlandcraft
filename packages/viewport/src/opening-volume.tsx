import {useEffect,useMemo} from 'react';
import type {ThreeElements} from '@react-three/fiber';
import {Edges} from '@react-three/drei';
import type {Opening,Wall} from '@openlandcraft/core';
import {buildOpeningGeometry} from './wall-profile-geometry';

/** Shared aperture preview and hit surface for placement, selection and editing. */
export function OpeningVolume({wall,opening,topView=false,color,opacity,outlined=true,...props}:ThreeElements['mesh']&{wall:Wall;opening:Opening;topView?:boolean;color:string;opacity:number;outlined?:boolean}){
  const geometry=useMemo(()=>buildOpeningGeometry(wall,opening,topView),[wall,opening,topView]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh {...props} geometry={geometry}><meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false}/>{outlined&&<Edges raycast={()=>undefined} color={color}/>}</mesh>;
}
