import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { dragOpening,openingDistanceAtPoint,wallLength,wallTangent,type Editor, type Level, type Wall, type OpeningDragMode } from '@openlandcraft/core';
import { ArchitectureLabel } from './architecture-label';
import { OpeningVolume } from './opening-volume';
import { wallProfilePosition } from './wall-profile-geometry';

export type OpeningFocus = { wallId: string; openingId: string };
export type OpeningEditProps = {
  level: Level; walls: Wall[]; editor: Editor; snapping: boolean; topView: boolean;
  focus: OpeningFocus | null; onSelect: (focus: OpeningFocus) => void; onStatus: (message: string) => void;
};
type Drag = {
  wall: Wall; id: string; mode: OpeningDragMode; pointer: number; plane: THREE.Plane; origin: THREE.Vector3; axis: THREE.Vector3;
  originAlong:number;
  screen: [number, number]; started: boolean; moved: boolean; valid: boolean; changed: boolean; release: () => void;
};

function ResizeHandle({ wall,x,y,down, move, up, cancel }: {
  wall:Wall;x: number; y: number;
  down: (event: ThreeEvent<PointerEvent>) => void; move: (event: ThreeEvent<PointerEvent>) => void;
  up: (event: ThreeEvent<PointerEvent>) => void; cancel: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null), localCamera = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    if (!mesh.current?.parent) return;
    localCamera.current.copy(camera.position); mesh.current.parent.worldToLocal(localCamera.current);
    // Put the grip on the camera-facing side, clear of the move target's face.
    const position=new THREE.Vector3(...wallProfilePosition(wall,x,y)),tangent=wallTangent(wall,x/wallLength(wall)),normal=new THREE.Vector3(-tangent[1],0,tangent[0]);
    const side=Math.sign(localCamera.current.sub(position).dot(normal))||1;mesh.current.position.copy(position).addScaledVector(normal,side*(wall.thickness/2+.25));
  });
  return <mesh ref={mesh} position={wallProfilePosition(wall,x,y)} onPointerDown={down} onPointerMove={move} onPointerUp={up}
    onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={event => event.stopPropagation()} renderOrder={16}>
    <boxGeometry args={[0.24, 0.24, 0.24]} /><meshBasicMaterial color="#f6d49a" depthTest={false} />
  </mesh>;
}

