import { FishInstances } from './fish';
import { GroundCharacterInstances } from './ground-characters';
import { BirdInstances } from './birds';
import { plantGrowthScale, PLANT_GROWTH_MS } from './plant-growth';
import { advancePlantWind, createPlantWind } from './plant-wind';
import {ArchitectureLabel} from './architecture-label';
import {buildPartGeometry} from './architecture-geometry';
import {footprint, wallLength, type Wall} from '@openlandcraft/core';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
function StaticBatch({ source, instances, project, interactive, onSelect, growth, windEnabled, playing }: { windEnabled?: boolean; playing?: boolean; growth?: ReadonlyMap<string, number>; source: THREE.Mesh; instances: Instance[]; project: Project; interactive: boolean; onSelect: (id: string) => void }) {
  const wind = useMemo(() => source.userData.plantWind ? createPlantWind(source) : null, [source]);
  useEffect(() => () => wind?.dispose(), [wind]);
  const reducedWind = useRef(false);
  useEffect(() => {
    if (!wind) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedWind.current = preference.matches; };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, [wind]);
  const batch = useMemo(() => new THREE.InstancedMesh(source.geometry, source.material, instances.length), [source, instances.length]);
  useLayoutEffect(() => {
    instances.forEach((entity, index) => batch.setMatrixAt(index, instanceMatrix(instancePosition(entity, project), entity.rotation, entity.scale, source.matrixWorld)));
    batch.instanceMatrix.needsUpdate = true; batch.computeBoundingBox(); batch.computeBoundingSphere();
    if (wind) {
      const margin = wind.maxDisplacement * Math.max(...instances.flatMap(e => e.scale));
      batch.boundingBox?.expandByScalar(margin);
      if (batch.boundingSphere) batch.boundingSphere.radius += margin;
    }
  }, [batch, instances, project.site.terrain, source]);
  const animating = useRef<{ index: number; entity: Instance; start: number }[]>([]);
  useLayoutEffect(() => {
    const now = performance.now();
    animating.current = instances.flatMap((entity, index) => {
      const start = growth?.get(entity.id);
      return start !== undefined && now - start < PLANT_GROWTH_MS ? [{ index, entity, start }] : [];
    });
    // Full-sized bounds above remain conservative throughout growth.
    for (const { index, entity, start } of animating.current) {
      const factor = plantGrowthScale(start, now);
      batch.setMatrixAt(index, instanceMatrix(instancePosition(entity, project), entity.rotation, entity.scale.map(v => v * factor) as Instance['scale'], source.matrixWorld));
    }
    if (animating.current.length) batch.instanceMatrix.needsUpdate = true;
  }, [batch, instances, growth, project.site.terrain, source]);
  useFrame((_, delta) => {
    if (wind) {
      const state = advancePlantWind(wind.uniforms.uPlantWindTime.value, delta, playing ?? true, windEnabled ?? true, reducedWind.current);
      wind.uniforms.uPlantWindTime.value = state.time;
      wind.uniforms.uPlantWindEnabled.value = state.strength;
    }
    if (!animating.current.length) return;
    const now = performance.now(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    animating.current = animating.current.filter(({ index, entity, start }) => {
      const factor = reduced ? 1 : plantGrowthScale(start, now);
      batch.setMatrixAt(index, instanceMatrix(instancePosition(entity, project), entity.rotation, entity.scale.map(v => v * factor) as Instance['scale'], source.matrixWorld));
      return factor < 1;
    });
    batch.instanceMatrix.needsUpdate = true;
  }, -0.3);
  useEffect(() => () => batch.dispose(), [batch]);
  return <primitive object={batch} material={wind?.material ?? source.material} customDepthMaterial={wind?.depth} customDistanceMaterial={wind?.distance} userData={{copyInstanceIds:instances.map(e=>e.id)}} dispose={null} castShadow receiveShadow raycast={interactive ? THREE.InstancedMesh.prototype.raycast : noRaycast} onClick={(event: import('@react-three/fiber').ThreeEvent<MouseEvent>) => {
    if (interactive && event.delta <= 4 && event.instanceId !== undefined && instances[event.instanceId]) { event.stopPropagation(); onSelect(instances[event.instanceId].id); }
  }} />;
}
function ModelContent({ source, instances, project, selectedId, selectedIds=[], interactive, onSelect, growth, windEnabled, playing }: { windEnabled?: boolean; playing?: boolean; growth?: ReadonlyMap<string, number>; selectedIds?:string[]; source: THREE.Group; instances: Instance[]; project: Project; selectedId: string | null; interactive: boolean; onSelect: (id: string) => void }) {
  const meshes = useMemo(() => staticMeshes(source), [source]);
  const selected = instances.filter((entity) => selectedIds.includes(entity.id)||entity.id === selectedId);
  if (source.userData.groundCharacter) return <GroundCharacterInstances source={source} instances={instances} interactive={interactive} selectedIds={selected.map(e => e.id)} onSelect={onSelect}/>;
  if (source.userData.fishSwim) return <FishInstances source={source} instances={instances} interactive={interactive} selectedIds={selected.map(e => e.id)} onSelect={onSelect}/>;
  if (source.userData.birdFlight) return <BirdInstances source={source} instances={instances} project={project} playing={playing ?? true} interactive={interactive} selectedIds={selected.map(e => e.id)} onSelect={onSelect}/>;
  if (meshes) return <>{meshes.map((mesh) => <StaticBatch key={mesh.uuid} windEnabled={windEnabled} playing={playing} growth={growth} source={mesh} instances={instances} project={project} interactive={interactive} onSelect={onSelect} />)}{selected.map(selected=><group key={selected.id} position={instancePosition(selected, project)} rotation={[0, selected.rotation * Math.PI / 180, 0]} scale={selected.scale}><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} raycast={noRaycast}><ringGeometry args={[0.8, 1, 48]} /><meshBasicMaterial color="#d7f29c" side={THREE.DoubleSide} depthTest={false} /></mesh></group>)}</>;
  return <>{instances.map((entity) => <group key={entity.id} userData={{copyEntityId:entity.id}} position={instancePosition(entity, project)} rotation={[0, entity.rotation * Math.PI / 180, 0]} scale={entity.scale} onClick={(event) => { if (interactive && event.delta <= 4) { event.stopPropagation(); onSelect(entity.id); } }}><ModelCopy source={source} interactive={interactive} />{(selectedIds.includes(entity.id)||entity.id === selectedId) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} raycast={noRaycast}><ringGeometry args={[0.8, 1, 48]} /><meshBasicMaterial color="#d7f29c" side={THREE.DoubleSide} depthTest={false} /></mesh>}</group>)}</>;
}
export function ModelInstances({ asset, instances, project, selectedId, selectedIds, onSelect, onError, interactive, growth, windEnabled, playing }: { windEnabled?: boolean; playing?: boolean; growth?: ReadonlyMap<string, number>; selectedIds?:string[];
  asset: Asset; instances: Instance[]; project: Project; selectedId: string | null; onSelect: (id: string) => void; onError: (message: string) => void; interactive: boolean;
}) {
  const [source, setSource] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true, owned: THREE.Group | undefined;
    setSource(null);
    loadModel(asset).then((root) => { if (!alive) { disposeModel(root); return; } owned = root; setSource(root); }).catch((error: unknown) => { if (alive) onError(`${asset.name}: ${error instanceof Error ? error.message : 'Model could not load.'}`); });
    return () => { alive = false; if (owned) disposeModel(owned); };
  }, [asset.data]);
  return source ? <group onPointerDown={event=>{if(interactive)event.stopPropagation();}} onPointerMove={event=>{if(interactive)event.stopPropagation();}}><ModelContent windEnabled={windEnabled} playing={playing} growth={growth} source={source} instances={instances} project={project} selectedId={selectedId} selectedIds={selectedIds} interactive={interactive} onSelect={onSelect} /></group> : null;
}

