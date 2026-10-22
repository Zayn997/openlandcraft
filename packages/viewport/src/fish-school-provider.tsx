import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { fishSchools, type FishSchools, type Project } from '@openlandcraft/core';
import { advanceBirdTime } from './bird-flight';

const SchoolContext=createContext<{members:FishSchools;time:React.RefObject<number>} | null>(null);
export function FishSchoolProvider({project,playing,children}:{project:Project;playing:boolean;children:ReactNode}) {
  const time=useRef(0),reduced=useRef(false);
  const members=useMemo(()=>fishSchools(project),[project]);
  const value=useMemo(()=>({members,time}),[members]);
  useEffect(()=>{
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>{reduced.current=preference.matches;};update();preference.addEventListener('change',update);
    return ()=>preference.removeEventListener('change',update);
  },[]);
  useFrame((_,delta)=>{time.current=advanceBirdTime(time.current,delta,playing,reduced.current);},-0.35);
  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}
export function useFishSchool(id:string) {
  const state=useContext(SchoolContext);
  if (!state) throw new Error('Fish rendering requires a shared school clock.');
  return {member:state.members.get(id),time:state.time};
}
