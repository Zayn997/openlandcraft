import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type Instance } from '@openlandcraft/core';
import { fishSchoolPose } from './fish-school-motion';
import { useFishSchool } from './fish-school-provider';
import { useAnimatedModel } from './use-animated-model';

function SwimmingFish({ source, entity, interactive, selected, onSelect }: {
  source:THREE.Group; entity:Instance;
  interactive:boolean; selected:boolean; onSelect:(id:string)=>void;
}) {
  const motion = useRef<THREE.Group>(null);
  const {member,time} = useFishSchool(entity.id);
  const { object, animation } = useAnimatedModel(source,'Swim',interactive && !!member);
  const height = useMemo(() => new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3()).y,[source]);
  useFrame(() => {
    if (!member || !motion.current) return;
    const pose = fishSchoolPose(time.current,member,entity.rotation);
    motion.current.position.set(pose.x,pose.y,pose.z);
    motion.current.rotation.set(pose.pitch,pose.yaw,pose.bank,'YXZ');
    animation.action?.setEffectiveWeight(pose.effort);
    animation.mixer.setTime(pose.clipTime);
    motion.current.updateMatrixWorld(true);
  },-0.3);
  // Retain the saved animal when edits remove its habitat; it reappears when water returns.
  return <group userData={{fishSwim:true}} visible={!!member}>
    <group ref={motion} scale={entity.scale} userData={{copyEntityId:entity.id}} onClick={event => {
      if (interactive && event.delta <= 4) { event.stopPropagation(); onSelect(entity.id); }
    }}>
      <group position={[0,-height/2,0]}><primitive object={object} dispose={null}/></group>
      {selected && <mesh rotation={[-Math.PI/2,0,0]} raycast={() => undefined}><ringGeometry args={[0.52,0.55,32]}/><meshBasicMaterial color="#d7f29c" side={THREE.DoubleSide} depthTest={false}/></mesh>}
    </group>
  </group>;
}

export function FishInstances({source,instances,interactive,selectedIds,onSelect}: {
  source:THREE.Group; instances:Instance[]; interactive:boolean; selectedIds:string[]; onSelect:(id:string)=>void;
}) {
  return <>{instances.map(entity => <SwimmingFish key={entity.id} source={source} entity={entity} interactive={interactive} selected={selectedIds.includes(entity.id)} onSelect={onSelect}/>)}</>;
}