function Part({ entity, walls, selected, dimensions, onSelect, onWallPick, onOutlinePick, activeEdit=false, interactive, blocking=false }: { onWallPick?: (id: string, doubleClick: boolean) => void; onOutlinePick?: (id: string, doubleClick: boolean) => void; activeEdit?: boolean; blocking?:boolean;interactive:boolean;entity: BuildingPart; walls: Wall[]; selected: boolean; dimensions:boolean; onSelect: (id: string,additive?:boolean) => void }) {
  const geometry=useMemo(()=>buildPartGeometry(entity,walls),[entity,walls]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const points=entity.kind==='wall'?[entity.start,entity.end]:footprint(entity);
  const edges=entity.kind==='wall'?1:points.length;
  const top=entity.elevation+(entity.kind==='wall'?entity.height:entity.kind==='roof'?entity.rise:entity.thickness);
  return <>
    <mesh userData={{copyEntityId:entity.id}} raycast={!activeEdit&&(interactive||blocking)?THREE.Mesh.prototype.raycast:noRaycast} geometry={geometry} castShadow receiveShadow onPointerDown={event=>{if(blocking)event.stopPropagation();}} onPointerMove={event=>{if(blocking)event.stopPropagation();}} onClick={event=>{if(blocking)event.stopPropagation();if(interactive&&event.delta<=4){event.stopPropagation();if(entity.kind==='wall'&&onWallPick&&!event.shiftKey)onWallPick(entity.id,false);else if((entity.kind==='slab'||entity.kind==='roof')&&onOutlinePick&&!event.shiftKey)onOutlinePick(entity.id,false);else onSelect(entity.id,event.shiftKey);}}} onDoubleClick={event=>{if(blocking)event.stopPropagation();if(interactive&&entity.kind==='wall'&&onWallPick&&!event.shiftKey&&event.delta<=4){event.stopPropagation();onWallPick(entity.id,true);}else if(interactive&&(entity.kind==='slab'||entity.kind==='roof')&&onOutlinePick&&!event.shiftKey&&event.delta<=4){event.stopPropagation();onOutlinePick(entity.id,true);}}}>
      <meshStandardMaterial color={entity.color} roughness={0.8}/><Edges raycast={noRaycast} color={selected?'#d7f29c':'#798174'} lineWidth={selected?2:0.7}/>
    </mesh>
    {dimensions&&Array.from({length:edges},(_,i)=>{const a=points[i],b=points[(i+1)%points.length];return <ArchitectureLabel key={i} position={[(a[0]+b[0])/2,top+0.18,(a[1]+b[1])/2]} text={`${Math.hypot(b[0]-a[0],b[1]-a[1]).toFixed(2)} m`}/>;})}
    {dimensions&&entity.kind==='wall'&&(entity.openings??[]).map(o=>{const t=(o.offset+o.width/2)/wallLength(entity);return <ArchitectureLabel key={o.id} position={[entity.start[0]+(entity.end[0]-entity.start[0])*t,entity.elevation+o.sill+o.height/2,entity.start[1]+(entity.end[1]-entity.start[1])*t]} text={`${o.kind} · ${o.width.toFixed(2)} × ${o.height.toFixed(2)} m`}/>;})}
  </>;
}
export function BuildingLevel({ level, parts, selectedId, selectedIds=[], onSelect, onWallPick, onOutlinePick, editingPartId, interactive, placingOpening=false, editingOpening=false }: { onWallPick?: (id: string, doubleClick: boolean) => void; onOutlinePick?: (id: string, doubleClick: boolean) => void; editingPartId?: string; editingOpening?:boolean;placingOpening?:boolean;interactive:boolean; level: Level; parts: BuildingPart[]; selectedId: string | null; selectedIds?:string[]; onSelect: (id: string,additive?:boolean) => void }) {
  const wallKey=JSON.stringify(parts.filter(p=>p.kind==='wall'));
  const walls=useMemo(()=>parts.filter((p):p is Wall=>p.kind==='wall'),[wallKey]);
  return <group position={level.position} rotation={[0,level.rotation*Math.PI/180,0]}>
    {parts.map(entity=><Part key={entity.id} entity={entity} walls={walls} interactive={interactive} activeEdit={editingPartId===entity.id} onWallPick={onWallPick} onOutlinePick={onOutlinePick} blocking={editingOpening||placingOpening&&entity.kind!=='wall'} selected={selectedIds.length?selectedIds.includes(entity.id):selectedId===entity.id||selectedId===level.id} dimensions={interactive&&selectedId===entity.id&&!selectedIds.length&&editingPartId!==entity.id} onSelect={onSelect}/>)}
  </group>;
}

export type TransformMode = 'translate' | 'rotate' | 'scale';
type Movable = Extract<Entity, { kind: 'instance' | 'level' | 'block' }>;
export function TransformGizmo({ entity, project, editor, mode, snapping, onError }: { onError:(message:string)=>void; entity: Movable; project: Project; editor: Editor; mode: TransformMode; snapping: boolean }) {
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
      try { editor.preview({ type: 'replace', entity: next }); } catch(error) { editor.cancel(); latestReset.current(); onError(error instanceof Error?error.message:'The transform could not be applied.'); }
    }}
    onMouseUp={() => { if (dragging.current) { dragging.current = false; editor.commit(); } }} /></>;
}