export function OpeningEdit({ level, walls, editor, snapping, topView, focus, onSelect, onStatus }: OpeningEditProps) {
  const { camera, gl } = useThree();
  const orbit = useThree(s => s.controls) as unknown as { enabled: boolean } | null;
  const active = useRef<Drag | null>(null);
  const [rejected, setRejected] = useState(false);
  const localPoint=(point:THREE.Vector3):[number,number]=>{const p=point.clone().sub(new THREE.Vector3(...level.position)).applyAxisAngle(new THREE.Vector3(0,1,0),-level.rotation*Math.PI/180);return [p.x,p.z];};
  const cancel = () => {
    const drag = active.current; active.current = null;
    if (!drag) return;
    if (drag.started) editor.cancel();
    drag.release(); if (orbit) orbit.enabled = true;
    setRejected(false);
  };
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => { if (active.current?.started && !editor.getSnapshot().gestureLabel) cancel(); });
    window.addEventListener('blur', cancel);
    gl.domElement.addEventListener('pointercancel', cancel);
    return () => { unsubscribe(); window.removeEventListener('blur', cancel); gl.domElement.removeEventListener('pointercancel', cancel); cancel(); };
  }, [editor, orbit, gl]);

  const down = (event: ThreeEvent<PointerEvent>, wall: Wall, id: string, mode: OpeningDragMode) => {
    if (event.button !== 0 || active.current || editor.getSnapshot().gestureLabel) return;
    event.stopPropagation(); setRejected(false);
    if (focus?.wallId !== wall.id || focus.openingId !== id) return;
    onSelect({ wallId: wall.id, openingId: id });
    const angle = level.rotation * Math.PI / 180;
    const opening=wall.openings!.find(o=>o.id===id)!,center=opening.offset+opening.width/2,tangent=wallTangent(wall,center/wallLength(wall));
    const axis = mode === 'top' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(tangent[0],0,tangent[1]).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    // A camera-facing plane containing the drag axis works for both plan and 3D.
    const normal = camera.getWorldDirection(new THREE.Vector3()); normal.addScaledVector(axis, -normal.dot(axis));
    if (normal.lengthSq() < 1e-5) { onStatus('Orbit the view slightly to use this handle.'); return; }
    if(wall.curve&&mode!=='top'&&Math.abs(event.ray.direction.y)>.1)normal.set(0,1,0);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), event.point);
    const origin = event.ray.intersectPlane(plane, new THREE.Vector3()); if (!origin) return;
    const target = event.target as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
    if (orbit) orbit.enabled = false;
    target.setPointerCapture(event.pointerId);
    active.current = { wall, id, mode, pointer: event.pointerId, plane, origin, axis,originAlong:openingDistanceAtPoint(wall,localPoint(origin),center), screen: [event.clientX, event.clientY], started: false, moved: false, valid: true, changed: false,
      release: () => { try { target.releasePointerCapture(event.pointerId); } catch { /* Already released. */ } } };
    editor.begin(mode === 'move' ? 'Move opening' : 'Resize opening'); active.current.started = true;
    onStatus('Selected opening. Drag the tinted area to move; square handles resize.');
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    const drag = active.current; if (!drag || drag.pointer !== event.pointerId) return;
    event.stopPropagation();
    if (!drag.moved && Math.hypot(event.clientX - drag.screen[0], event.clientY - drag.screen[1]) < 4) return;
    drag.moved = true;
    try {
      const point = event.ray.intersectPlane(drag.plane, new THREE.Vector3());
      if (!point) throw new Error('Keep the pointer on the editing plane.');
      const delta=drag.wall.curve&&drag.mode!=='top'?openingDistanceAtPoint(drag.wall,localPoint(point),drag.originAlong)-drag.originAlong:point.sub(drag.origin).dot(drag.axis);
      const wall = dragOpening(drag.wall, drag.id, drag.mode,delta, snapping);
      editor.preview({ type: 'replace', entity: wall });
      drag.valid = true; drag.changed = JSON.stringify(wall.openings) !== JSON.stringify(drag.wall.openings); setRejected(false);
      const opening = wall.openings!.find(o => o.id === drag.id)!;
      onStatus(`${drag.mode === 'move' ? 'Move' : 'Resize'} · offset ${opening.offset.toFixed(2)} m · ${opening.width.toFixed(2)} × ${opening.height.toFixed(2)} m. Release to apply; Esc cancels.`);
    } catch (error) {
      drag.valid = false; setRejected(true);
      onStatus(`${error instanceof Error ? error.message : 'Invalid edit.'} Release here cancels the entire drag.`);
    }
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    const drag = active.current; if (!drag || drag.pointer !== event.pointerId) return;
    move(event); event.stopPropagation(); active.current = null;
    if (drag.started) {
      if (drag.valid && drag.changed) { editor.commit(); onStatus('Opening updated. Drag again to adjust, or use the precise fields.'); }
      else { editor.cancel(); onStatus(drag.valid ? 'Opening unchanged.' : 'Drag cancelled. The original opening is restored.'); }
    }
    drag.release(); if (orbit) orbit.enabled = true; setRejected(false);
  };
  const events = { onPointerMove: move, onPointerUp: up, onPointerCancel: cancel, onLostPointerCapture: cancel, onClick: (event: ThreeEvent<MouseEvent>) => event.stopPropagation() };
  return <group position={level.position} rotation={[0, level.rotation * Math.PI / 180, 0]} userData={{ waterCaptureExclude: true }}>
    {walls.map(wall => <group key={wall.id}>
      {(wall.openings ?? []).map(opening => {
        const selected = focus?.wallId === wall.id && focus.openingId === opening.id;
        const center = opening.offset + opening.width / 2, y = topView ? wall.height + 0.12 : opening.sill + opening.height / 2;
        const color = selected ? rejected ? '#ed775f' : '#d7f29c' : '#8fbbb8';
        return <group key={opening.id} userData={{copyEntityId:wall.id,copyOpeningId:opening.id}}>
          <OpeningVolume wall={wall} opening={opening} topView={topView} color={color} opacity={selected ? .45 : .18} {...events} onPointerDown={event => down(event, wall, opening.id, 'move')}
            onClick={event => { event.stopPropagation(); if (!selected && event.button === 0 && event.delta <= 4) onSelect({ wallId: wall.id, openingId: opening.id }); }}/>
          {selected && <>
            {(['start', 'end', ...(topView ? [] : ['top'])] as OpeningDragMode[]).map(mode => <ResizeHandle key={mode}
              x={mode === 'start' ? opening.offset : mode === 'end' ? opening.offset + opening.width : center}
              y={mode === 'top' ? opening.sill + opening.height : y} wall={wall}
              down={event => down(event, wall, opening.id, mode)} move={move} up={up} cancel={cancel} />)}
            <ArchitectureLabel position={wallProfilePosition(wall,center,wall.height+.5)} text={`${opening.kind} · ${opening.width.toFixed(2)} × ${opening.height.toFixed(2)} m · ${opening.offset.toFixed(2)} m`} />
          </>}
        </group>;
      })}
    </group>)}
  </group>;
}
