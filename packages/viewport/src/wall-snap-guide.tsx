import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { WallSnapFeedback } from '@openlandcraft/core';
import { ArchitectureLabel } from './architecture-label';
import { worldUnitsPerPixel } from './camera-projection';

/** Transparent sprites render after wall previews and stay legible at any zoom. */
function EndpointMarker({ position, target, active }: { position: [number, number, number]; target?: boolean; active: boolean }) {
  const sprite = useRef<THREE.Sprite>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (target) ctx.arc(40, 40, 27, 0, Math.PI * 2);
    else { ctx.moveTo(40, 26); ctx.lineTo(54, 40); ctx.lineTo(40, 54); ctx.lineTo(26, 40); ctx.closePath(); }
    ctx.strokeStyle = '#162d35'; ctx.lineWidth = target ? 13 : 10; ctx.stroke();
    ctx.strokeStyle = target ? '#70efff' : '#ffe77b'; ctx.lineWidth = target ? 7 : 4;
    if (target && !active) ctx.setLineDash([10, 6]);
    if (!target) { ctx.fillStyle = '#ffe77b'; ctx.fill(); }
    ctx.stroke();
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [target, active]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ camera, size }) => {
    if (!sprite.current) return;
    sprite.current.getWorldPosition(world);
    const unit = worldUnitsPerPixel(camera, world, size.height);
    sprite.current.scale.set(unit * 40, unit * 40, 1);
  });
  return <sprite ref={sprite} position={position} renderOrder={target ? 1002 : 1003} raycast={() => undefined} userData={{ waterCaptureExclude: true }}>
    <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
  </sprite>;
}

/** The circle and diamond remain distinct even when the endpoints coincide. */
export function WallSnapGuide({ feedback, height, targetHeight = height, baseHeight = height, targetBaseHeight = targetHeight }: {
  feedback?: WallSnapFeedback; height: number; targetHeight?: number; baseHeight?: number; targetBaseHeight?: number;
}) {
  if (!feedback) return null;
  const { point, origin, axis } = feedback;
  const target = feedback.endpoint ?? feedback.nearEndpoint;
  const active = !!feedback.endpoint;
  const color = '#70efff';
  const span = origin ? Math.max(4, Math.hypot(point[0] - origin[0], point[1] - origin[1]) + 2) : 4;
  return <group userData={{ waterCaptureExclude: true }}>
    {axis !== undefined && origin && <>
      <Line points={axis === 0 ? [[origin[0] - span, height, origin[1]], [origin[0] + span, height, origin[1]]] : [[origin[0], height, origin[1] - span], [origin[0], height, origin[1] + span]]} color={color} lineWidth={1.5} dashed dashSize={0.3} gapSize={0.2} transparent depthTest={false} depthWrite={false} renderOrder={999} raycast={() => undefined} />
      <ArchitectureLabel position={[point[0], height, point[1]]} screenOffset={[0,target?-62:-32]} text={axis === 0 ? 'Horizontal · Shift' : 'Vertical · Shift'} />
    </>}
    {target && <>
      {height!==baseHeight&&<Line points={[[point[0],baseHeight,point[1]],[point[0],height,point[1]]]} color="#ffe77b" lineWidth={4} transparent depthTest={false} depthWrite={false} renderOrder={1000} raycast={()=>undefined}/>}
      {targetHeight!==targetBaseHeight&&<Line points={[[target.point[0],targetBaseHeight,target.point[1]],[target.point[0],targetHeight,target.point[1]]]} color={color} lineWidth={4} transparent depthTest={false} depthWrite={false} renderOrder={1001} raycast={()=>undefined}/>}
      <EndpointMarker position={[point[0],height,point[1]]} active={active}/>
      <EndpointMarker position={[target.point[0],targetHeight,target.point[1]]} target active={active}/>
      {!active&&<Line points={[[point[0],height,point[1]],[target.point[0],targetHeight,target.point[1]]]} color={color} lineWidth={2} dashed dashSize={0.12} gapSize={0.1} transparent depthTest={false} depthWrite={false} renderOrder={1000} raycast={()=>undefined}/>}
      <ArchitectureLabel position={[target.point[0],targetHeight,target.point[1]]} screenOffset={[0,-36]} text={active?'Endpoint snap':'Snap target'}/>
    </>}
  </group>;
}
