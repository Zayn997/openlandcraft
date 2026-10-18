import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Edges, TransformControls } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { instancePosition, type Asset, type BuildingPart, type Editor, type Entity, type Instance, type Level, type Project } from '@openlandcraft/core';
import { disposeModel, loadModel } from './models';
import { instanceMatrix, staticMeshes } from './instancing';
const noRaycast = () => undefined;

function ModelCopy({ source, interactive }: { source: THREE.Group; interactive: boolean }) {
  const object = useMemo(() => clone(source), [source]);
  const raycasters = useMemo(() => { const values: { mesh: THREE.Mesh; raycast: THREE.Mesh['raycast'] }[] = []; object.traverse((child) => { if (child instanceof THREE.Mesh) values.push({ mesh: child, raycast: child.raycast }); }); return values; }, [object]);
  useLayoutEffect(() => { raycasters.forEach(({ mesh, raycast }) => { mesh.raycast = interactive ? raycast : noRaycast; }); }, [raycasters, interactive]);
  // Instances borrow geometry/materials; the source component owns disposal.
  return <primitive object={object} dispose={null} />;
}
function StaticBatch({ source, instances, project, interactive, onSelect }: { source: THREE.Mesh; instances: Instance[]; project: Project; interactive: boolean; onSelect: (id: string) => void }) {
  const batch = useMemo(() => new THREE.InstancedMesh(source.geometry, source.material, instances.length), [source, instances.length]);
  useLayoutEffect(() => {
    instances.forEach((entity, index) => batch.setMatrixAt(index, instanceMatrix(instancePosition(entity, project), entity.rotation, entity.scale, source.matrixWorld)));
    batch.instanceMatrix.needsUpdate = true; batch.computeBoundingBox(); batch.computeBoundingSphere();
  }, [batch, instances, project.site.terrain, source]);
  useEffect(() => () => batch.dispose(), [batch]);
  return <primitive object={batch} dispose={null} castShadow receiveShadow raycast={interactive ? THREE.InstancedMesh.prototype.raycast : noRaycast} onClick={(event: import('@react-three/fiber').ThreeEvent<MouseEvent>) => {
    if (interactive && event.delta <= 4 && event.instanceId !== undefined && instances[event.instanceId]) { event.stopPropagation(); onSelect(instances[event.instanceId].id); }
  }} />;
}
function ModelContent({ source, instances, project, selectedId, interactive, onSelect }: { source: THREE.Group; instances: Instance[]; project: Project; selectedId: string | null; interactive: boolean; onSelect: (id: string) => void }) {
  const meshes = useMemo(() => staticMeshes(source), [source]);
  const selected = instances.find((entity) => entity.id === selectedId);
  if (meshes) return <>{meshes.map((mesh) => <StaticBatch key={mesh.uuid} source={mesh} instances={instances} project={project} interactive={interactive} onSelect={onSelect} />)}{selected && <group position={instancePosition(selected, project)} rotation={[0, selected.rotation * Math.PI / 180, 0]} scale={selected.scale}><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} raycast={noRaycast}><ringGeometry args={[0.8, 1, 48]} /><meshBasicMaterial color="#d7f29c" side={THREE.DoubleSide} depthTest={false} /></mesh></group>}</>;
  return <>{instances.map((entity) => <group key={entity.id} position={instancePosition(entity, project)} rotation={[0, entity.rotation * Math.PI / 180, 0]} scale={entity.scale} onClick={(event) => { if (interactive && event.delta <= 4) { event.stopPropagation(); onSelect(entity.id); } }}><ModelCopy source={source} interactive={interactive} />{entity.id === selectedId && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} raycast={noRaycast}><ringGeometry args={[0.8, 1, 48]} /><meshBasicMaterial color="#d7f29c" side={THREE.DoubleSide} depthTest={false} /></mesh>}</group>)}</>;
}
export function ModelInstances({ asset, instances, project, selectedId, onSelect, onError, interactive }: {
  asset: Asset; instances: Instance[]; project: Project; selectedId: string | null; onSelect: (id: string) => void; onError: (message: string) => void; interactive: boolean;
}) {
  const [source, setSource] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true, owned: THREE.Group | undefined;
    setSource(null);
    loadModel(asset).then((root) => { if (!alive) { disposeModel(root); return; } owned = root; setSource(root); }).catch((error: unknown) => { if (alive) onError(`${asset.name}: ${error instanceof Error ? error.message : 'Model could not load.'}`); });
    return () => { alive = false; if (owned) disposeModel(owned); };
  }, [asset.data]);
  return source ? <ModelContent source={source} instances={instances} project={project} selectedId={selectedId} interactive={interactive} onSelect={onSelect} /> : null;
}

