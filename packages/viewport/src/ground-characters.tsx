import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { groundRoutes, type GroundRoute, type Instance, type Project } from '@openlandcraft/core';
import { useAnimatedModel } from './use-animated-model';
import { PedestrianSimulation } from './pedestrian-motion';
import {startWork,endWork} from './frame-profile';

const Context = createContext<{routes:ReadonlyMap<string,GroundRoute>;simulation:PedestrianSimulation} | null>(null);
export function GroundCharacterProvider({project,playing,children}:{project:Project;playing:boolean;children:ReactNode}) {
  const reduced = useRef(false), routes = useMemo(() => groundRoutes(project),[project]);
  const value = useMemo(() => ({routes,simulation:new PedestrianSimulation(project,routes)}),[routes,project]);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = preference.matches; }; update(); preference.addEventListener('change',update);
    return () => preference.removeEventListener('change',update);
  },[]);
  useFrame((_,delta) => { const start=startWork();value.simulation.advance(delta,playing,reduced.current);endWork('character-steering',start); },-0.35);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function GroundCharacter({source,entity,interactive,selected,onSelect}: {
  source:THREE.Group;entity:Instance;interactive:boolean;selected:boolean;onSelect:(id:string)=>void;
}) {
  const state = useContext(Context)!;
  const route = state.routes.get(entity.id);
  const {object,animation} = useAnimatedModel(source,'Idle',interactive && !!route);
  const walk = useRef<THREE.AnimationAction | null>(null);
  useLayoutEffect(() => {
    const clip = source.animations.find(c => c.name === 'Walk');
    const action = clip ? animation.mixer.clipAction(clip).setEffectiveWeight(0).play() : null; walk.current = action;
    return () => { action?.stop(); walk.current = null; };
  },[source,animation]);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current || !route) return;
    const start=startWork();
    const pose = state.simulation.sample(entity.id);
    group.current.visible = !!pose;
    if (!pose) {endWork('character-animation',start);return;}
    group.current.position.set(pose.x,pose.y,pose.z); group.current.rotation.set(pose.pitch,pose.yaw,0,'YXZ');
    if (animation.action) { animation.action.setEffectiveWeight(1-pose.walkWeight); animation.action.time = pose.idleTime%animation.action.getClip().duration; }
    if (walk.current) { walk.current.setEffectiveWeight(pose.walkWeight); walk.current.time = pose.walkTime%walk.current.getClip().duration; }
    animation.mixer.update(0);
    group.current.updateMatrixWorld(true);
    endWork('character-animation',start);
  },-0.3);
  return <group userData={{groundCharacter:true}}>
    <group ref={group} visible={!!route} scale={entity.scale} userData={{copyEntityId:entity.id}} onClick={event => {
      if (interactive && route && event.delta <= 4) { event.stopPropagation(); onSelect(entity.id); }
    }}>
      <primitive object={object} dispose={null}/>
      {selected && <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.035,0]} raycast={() => undefined}>
        <ringGeometry args={[route ? route.bodyRadius/Math.max(...entity.scale) : 0.65,(route ? route.bodyRadius/Math.max(...entity.scale) : 0.65)+0.045,48]}/>
        <meshBasicMaterial color="#d7f29c" side={THREE.DoubleSide} depthTest={false}/>
      </mesh>}
    </group>
  </group>;
}

export function GroundCharacterInstances({source,instances,interactive,selectedIds,onSelect}: {
  source:THREE.Group;instances:Instance[];interactive:boolean;selectedIds:string[];onSelect:(id:string)=>void;
}) {
  return <>{instances.map(entity => <GroundCharacter key={entity.id} source={source} entity={entity} interactive={interactive} selected={selectedIds.includes(entity.id)} onSelect={onSelect}/>)}</>;
}
