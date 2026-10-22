import { sceneCeiling } from './bird-clearance';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAnimatedModel } from './use-animated-model';
import { instancePosition, type Instance, type Project } from '@openlandcraft/core';
import { advanceBirdTime, birdFlightPose, birdSeed } from './bird-flight';

const noRaycast = () => undefined;

function FlyingBird({ source, entity, project, playing, interactive, selected, floor, onSelect }: {
  source: THREE.Group; entity: Instance; project: Project; playing: boolean; interactive: boolean;
  selected: boolean; floor: React.RefObject<number>; onSelect: (id: string) => void;
}) {
  const { object, animation, reduced } = useAnimatedModel(source, 'Flight', interactive);
  const flight = useRef<THREE.Group>(null), time = useRef(0);
  const seed = useMemo(() => birdSeed(entity.id), [entity.id]);
  const center = instancePosition(entity, project);
  useFrame((_, delta) => {
    time.current = advanceBirdTime(time.current, delta, playing, reduced.current);
    const pose = birdFlightPose(time.current, seed, center, project.site, floor.current, entity.rotation);
    if (!flight.current) return;
    flight.current.position.set(pose.x, pose.y, pose.z);
    flight.current.rotation.set(pose.pitch, pose.yaw, pose.bank, 'YXZ');
    if (animation.action) {
      animation.action.setEffectiveWeight(pose.flapWeight);
      animation.mixer.setTime(pose.clipTime);
    }
    flight.current.updateMatrixWorld(true);
  }, -0.3);
  return <group userData={{birdFlight:true}}>
    <group ref={flight} userData={{copyEntityId:entity.id}} scale={entity.scale} onClick={event => {
      if (interactive && event.delta <= 4) { event.stopPropagation(); onSelect(entity.id); }
    }}>
      <primitive object={object} dispose={null} />
      {selected && <mesh rotation={[-Math.PI/2,0,0]} raycast={noRaycast}><ringGeometry args={[0.8,0.85,32]}/><meshBasicMaterial color="#d7f29c" side={THREE.DoubleSide} depthTest={false}/></mesh>}
    </group>
  </group>;
}

export function BirdInstances({source, instances, project, playing, interactive, selectedIds, onSelect}: {
  source: THREE.Group; instances: Instance[]; project: Project; playing: boolean; interactive: boolean; selectedIds: string[]; onSelect: (id: string) => void;
}) {
  const scene = useThree(state => state.scene), floor = useRef(0), elapsed = useRef(1);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current >= 1) { floor.current = sceneCeiling(scene, project); elapsed.current = 0; }
  }, -0.4);
  return <>{instances.map(entity => <FlyingBird key={entity.id} source={source} entity={entity} project={project} playing={playing} interactive={interactive} selected={selectedIds.includes(entity.id)} floor={floor} onSelect={onSelect}/>)}</>;
}