function RoofGeometry({ width, depth, rise }: { width: number; depth: number; rise: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, rise); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }); geometry.translate(0, 0, -depth / 2); return geometry;
  }, [width, depth, rise]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive attach="geometry" object={geometry} />;
}
function Part({ entity, selected, onSelect }: { entity: BuildingPart; selected: boolean; onSelect: (id: string) => void }) {
  const isWall = entity.kind === 'wall';
  const length = isWall ? Math.hypot(entity.end[0] - entity.start[0], entity.end[1] - entity.start[1]) : 0;
  const center = isWall ? [(entity.start[0] + entity.end[0]) / 2, (entity.start[1] + entity.end[1]) / 2] : entity.center;
  const y = entity.elevation + (isWall ? entity.height / 2 : entity.kind === 'slab' ? entity.thickness / 2 : 0);
  return <mesh position={[center[0], y, center[1]]} rotation={[0, isWall ? -Math.atan2(entity.end[1] - entity.start[1], entity.end[0] - entity.start[0]) : 0, 0]} castShadow receiveShadow
    onClick={(event) => { if (event.delta <= 4) { event.stopPropagation(); onSelect(entity.id); } }}>
    {entity.kind === 'roof' ? <RoofGeometry {...entity} /> : <boxGeometry args={isWall ? [length, entity.height, entity.thickness] : [entity.width, entity.thickness, entity.depth]} />}
    <meshStandardMaterial color={entity.color} roughness={0.8} />
    <Edges color={selected ? '#d7f29c' : '#798174'} lineWidth={selected ? 2 : 0.7} />
  </mesh>;
}
export function BuildingLevel({ level, parts, selectedId, onSelect }: { level: Level; parts: BuildingPart[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <group position={level.position} rotation={[0, level.rotation * Math.PI / 180, 0]}>
    {parts.map((entity) => <Part key={entity.id} entity={entity} selected={selectedId === entity.id || selectedId === level.id} onSelect={onSelect} />)}
  </group>;
}

export type TransformMode = 'translate' | 'rotate' | 'scale';
type Movable = Extract<Entity, { kind: 'instance' | 'level' | 'block' }>;
export function TransformGizmo({ entity, project, editor, mode, snapping }: { entity: Movable; project: Project; editor: Editor; mode: TransformMode; snapping: boolean }) {
  const orbit = useThree((state) => state.controls) as unknown as { enabled: boolean } | null;
  const gl = useThree((state) => state.gl);
  const control = useRef<TransformControlsImpl | null>(null);
  const [generation, setGeneration] = useState(0);
  const bindControl = useCallback((next: TransformControlsImpl | null) => { if (control.current && control.current !== next) control.current.dispose(); control.current = next; next?.connect(gl.domElement); }, [gl]);
  const object = useMemo(() => new THREE.Group(), []);
  const dragging = useRef(false);
  const baseline = useRef(entity);
  const reset = () => {
    object.position.set(...(entity.kind === 'instance' ? instancePosition(entity, project) : entity.position));
    object.rotation.set(0, entity.rotation * Math.PI / 180, 0);
    object.scale.fromArray(entity.kind === 'instance' ? entity.scale : [1, 1, 1]);
    object.updateMatrixWorld();
  };
  const latestReset = useRef(reset); latestReset.current = reset;
  useLayoutEffect(reset, [entity, project.site.terrain, object]);
  useEffect(() => editor.subscribe(() => {
    if (!editor.getSnapshot().gestureLabel && dragging.current) {
      dragging.current = false;
      // Discard the control's pointer session as well as the document preview.
      if (orbit) orbit.enabled = true;
      setGeneration((value) => value + 1);
    }
  }), [editor, orbit]);
  useEffect(() => {
    const cancel = () => { if (dragging.current) { editor.cancel(); latestReset.current(); } };
    window.addEventListener('blur', cancel); window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('blur', cancel); window.removeEventListener('pointercancel', cancel); if (dragging.current) { dragging.current = false; editor.cancel(); if (orbit) orbit.enabled = true; } };
  }, [editor, object, orbit]);
  const gesture = editor.getSnapshot().gestureLabel;
  return <><primitive object={object} /><TransformControls key={generation} ref={bindControl} enabled={!gesture || gesture.startsWith('Transform ')} object={object} mode={mode === 'scale' && entity.kind !== 'instance' ? 'translate' : mode} showX={mode !== 'rotate'} showY={mode !== 'translate' || entity.kind !== 'instance' || entity.anchor === 'fixed'} showZ={mode !== 'rotate'}
    translationSnap={snapping ? 0.5 : null} rotationSnap={snapping ? Math.PI / 12 : null} scaleSnap={snapping ? 0.1 : null}
    onMouseDown={() => { editor.cancel(); baseline.current = entity; editor.begin(`Transform ${entity.name}`); dragging.current = true; }}
    onObjectChange={() => {
      if (!dragging.current || !editor.getSnapshot().gestureLabel) return;
      const base = baseline.current, position = object.position.toArray() as [number, number, number];
      position[0] = Math.max(-500, Math.min(500, position[0])); position[2] = Math.max(-500, Math.min(500, position[2]));
      if (base.kind === 'instance' && base.anchor === 'terrain') position[1] = base.position[1];
      position[1] = Math.max(-50, Math.min(100, position[1]));
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion);
      const rotation = THREE.MathUtils.radToDeg(Math.atan2(forward.x, forward.z));
      const next: Movable = base.kind === 'instance' ? { ...base, position, rotation, scale: object.scale.toArray().map((value) => Math.max(0.05, Math.min(20, value))) as Instance['scale'] } : { ...base, position, rotation };
      editor.preview({ type: 'replace', entity: next });
    }}
    onMouseUp={() => { if (dragging.current) { dragging.current = false; editor.commit(); } }} /></>;
}
