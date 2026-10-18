import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { dragWall, wallLength, type Editor, type Level, type Wall, type WallDragMode } from '@openlandcraft/core';
import { buildPartGeometry } from './architecture-geometry';
import { ArchitectureLabel } from './architecture-label';

export type WallEditProps = { wall: Wall; level: Level; onStatus: (message: string) => void };
type Drag = { wall: Wall; mode: WallDragMode; pointer: number; plane: THREE.Plane; origin: THREE.Vector3; screen: [number, number]; moved: boolean; valid: boolean; changed: boolean; release: () => void };
const noRaycast = () => undefined;

export function WallEdit({ wall, walls, level, editor, snapping, topView, onStatus }: WallEditProps & { walls: Wall[]; editor: Editor; snapping: boolean; topView: boolean }) {
  const { gl } = useThree();
  const orbit = useThree(s => s.controls) as unknown as { enabled: boolean } | null;
  const active = useRef<Drag | null>(null);
  const [rejected, setRejected] = useState(false);
  const geometry = useMemo(() => buildPartGeometry(wall, walls), [wall, walls]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const cancel = () => {
    const drag = active.current; active.current = null;
    if (!drag) return;
    editor.cancel(); drag.release(); if (orbit) orbit.enabled = true; setRejected(false);
  };
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => { if (active.current && !editor.getSnapshot().gestureLabel) cancel(); });
    window.addEventListener('blur', cancel); gl.domElement.addEventListener('pointercancel', cancel);
    return () => { unsubscribe(); window.removeEventListener('blur', cancel); gl.domElement.removeEventListener('pointercancel', cancel); cancel(); };
  }, [editor, gl, orbit]);
  const down = (event: ThreeEvent<PointerEvent>, mode: WallDragMode) => {
    if (event.button !== 0 || active.current || editor.getSnapshot().gestureLabel) return;
    event.stopPropagation();
    if (Math.abs(event.ray.direction.y) < 0.03) { onStatus('Tilt the view down slightly to drag on the floor plane.'); return; }
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -event.point.y);
    const origin = event.ray.intersectPlane(plane, new THREE.Vector3()); if (!origin) return;
    const target = event.target as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
    if (orbit) orbit.enabled = false;
    target.setPointerCapture(event.pointerId);
    active.current = { wall, mode, pointer: event.pointerId, plane, origin, screen: [event.clientX, event.clientY], moved: false, valid: true, changed: false,
      release: () => { try { target.releasePointerCapture(event.pointerId); } catch { /* Already released. */ } } };
    editor.begin(mode === 'move' ? 'Move wall' : 'Move wall endpoint'); setRejected(false);
    onStatus('Drag on the floor plane. Joined corners follow. Escape cancels.');
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    const drag = active.current; if (!drag || drag.pointer !== event.pointerId) return;
    event.stopPropagation();
    if (!drag.moved && Math.hypot(event.clientX - drag.screen[0], event.clientY - drag.screen[1]) < 4) return;
    drag.moved = true;
    try {
      if (Math.abs(event.ray.direction.y) < 0.03) throw new Error('Keep the pointer on the floor plane.');
      const point = event.ray.intersectPlane(drag.plane, new THREE.Vector3());
      if (!point) throw new Error('Keep the pointer on the floor plane.');
      const delta = point.sub(drag.origin).applyAxisAngle(new THREE.Vector3(0, 1, 0), -level.rotation * Math.PI / 180);
      const next = dragWall(drag.wall, drag.mode, [delta.x, delta.z], snapping);
      editor.preview({ type: 'replace', entity: next });
      drag.valid = true; drag.changed = JSON.stringify([next.start, next.end]) !== JSON.stringify([drag.wall.start, drag.wall.end]); setRejected(false);
      onStatus('Wall length ' + wallLength(next).toFixed(2) + ' m. Release to apply; Escape cancels.');
    } catch (error) {
      drag.valid = false; setRejected(true);
      onStatus((error instanceof Error ? error.message : 'Invalid wall edit.') + ' Release here cancels the entire drag.');
    }
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    const drag = active.current; if (!drag || drag.pointer !== event.pointerId) return;
    move(event); event.stopPropagation(); active.current = null;
    if (drag.valid && drag.changed) { editor.commit(); onStatus('Wall updated. Joined corners and hosted openings were preserved.'); }
    else { editor.cancel(); onStatus(drag.valid ? 'Wall unchanged.' : 'Drag cancelled. Original walls restored.'); }
    drag.release(); if (orbit) orbit.enabled = true; setRejected(false);
  };
  const events = { onPointerMove: move, onPointerUp: up, onPointerCancel: cancel, onLostPointerCapture: cancel, onClick: (event: ThreeEvent<MouseEvent>) => event.stopPropagation(), onDoubleClick: (event: ThreeEvent<MouseEvent>) => event.stopPropagation() };
  const color = rejected ? '#ed775f' : '#d7f29c', top = wall.elevation + wall.height;
  return <group position={level.position} rotation={[0, level.rotation * Math.PI / 180, 0]} userData={{ waterCaptureExclude: true }}>
    <mesh geometry={geometry} {...events} onPointerDown={event => down(event, 'move')}>
      <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      <Edges color={color} lineWidth={2} raycast={noRaycast} />
    </mesh>
    {(['start', 'end'] as const).map((end, i) => <group key={end}>
      <mesh position={[wall[end][0], top + 0.22, wall[end][1]]} {...events} onPointerDown={event => down(event, end)}>
        <sphereGeometry args={[0.23, 16, 12]} /><meshBasicMaterial color={rejected ? color : '#f6d49a'} depthTest={false} />
      </mesh>
      <ArchitectureLabel position={[wall[end][0], top + 0.7, wall[end][1] + (topView ? 0.7 : 0)]} text={i === 0 ? 'Start' : 'End'} />
    </group>)}
    <ArchitectureLabel position={[(wall.start[0] + wall.end[0]) / 2, top + 0.4, (wall.start[1] + wall.end[1]) / 2 + (topView ? 1 : 0)]} text={wallLength(wall).toFixed(2) + ' m · drag wall or endpoints'} />
  </group>;
}
