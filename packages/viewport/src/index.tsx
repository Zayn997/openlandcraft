import {TowerDrawing,type TowerDrawingProps} from './tower-drawing';
import { FishSchoolProvider } from './fish-school-provider';
import { GroundCharacterProvider } from './ground-characters';
import { LibraryPlacementPreview } from './plant-preview';
import { usePlantBrush, type PlantBrushOptions } from './plant-brush';
import { openingCenter,layerDisplayProject, objectLayerState, canEditObject, characterWalkingPath, ROUND_ROUTE_GESTURE, ROUND_PATH_GESTURE } from '@openlandcraft/core';
import {DragCopy, type CopyResult} from './drag-copy';
import { TerrainClosure } from './terrain-solid';
import {StairAttachmentTargets,type StairAttachmentProps} from './stair-attachment';
import {OutlineEdit, type OutlineEditProps} from './outline-edit';
import { cameraFlight } from './camera-flight';
import {projectionCamera,fitOrthographicCamera,preserveProjectionFraming,type CameraProjection} from './camera-projection';
export type {CameraProjection} from './camera-projection';
import { orbitPosition, orientationPosition, type CameraView, type OrientationView } from './navigation';
import { ViewNavigator, type NavigationBridge } from './view-navigator';
export type { CameraView } from './navigation';
import {WallEdit, type WallEditProps} from './wall-edit';
import {OpeningSelection, type OpeningSelectionProps} from './opening-selection';
import {OpeningEdit, type OpeningEditProps} from './opening-edit';
import {ArchitectureDrawing} from './architecture-drawing';
import {CurvedWallDrawing} from './curved-wall-drawing';
import {RepeatDrawing,type RepeatDrawingProps} from './repeat-drawing';
import {ConicalRoofDrawing} from './conical-roof-drawing';
import {StairsDrawing} from './stairs-drawing';
import {OpeningPlacement, type OpeningPlacementProps} from './opening-placement';
import {FloorCopyAnchor,FloorCopyGhost} from './floor-copy';
import {partBounds,footprint,scopeBounds,unitForPart,type DuplicateAbove} from '@openlandcraft/core';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { evaluateProject, isBirdAsset, isFishAsset, isGroundCharacterAsset, fishSchools, isRegion, groundHeight, instancePosition, type Block, type Project, type Editor, type BuildingPart, type Instance } from '@openlandcraft/core';
import { TerrainStroke, roundedRoutePoints, type BrushSettings, type RiverPoint, type PathPoint } from '@openlandcraft/landscape';
import { RiverDraft, RiverLayer } from './river';
import { PathDraft, PathLayer } from './path';
import { useDrawingClick } from './drawing-gesture';
import {LakeLayer,LakeDraft} from './lake';
import {RegionLayer,RegionDraft} from './region';
import {LakeSystem} from './lake-system';
import { OceanSurface } from './ocean';
import { CoastSystem, CoastalTerrainMaterial } from './coast-system';
import { WaterOptics } from './water-optics';
import { RiverSystem } from './river-system';
import { shoreCamera } from './shore-camera';
import { underwaterCamera } from './underwater-camera';
export { underwaterCamera } from './underwater-camera';
import {inlandWaterCamera} from './inland-camera';
export {inlandWaterCamera} from './inland-camera';
import { intersectTerrain } from './terrain-picking';
import { updateTerrainNormals } from './terrain-normals';
import { BuildingLevel, ModelInstances, TransformGizmo, type TransformMode } from './objects';
export { validateModels } from './models';
export type { TransformMode } from './objects';

export type ViewportMetrics = { fps: number; calls: number; triangles: number; renderer: string;
  resources?:{geometries:number;textures:number;programs:number};
  buffer?:{width:number;height:number;dpr:number};
};
type Props = {
  towerDrawing?:TowerDrawingProps;
  repeatDrawing?:RepeatDrawingProps;
  plantAsset?: import('@openlandcraft/core').Asset | null;
  plantGrowth?: ReadonlyMap<string, number>;
  plantWind?: boolean;
  plantBrush?: PlantBrushOptions;
  onCopyPlaced: (result: CopyResult) => void; onCopyStatus: (message:string) => void;
  isolatedLayerId?: string | null;
  project: Project; selectedId: string | null; onSelect: (id: string | null,additive?:boolean) => void;
  selectedIds?:string[];isolateLevelId?:string|null;floorCopy?:DuplicateAbove|null;copyAnchor?:React.RefObject<HTMLDivElement|null>;copying?:boolean;
  openingPlacement?: Omit<OpeningPlacementProps, 'walls'|'project'>;
  openingSelection?: OpeningSelectionProps;
  onWallPick?: (id: string, doubleClick: boolean) => void;
  wallEditing?: WallEditProps;
  onOutlinePick?: (id:string,doubleClick:boolean)=>void;
  outlineEditing?: OutlineEditProps;
  stairAttachment?:StairAttachmentProps;
  openingEditing?: Omit<OpeningEditProps, 'walls'|'editor'|'snapping'|'topView'>;
  grid: boolean; playing: boolean; quality: 'low' | 'high';
  view: CameraView; projection:CameraProjection;onNavigationView: (view: CameraView) => void; frameToken: number; frameCancelToken: number;
  onMetrics: (metrics: ViewportMetrics) => void;
  editor: Editor; tool: 'select' | 'tower' | 'repeat' | 'plant' | 'terrain' | 'building' | 'wall' | 'floor' | 'roof' | 'stairs' | 'door' | 'window' | 'opening-edit' | 'wall-edit' | 'outline-edit' | 'river' | 'path' | 'lake' | 'region'; brush: BrushSettings;
  onStrokeTime: (milliseconds: number) => void;
  onGroundPoint: (x: number, z: number) => void; onError: (message: string) => void;
  transformMode: TransformMode; snapping: boolean;
  architectureDrawing?: {level: import('@openlandcraft/core').Level; kind: 'wall'|'floor'|'roof'|'stairs'; offset: number; thickness: number; wallShape:import('@openlandcraft/core').WallShape; height:number; clockwise:boolean;roofShape:import('@openlandcraft/core').RoofShape;roofHeight:number;roofOverhang:number;tower?:import('@openlandcraft/core').Wall;stairDimensions:import('@openlandcraft/core').StairDrawingDimensions;stairShape:import('@openlandcraft/core').StairShape;stairTower?:import('@openlandcraft/core').Wall};
  wallDraft:PathPoint[];regionDraft:PathPoint[]; riverDraft: RiverPoint[]; pathDraft: PathPoint[]; pathDraftWidth?:number; lakeDraft:PathPoint[];lakeDraftLevel:number;
  routeCornerControls?:ReactNode;draftCornerControls?:ReactNode;pathDraftRounding?:number[];draftRouteAnchor?:number|null;onDraftRouteAnchor?:(index:number)=>void;selectedRouteAnchor?:number|null;onRouteAnchor?:(index:number)=>void;
  waterPreview: { reset: number; step: number; riverReset:number; riverStep:number; lakeReset:number; lakeStep:number };
};

class CanvasBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? <div className="canvas-error"><strong>The 3D view could not start.</strong><p>Try a browser with WebGL 2 enabled. Your scene and inspector remain available.</p></div> : this.props.children;
  }
}

function Terrain({ project, editor, tool, brush, onStrokeTime, onGroundPoint, onSelect, plantAsset, snapping, plantBrush, onError,stairAttachment }: Props) {
  const painting = tool === 'plant' && !!plantBrush;
  const paint = usePlantBrush({ enabled: painting, asset: plantAsset, options: plantBrush, editor, project, onError });
  const mesh = useRef<THREE.Mesh>(null);
  const previous = useRef<{ geometry: THREE.BufferGeometry; heights: number[]; authored:number[] } | null>(null);
  const authoredHeights=(editor.getSnapshot().preview??editor.getSnapshot().project).site.terrain.heights;
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const stroke = useRef<{ stroke: TerrainStroke; plane: THREE.Plane; release: () => void; pointerId: number } | null>(null);
  const scheduled = useRef<number | null>(null);
  const pendingInputTime = useRef<number | null>(null);
  const previewReady = useRef(false);
  const { gl } = useThree();
  const drawingClick=useDrawingClick(gl.domElement,tool==='path');
  const geometry = useMemo(() => {
    const { width, depth } = project.site;
    const geometry = new THREE.PlaneGeometry(width, depth, project.site.terrain.columns - 1, project.site.terrain.rows - 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
    geometry.setAttribute('channel',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count),1));
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-width / 2 - 0.01, -9, -depth / 2 - 0.01), new THREE.Vector3(width / 2 + 0.01, 35, depth / 2 + 0.01));
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    return geometry;
  }, [project.site.width, project.site.depth, project.site.terrain.columns, project.site.terrain.rows]);
  useLayoutEffect(() => {
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color, color = new THREE.Color();
    const baseline = previous.current?.geometry === geometry ? previous.current.heights : null, changed: number[] = [];
    const sand = new THREE.Color('#d9c9a7');
    const grass = new THREE.Color('#869777');
    const seabed = new THREE.Color('#bcba9d');
    for (let i = 0; i < positions.count; i++) {
      if (baseline && baseline[i] === project.site.terrain.heights[i] && previous.current?.authored[i]===authoredHeights[i]) continue;
      changed.push(i);
      const y = project.site.terrain.heights[i];
      positions.setY(i, y);
      geometry.attributes.channel.setX(i,THREE.MathUtils.smoothstep(authoredHeights[i]-y,0.02,0.35));
      const land = THREE.MathUtils.smoothstep(y, 0.7, 3.5);
      if (y < -1) color.copy(seabed).lerp(sand, THREE.MathUtils.smoothstep(y, -4, -1)); else color.copy(sand).lerp(grass, land);
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
    geometry.attributes.channel.needsUpdate=true;
    positions.needsUpdate = true;
    if (!baseline || changed.length > positions.count / 20) geometry.computeVertexNormals();
    else updateTerrainNormals(geometry, changed, project.site.terrain.columns, project.site.terrain.rows);
    previous.current = { geometry, heights: project.site.terrain.heights, authored:authoredHeights };
    previewReady.current = true;
  }, [geometry, project.site.terrain,authoredHeights]);
  useFrame(() => {
    if (previewReady.current && pendingInputTime.current !== null) {
      onStrokeTime(performance.now() - pendingInputTime.current);
      pendingInputTime.current = null; previewReady.current = false;
    }
  });
  useEffect(() => () => geometry.dispose(), [geometry]);

  const cancel = () => {
    if (scheduled.current !== null) cancelAnimationFrame(scheduled.current);
    scheduled.current = null;
    pendingInputTime.current = null;
    const active = stroke.current; stroke.current = null;
    if (active) { active.release(); editor.cancel(); }
  };
  useEffect(() => {
    const release = editor.subscribe(() => { if (!editor.getSnapshot().gestureLabel && stroke.current) cancel(); });
    const blur = () => cancel();
    window.addEventListener('blur', blur);
    const domCancel = () => cancel();
    gl.domElement.addEventListener('pointercancel', domCancel);
    return () => { release(); window.removeEventListener('blur', blur); gl.domElement.removeEventListener('pointercancel', domCancel); cancel(); };
  }, [editor, gl]);
  useEffect(() => { if (tool !== 'terrain') { cancel(); setCursor(null); } }, [tool]);

  const publish = () => {
    scheduled.current = null;
    if (!stroke.current || !editor.getSnapshot().gestureLabel) return;
    try{editor.preview({ type: 'terrain', field: stroke.current.stroke.snapshot() });return true;}catch(error){cancel();onError(error instanceof Error?error.message:'The terrain change could not be applied.');return false;}
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (painting) { paint.move(event); return; }
    if(tool==='door'||tool==='window'||(tool==='opening-edit'||tool==='wall-edit'||tool==='outline-edit')&&!editor.getSnapshot().gestureLabel){event.stopPropagation();return;}
    if (tool === 'plant') { event.stopPropagation(); setCursor([snapping ? Math.round(event.point.x * 2) / 2 : event.point.x, snapping ? Math.round(event.point.z * 2) / 2 : event.point.z]); return; }
    if (tool !== 'terrain') return;
    event.stopPropagation();
    if (stroke.current && event.pointerId !== stroke.current.pointerId) return;
    const point = stroke.current ? event.ray.intersectPlane(stroke.current.plane, new THREE.Vector3()) : event.point;
    if (!point) return;
    setCursor([point.x, point.z]);
    if (!stroke.current) return;
    pendingInputTime.current ??= performance.now();
    previewReady.current = false;
    stroke.current.stroke.move(point.x, point.z);
    if (scheduled.current === null) scheduled.current = requestAnimationFrame(publish);
  };
  const down = (event: ThreeEvent<PointerEvent>) => {
    if (painting) { paint.down(event); return; }
    if((tool==='opening-edit'||tool==='wall-edit'||tool==='outline-edit')&&!editor.getSnapshot().gestureLabel){event.stopPropagation();return;}
    if (tool !== 'terrain' || event.button !== 0 || stroke.current) return;
    event.stopPropagation();
    editor.cancel();
    editor.select('terrain');
    editor.begin(`${brush.kind[0].toUpperCase() + brush.kind.slice(1)} terrain`);
    const baseline = editor.getSnapshot().project;
    const session = new TerrainStroke(baseline.site.terrain, baseline.site, { ...brush });
    const capture = event.target as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
    capture.setPointerCapture(event.pointerId);
    stroke.current = { stroke: session, plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -event.point.y), release: () => { try { capture.releasePointerCapture(event.pointerId); } catch { /* Already released by the browser. */ } }, pointerId: event.pointerId };
    pendingInputTime.current = performance.now(); previewReady.current = false;
    session.move(event.point.x, event.point.z);
    setCursor([event.point.x, event.point.z]);
    publish();
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    if (painting) { paint.up(event); return; }
    if (!stroke.current || stroke.current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    move(event);
    if (scheduled.current !== null) cancelAnimationFrame(scheduled.current);
    if(!publish())return;
    const active = stroke.current; stroke.current = null;
    editor.commit(); active.release();
  };
  const ring = useMemo(() => {
    if (!cursor || tool !== 'terrain') return null;
    const points = Array.from({ length: 65 }, (_, index) => {
      const angle = index / 64 * Math.PI * 2;
      const x = cursor[0] + Math.cos(angle) * brush.radius, z = cursor[1] + Math.sin(angle) * brush.radius;
      return new THREE.Vector3(x, groundHeight(x, z, project.site) + 0.12, z);
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [cursor, brush.radius, tool, project.site.terrain]);
  useEffect(() => () => ring?.dispose(), [ring]);
  return <group>
    <mesh ref={mesh} geometry={geometry} receiveShadow raycast={(raycaster, hits) => { const hit = intersectTerrain(raycaster.ray, project.site); if (hit && hit.distance >= raycaster.near && hit.distance <= raycaster.far && mesh.current) hits.push({ ...hit, object: mesh.current }); }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={painting ? paint.cancel : cancel} onLostPointerCapture={painting ? paint.cancel : cancel} onPointerOut={() => { paint.out(); if (!stroke.current) setCursor(null); }} onClick={(event) => { if(stairAttachment){event.stopPropagation();if(stairAttachment.end==='bottom'&&stairAttachment.surface==='terrain'&&event.button===0&&event.delta<=4)stairAttachment.onPick([event.point.x,event.point.z]);return;} if (tool === 'terrain'||tool==='door'||tool==='window'||(tool==='opening-edit'||tool==='wall-edit'||tool==='outline-edit')) event.stopPropagation(); if (((tool === 'plant' && !painting) || tool === 'tower' || tool === 'repeat' || tool === 'building' || tool === 'river' || tool === 'path' || tool === 'lake' || tool === 'region') && event.button === 0 && event.delta <= 4 && drawingClick(event.button)) { event.stopPropagation(); onGroundPoint(event.point.x, event.point.z); } else if (tool === 'select' && event.delta <= 4) { event.stopPropagation(); onSelect(null); } }}>
      <CoastalTerrainMaterial site={project.site} />
    </mesh>
    {ring && <lineLoop geometry={ring} raycast={() => undefined} renderOrder={10} userData={{waterCaptureExclude:true}}><lineBasicMaterial color={brush.kind === 'lower' ? '#e7b0a1' : '#e4ffb2'} depthTest={false} /></lineLoop>}
    {paint.ring}
    {tool === 'plant' && !painting && plantAsset && <LibraryPlacementPreview key={plantAsset.id} asset={plantAsset} cursor={cursor} project={project} />}
    <TerrainClosure site={project.site}/>
  </group>;
}

function Massing({ entity, selected, onSelect, blockOpeningEdit=false }: { blockOpeningEdit?:boolean;entity: Block; selected: boolean; onSelect: (id: string) => void }) {
  return <group userData={{copyEntityId:entity.id}} position={entity.position} rotation={[0, entity.rotation * Math.PI / 180, 0]}>
    <mesh position={[0, entity.size[1] / 2, 0]} castShadow receiveShadow onPointerDown={event=>{if(blockOpeningEdit)event.stopPropagation();}} onPointerMove={event=>{if(blockOpeningEdit)event.stopPropagation();}} onClick={(event) => {
      if (event.delta > 4) return;
      event.stopPropagation(); onSelect(entity.id);
    }}>
      <boxGeometry args={entity.size} />
      <meshStandardMaterial color={entity.color} roughness={0.75} />
      <Edges threshold={20} color={selected ? '#d7f29c' : '#7b8176'} lineWidth={selected ? 2 : 0.7} userData={{waterCaptureExclude:true}} />
    </mesh>
    {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} userData={{waterCaptureExclude:true}}>
      <planeGeometry args={[entity.size[0] + 1.3, entity.size[2] + 1.3]} />
      <meshBasicMaterial color="#d0e89d" transparent opacity={0.24} depthWrite={false} />
    </mesh>}
  </group>;
}

function CameraRig({ project, selectedId, view, projection, onNavigationView, frameToken, frameCancelToken, tool, openingEditing, openingSelection, navigation, plantBrush }: Props & { navigation: React.RefObject<NavigationBridge> }) {
  const { camera, controls, size, gl, scene,set } = useThree();
  type Orbit = { object:THREE.Camera;target: THREE.Vector3; update: () => void; enableDamping: boolean };
  const flight = useRef<{ sample: ReturnType<typeof cameraFlight>; elapsed: number; duration: number; orbit: Orbit; damping: boolean } | null>(null);
  const initialized = useRef(false);
  const navigationView = useRef<{ view: CameraView; frameToken: number } | null>(null);
  const previousView=useRef(view);
  const projectionSwap=useRef<{camera:THREE.Camera;target:THREE.Vector3;reframe:boolean}|null>(null);
  const stopFlight = () => { const active = flight.current; flight.current = null; if (active) active.orbit.enableDamping = active.damping; };
  useLayoutEffect(()=>{
    const orbit=controls as unknown as Orbit|null;
    if(!orbit||orbit.object!==camera||(projection==='orthographic')===(camera instanceof THREE.OrthographicCamera))return;
    stopFlight();const target=orbit.target.clone(),next=projectionCamera(camera,projection,target,size.width/size.height);
    next.position.copy(orientationPosition(projection==='orthographic'?'axonometric':'perspective',target,next.position.distanceTo(target)));
    next.lookAt(target);next.updateMatrixWorld();projectionSwap.current={camera:next,target,reframe:!preserveProjectionFraming(previousView.current,view)};set({camera:next});
  },[projection,camera,controls,set]);
  useLayoutEffect(()=>{
    if(camera instanceof THREE.OrthographicCamera){const zoom=camera.zoom;fitOrthographicCamera(camera,camera.top-camera.bottom,size.width/size.height);camera.zoom=zoom;camera.updateProjectionMatrix();}
  },[camera,size.width,size.height]);
  useLayoutEffect(() => { stopFlight(); }, [frameCancelToken]);
  useLayoutEffect(() => {
    const orbit = controls as unknown as Orbit | null;
    if (!orbit) return;
    const changeView = (next: CameraView) => {
      if (next !== view) { navigationView.current = { view: next, frameToken }; onNavigationView(next); }
    };
    const drain = () => {
      stopFlight();
      const damping = orbit.enableDamping;
      orbit.enableDamping = false; orbit.update();
      return damping;
    };
    navigation.current.stop = stopFlight;
    navigation.current.snap = requested => {
      const next=requested==='perspective'&&projection==='orthographic'?'axonometric':requested;
      const damping = drain();
      const destination = orientationPosition(next, orbit.target, camera.position.distanceTo(orbit.target));
      changeView(next);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        camera.position.copy(destination); camera.lookAt(orbit.target); orbit.update(); orbit.enableDamping = damping;
      } else flight.current = { sample: cameraFlight(camera.position, orbit.target, destination, orbit.target), elapsed: 0, duration: 0.35, orbit, damping };
    };
    navigation.current.rotate = (dx, dy) => {
      const damping = drain();
      camera.position.copy(orbitPosition(camera.position, orbit.target, dx, dy));
      camera.lookAt(orbit.target); orbit.update(); orbit.enableDamping = damping;
      changeView(projection==='orthographic'?'axonometric':'perspective');
    };
    return () => { delete navigation.current.snap; delete navigation.current.rotate; delete navigation.current.stop; };
  }, [camera, controls, view, projection, frameToken, onNavigationView, navigation]);
  useFrame(() => { navigation.current.sync?.(camera.quaternion); });
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') stopFlight(); };
    gl.domElement.addEventListener('pointerdown', stopFlight, true);
    gl.domElement.addEventListener('wheel', stopFlight, true);
    window.addEventListener('keydown', escape, true);
    return () => { stopFlight(); gl.domElement.removeEventListener('pointerdown', stopFlight, true); gl.domElement.removeEventListener('wheel', stopFlight, true); window.removeEventListener('keydown', escape, true); };
  }, [gl]);
  useFrame((_, delta) => {
    const active = flight.current;
    if (!active) return;
    active.elapsed += delta;
    const pose = active.sample(active.elapsed / active.duration);
    camera.position.copy(pose.position); active.orbit.target.copy(pose.target); camera.lookAt(pose.target); active.orbit.update();
    if (active.elapsed >= active.duration) stopFlight();
  }, -0.5);
  useFrame(() => {
    if (view !== 'shore' && !view.endsWith('underwater')) return;
    const ocean=project.entities.find((entity)=>entity.kind==='ocean' && entity.visible);
    if (view==='shore'&&ocean?.kind !== 'ocean') return;
    const floor=view==='shore'&&ocean?.kind==='ocean'?Math.max(ocean.level+ocean.amplitude*1.7+0.35,groundHeight(camera.position.x,camera.position.z,project.site)+0.4):groundHeight(camera.position.x,camera.position.z,project.site)+0.2;
    if(camera.position.y<floor){ camera.position.y=floor;const orbit=controls as unknown as {target:THREE.Vector3}|null;if(orbit)camera.lookAt(orbit.target); }
  }, -0.4);
  useEffect(() => {
    const orbit = controls as unknown as Orbit | null;
    if (!orbit||orbit.object!==camera) return;
    if(projectionSwap.current){
      if(projectionSwap.current.camera!==camera)return;
      const reframe=projectionSwap.current.reframe;
      stopFlight();orbit.target.copy(projectionSwap.current.target);camera.lookAt(orbit.target);orbit.update();
      projectionSwap.current=null;navigationView.current=null;
      if(!reframe&&(view==='perspective'||view==='axonometric')){previousView.current=view;return;}
    }
    previousView.current=view;
    const navigated = navigationView.current;
    navigationView.current = null;
    if (navigated?.view === view && navigated.frameToken === frameToken) return;
    let target = new THREE.Vector3(-4, 1, 0);
    const aspectFit = Math.max(1, 1.25 / (size.width / size.height));
    let distance = 78 * Math.max(project.site.width / 90, project.site.depth / 72) * aspectFit;
    if (frameToken > 0) {
      const selected = project.entities.find((e) => e.id === selectedId);
      if(selected&&(selected.kind==='unit'||selected.kind==='building')){
        const bounds=scopeBounds(project,selected.id);
        if(bounds){target=new THREE.Vector3(...bounds.min as [number,number,number]).add(new THREE.Vector3(...bounds.max as [number,number,number])).multiplyScalar(0.5);distance=Math.max(18,new THREE.Vector3(...bounds.max as [number,number,number]).sub(new THREE.Vector3(...bounds.min as [number,number,number])).length()*1.5)*aspectFit;}
      } else if (selected?.kind === 'block') {
        target = new THREE.Vector3(...selected.position).add(new THREE.Vector3(0, selected.size[1] / 2, 0));
        distance = Math.max(...selected.size) * 2.8 * aspectFit;
      } else if (selected?.kind === 'instance' && selected.walkingRoute) {
        const bounds=new THREE.Box3().setFromPoints(selected.walkingRoute.points.map(([x,z])=>new THREE.Vector3(x,groundHeight(x,z,project.site),z)));
        target=bounds.getCenter(new THREE.Vector3());distance=Math.max(18,bounds.getSize(new THREE.Vector3()).length()*1.5+selected.walkingRoute.width)*aspectFit;
      } else if ((selected?.kind === 'instance' && tool !== 'path') || selected?.kind === 'level') {
        target = new THREE.Vector3(...(selected.kind === 'instance' ? instancePosition(selected, project) : selected.position));
        distance = (selected.kind === 'instance' ? 18 * Math.max(...selected.scale) : 30) * aspectFit;
        if (selected.kind === 'instance' && project.assets.some(asset => asset.id === selected.assetId && (isBirdAsset(asset) || isFishAsset(asset) || isGroundCharacterAsset(asset)))) {
          scene.traverse(object => {
            if (object.userData.copyEntityId === selected.id && (object.parent?.userData.birdFlight || object.parent?.userData.fishSwim || object.parent?.userData.groundCharacter)) target = object.getWorldPosition(new THREE.Vector3());
          });
          distance = 5 * Math.max(...selected.scale) * aspectFit;
          const schools=fishSchools(project), member=schools.get(selected.id);
          if (member && member.school.count > 1) {
            const bounds=new THREE.Box3();
            scene.traverse(object => {
              if (object.parent?.userData.fishSwim && schools.get(object.userData.copyEntityId)?.school === member.school)
                bounds.expandByPoint(object.getWorldPosition(new THREE.Vector3()));
            });
            if (!bounds.isEmpty()) {
              target=bounds.getCenter(new THREE.Vector3());
              distance=Math.max(distance,bounds.getSize(new THREE.Vector3()).length()*1.8*aspectFit);
            }
          }
        }
      } else if ((selected?.kind === 'path'||selected?.kind === 'lake'||selected?.kind === 'materialRegion'||selected?.kind === 'plantingRegion')) {
        const bounds = new THREE.Box3().setFromPoints(selected.points.map(([x,z]) => new THREE.Vector3(x,groundHeight(x,z,project.site),z)));
        target = bounds.getCenter(new THREE.Vector3()); distance = Math.max(16, bounds.getSize(new THREE.Vector3()).length()*1.4)*aspectFit;
      } else if (selected?.kind === 'river') {
        const bounds = new THREE.Box3().setFromPoints(selected.points.map((point) => new THREE.Vector3(...point)));
        target = bounds.getCenter(new THREE.Vector3()); distance = Math.max(20, bounds.getSize(new THREE.Vector3()).length() * 1.3) * aspectFit;
      } else if (selected?.kind === 'wall'&&selected.curve||selected?.kind==='roof'&&selected.cone||selected?.kind==='slab'&&selected.stairs) {
        const level=project.entities.find(e=>e.id===selected.parentId);
        if(level?.kind==='level'){
          const bounds=partBounds(selected,level),min=new THREE.Vector3(...bounds.min as [number,number,number]),max=new THREE.Vector3(...bounds.max as [number,number,number]);
          target=min.clone().add(max).multiplyScalar(0.5);distance=Math.max(10,max.sub(min).length()*1.5)*aspectFit;
        }
      } else if (selected?.kind === 'wall') {
        const level = project.entities.find(e => e.id === selected.parentId);
        if (level?.kind === 'level') {
          target = new THREE.Vector3((selected.start[0]+selected.end[0])/2, selected.elevation+selected.height/2, (selected.start[1]+selected.end[1])/2).applyAxisAngle(new THREE.Vector3(0,1,0), level.rotation*Math.PI/180).add(new THREE.Vector3(...level.position));
          distance = Math.max(8, Math.hypot(selected.end[0]-selected.start[0], selected.end[1]-selected.start[1])*1.3, selected.height*2)*aspectFit*(view==='top'?1.3:1);
        }
      } else if(selected?.kind==='slab'||selected?.kind==='roof'){
        const level=project.entities.find(e=>e.id===selected.parentId);
        if(level?.kind==='level'){const points=footprint(selected),minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));target=new THREE.Vector3((minX+maxX)/2,selected.elevation+(selected.kind==='slab'?selected.thickness:selected.rise),(minZ+maxZ)/2).applyAxisAngle(new THREE.Vector3(0,1,0),level.rotation*Math.PI/180).add(new THREE.Vector3(...level.position));distance=Math.max(10,Math.hypot(maxX-minX,maxZ-minZ)*1.5)*aspectFit;}
      }
    }
    const openingFocus=openingEditing?.focus??openingSelection?.focus;
    if(openingFocus){
      const wall=project.entities.find(e=>e.id===openingFocus.wallId);
      const opening=wall?.kind==='wall'?wall.openings?.find(o=>o.id===openingFocus.openingId):null;
      const level=wall&&project.entities.find(e=>e.kind==='level'&&e.id===wall.parentId);
      if(wall?.kind==='wall'&&opening&&level?.kind==='level'){
        const center=openingCenter(wall,opening);
        target=new THREE.Vector3(center[0],wall.elevation+opening.sill+opening.height/2,center[1]);
        target.applyAxisAngle(new THREE.Vector3(0,1,0),level.rotation*Math.PI/180).add(new THREE.Vector3(...level.position));
        distance=Math.max(5,Math.max(opening.width,opening.height)*2.5)*aspectFit;
      }
    }
    const ocean = project.entities.find((entity) => entity.kind === 'ocean' && entity.visible);
    const destination = new THREE.Vector3();
    if(view==='river-underwater'||view==='lake-underwater'){
      const water=project.entities.find(e=>e.kind===(view==='river-underwater'?'river':'lake')&&e.visible);
      const pose=water&&(water.kind==='river'||water.kind==='lake')?inlandWaterCamera(project.site,water):null;
      if(pose){target.set(...pose.target);destination.set(...pose.position);}
      else destination.copy(target).add(new THREE.Vector3(distance*.73,distance*.67,distance*.95));
    } else if (view === 'underwater' && ocean?.kind === 'ocean') {
      const pose=underwaterCamera(project.site,ocean,project.entities.filter(e=>e.kind==='lake'))??shoreCamera(project.site,ocean);target.set(...pose.target);destination.set(...pose.position);
    } else if (view === 'shore' && ocean?.kind === 'ocean') {
      const pose=shoreCamera(project.site,ocean); target.set(...pose.target); destination.set(...pose.position);
    } else destination.copy(orientationPosition(view === 'shore' || view.endsWith('underwater') ? 'perspective' : view as OrientationView, target, view === 'perspective' ? distance * Math.hypot(0.73, 0.67, 0.95) : distance));
    stopFlight();
    if(camera instanceof THREE.OrthographicCamera)fitOrthographicCamera(camera,2*destination.distanceTo(target)*Math.tan(42*Math.PI/360),size.width/size.height);
    if (initialized.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const damping = orbit.enableDamping;
      // Drain residual orbit motion before taking the departure pose.
      orbit.enableDamping = false; orbit.update();
      flight.current = { sample: cameraFlight(camera.position,orbit.target,destination,target), elapsed: 0, duration: 1.1, orbit, damping };
    } else { camera.position.copy(destination); orbit.target.copy(target); camera.lookAt(target); orbit.update(); }
    initialized.current = true;
    // Frame only on an explicit camera action; property changes preserve the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, controls, view, frameToken, project.site.width, project.site.depth]);
  const drawing = tool === 'wall' || tool === 'floor' || tool === 'roof' || tool==='stairs' || (tool === 'plant' && !!plantBrush),routeDrawing=tool==='path';
  return <OrbitControls enabled={routeDrawing || drawing || tool === 'plant' || tool === 'select' || tool === 'door' || tool === 'window' || tool === 'opening-edit' || tool === 'wall-edit' || tool === 'outline-edit'} makeDefault enableDamping dampingFactor={0.12} minDistance={view.endsWith('underwater')?0.25:6} maxDistance={800} minZoom={.05} maxZoom={200} maxPolarAngle={Math.PI} enableRotate={!routeDrawing && view !== 'top'} onStart={() => {
    if (['front', 'back', 'left', 'right', 'bottom'].includes(view)) { const next=projection==='orthographic'?'axonometric':'perspective';navigationView.current = { view: next, frameToken }; onNavigationView(next); }
  }} touches={{ ONE: drawing ? undefined : routeDrawing ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} mouseButtons={{ LEFT: drawing ? undefined : routeDrawing || view === 'top' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} />;
}

function Metrics({ onMetrics }: { onMetrics: Props['onMetrics'] }) {
  const { gl } = useThree();
  const sample = useRef({ elapsed: 0, frames: 0 });
  const renderer = useMemo(() => {
    const context = gl.getContext();
    const extension = context.getExtension('WEBGL_debug_renderer_info');
    return extension ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : 'WebGL 2';
  }, [gl]);
  useEffect(() => { const previous = gl.info.autoReset; gl.info.autoReset = false; return () => { gl.info.autoReset = previous; }; }, [gl]);
  useFrame((_, delta) => {
    sample.current.elapsed += delta; sample.current.frames++;
    if (sample.current.elapsed >= 1.5) {
      onMetrics({ fps: Math.round(sample.current.frames / sample.current.elapsed), calls: gl.info.render.calls, triangles: gl.info.render.triangles, renderer,
        resources:{geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,programs:gl.info.programs?.length??0},
        buffer:{width:gl.domElement.width,height:gl.domElement.height,dpr:gl.getPixelRatio()}});
      sample.current = { elapsed: 0, frames: 0 };
    }
    gl.info.reset();
  }, -3);
  return null;
}

export function Viewport(authored: Props) {
  const navigation = useRef<NavigationBridge>({});
  const project = useMemo(() => layerDisplayProject(evaluateProject(authored.project), authored.isolatedLayerId), [authored.project, authored.isolatedLayerId]);
  const movementSource=[ROUND_ROUTE_GESTURE,ROUND_PATH_GESTURE].includes(authored.editor.getSnapshot().gestureLabel??'') ? authored.editor.getSnapshot().project : authored.project;
  const movementProject=useMemo(()=>layerDisplayProject(evaluateProject(movementSource),authored.isolatedLayerId),[movementSource,authored.isolatedLayerId]);
  const editable = (id:string) => canEditObject(authored.project,id,authored.isolatedLayerId);
  const props = { ...authored, project, onSelect:(id:string|null,additive=false)=>{if(!id||editable(id))authored.onSelect(id,additive);},
    onWallPick:(id:string,doubleClick:boolean)=>{if(editable(id))authored.onWallPick?.(id,doubleClick);},
    onOutlinePick:(id:string,doubleClick:boolean)=>{if(editable(id))authored.onOutlinePick?.(id,doubleClick);},
  };
  const transientCoast = props.tool === 'terrain' && !!props.editor.getSnapshot().gestureLabel;
  const coastSite = transientCoast ? evaluateProject(props.editor.getSnapshot().project).site : project.site;
  const [hovering, setHovering] = useState(false);
  const selected = props.project.entities.find((entity) => entity.id === props.selectedId);
  const selectedRoute = useMemo(()=>selected?.kind==='instance' ? characterWalkingPath(selected) : undefined,[selected]);
  const draftCurve=useMemo(()=>roundedRoutePoints({points:props.pathDraft,width:props.pathDraftWidth??3,cornerRounding:props.pathDraftRounding}),[props.pathDraft,props.pathDraftWidth,props.pathDraftRounding]);
  const pick = (id: string,additive=false) => { if(!editable(id))return; if (props.tool === 'select'||(props.tool==='wall-edit'||props.tool==='outline-edit')||props.tool==='opening-edit') props.onSelect(additive?id:unitForPart(project,id)?.id??id,additive); };
  const committedIds = new Set(props.editor.getSnapshot().project.entities.map(entity => entity.id));
  const copyPreviewIds = new Set(props.editor.getSnapshot().gestureLabel === 'Alt-drag copy' ? project.entities.filter(entity => !committedIds.has(entity.id)).map(entity => entity.id) : []);
  const selectedParts=props.selectedIds?.length?props.selectedIds:selected?.kind==='unit'?selected.memberIds:[];
  const hiddenBuildings=project.entities.filter(e=>e.kind==='building'&&!e.visible).map(e=>e.id);
  const hiddenMembers=new Set(project.entities.flatMap(e=>e.kind==='unit'&&!e.visible?e.memberIds:[]));
  return <CanvasBoundary>
    <div className="canvas-shell" style={{ cursor: props.tool !== 'select' ? 'crosshair' : hovering ? 'pointer' : 'grab' }}>
      <Canvas shadows="percentage" dpr={props.quality === 'high' ? [1, 1.5] : 1} camera={{ position: [53, 53, 74], fov: 42, near: 0.1, far: 1500 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onPointerMissed={(event) => { if (props.tool === 'select' && event.type === 'click') props.onSelect(null); }}
        onCreated={({ gl }) => { gl.setClearColor('#e5e6db'); }}>
        <color attach="background" args={['#e5e6db']} />
        <ambientLight intensity={0.35} />
        <hemisphereLight args={['#e6f0ed', '#a4a78c', 0.65]} />
        <directionalLight position={[-project.site.width * 0.4, project.site.width * 0.70, project.site.width * 0.45]} intensity={2.6} castShadow shadow-mapSize={props.quality === 'high' ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-project.site.width * 0.7} shadow-camera-right={project.site.width * 0.7} shadow-camera-top={project.site.depth * 0.75} shadow-camera-bottom={-project.site.depth * 0.75} shadow-camera-far={Math.max(project.site.width, project.site.depth) * 3} shadow-bias={-0.0003} />
        <Suspense fallback={null}>
          <WaterOptics enabled={project.entities.some((entity) => (entity.kind === 'ocean'||entity.kind==='river'||entity.kind==='lake') && entity.visible)} immersive={props.view === 'shore'} quality={props.quality}>
          <CoastSystem site={coastSite} ocean={project.entities.find((entity) => entity.kind === 'ocean')} playing={props.playing} preview={props.waterPreview} transient={transientCoast}>
          <RiverSystem site={coastSite} river={project.entities.find(entity=>entity.kind==='river')} playing={props.playing} preview={{reset:props.waterPreview.riverReset,step:props.waterPreview.riverStep}} transient={transientCoast}>
          <LakeSystem site={coastSite} lake={project.entities.find(e=>e.kind==='lake')} playing={props.playing} preview={{reset:props.waterPreview.lakeReset,step:props.waterPreview.lakeStep}} transient={transientCoast}>
          {objectLayerState(authored.project,'terrain',authored.isolatedLayerId).visible&&<Terrain {...props} tool={props.tool==='terrain'&&!editable('terrain')?'select':props.tool}/>}
          {project.entities.filter(isRegion).map((region,order)=>region.visible&&<group key={region.id} userData={{copyEntityId:region.id}}><RegionLayer region={region} project={project} order={order} selected={region.id===props.selectedId} enabled={props.tool==='select'&&editable(region.id)} snapping={props.snapping} editor={props.editor} onSelect={props.onSelect} onError={props.onError}/></group>)}
          {props.tool==='region'&&<RegionDraft points={props.regionDraft} site={project.site}/>}
          {project.entities.map((entity) => entity.kind === 'ocean' && <OceanSurface key={entity.id} ocean={entity} site={project.site} selected={entity.id === props.selectedId} quality={props.quality} cutaway={props.view!=='shore'} />)}
          {props.view === 'shore' && project.entities.map((entity) => entity.kind === 'ocean' && <OceanSurface key={`${entity.id}-horizon`} ocean={entity} site={project.site} selected={false} quality={props.quality} horizon />)}
          {props.project.entities.filter((entity) => entity.kind === 'river' && entity.visible).map((river) => river.kind === 'river' && <group key={river.id} userData={{copyEntityId:river.id}}><RiverLayer river={river} project={props.project} editor={props.editor} selected={river.id === props.selectedId&&!props.view.endsWith('underwater')} playing={props.playing} quality={props.quality} enabled={props.tool === 'select'&&editable(river.id)} snapping={props.snapping} onSelect={props.onSelect} onError={props.onError} /></group>)}
          {props.tool === 'river' && <RiverDraft points={props.riverDraft} />}
          {project.entities.map(entity => entity.kind === 'path' && entity.visible && <group key={entity.id} userData={{copyEntityId:entity.id}}><PathLayer path={entity} project={project} selected={entity.id === props.selectedId} enabled={props.tool === 'select'&&editable(entity.id)} snapping={props.snapping} editor={props.editor} onSelect={props.onSelect} onError={props.onError} selectedAnchor={props.selectedRouteAnchor} onAnchorSelect={props.onRouteAnchor} cornerControls={entity.id===props.selectedId?props.routeCornerControls:undefined}/></group>)}
          {selected?.kind==='instance' && selected.visible && selectedRoute && props.tool==='select' && <PathLayer key={selected.id} owner={selected} path={selectedRoute} project={project} selected enabled={editable(selected.id)} snapping={props.snapping} editor={props.editor} onSelect={props.onSelect} onError={props.onError} selectedAnchor={props.selectedRouteAnchor} onAnchorSelect={props.onRouteAnchor} cornerControls={props.routeCornerControls}/>}
          {props.tool === 'path' && <PathDraft points={props.pathDraft} curvePoints={draftCurve} width={props.pathDraftWidth} site={project.site} selectedAnchor={props.draftRouteAnchor} onAnchorSelect={props.onDraftRouteAnchor} cornerControls={props.draftCornerControls}/>}
          {project.entities.map(entity=>entity.kind==='lake'&&entity.visible&&<group key={entity.id} userData={{copyEntityId:entity.id}}><LakeLayer lake={entity} project={project} editor={props.editor} selected={entity.id===props.selectedId&&!props.view.endsWith('underwater')} enabled={props.tool==='select'&&editable(entity.id)} snapping={props.snapping} quality={props.quality} onSelect={props.onSelect} onError={props.onError}/></group>)}
          {props.tool==='lake'&&<LakeDraft points={props.lakeDraft} level={props.lakeDraftLevel}/>}
          <group onPointerOver={() => setHovering(true)} onPointerOut={() => setHovering(false)}>
            {props.project.entities.filter((entity): entity is Block => entity.kind === 'block' && entity.visible).map((entity) => <Massing key={entity.id} blockOpeningEdit={(!!props.openingEditing||!!props.wallEditing||!!props.outlineEditing)&&!props.editor.getSnapshot().gestureLabel} entity={entity} selected={selectedParts.includes(entity.id)||entity.id === props.selectedId} onSelect={(id) => { if (props.tool === 'select') props.onSelect(id); }} />)}
            {props.repeatDrawing&&<RepeatDrawing project={props.project} draft={props.repeatDrawing} onPoint={props.onGroundPoint} onError={props.onError}/>}
            {props.towerDrawing&&<TowerDrawing project={props.project} draft={props.towerDrawing} onPoint={props.onGroundPoint}/>}
            {props.architectureDrawing&&(props.architectureDrawing.kind==='stairs'
              ? <StairsDrawing shape={props.architectureDrawing.stairShape} tower={props.architectureDrawing.stairTower} level={props.architectureDrawing.level} points={props.wallDraft} dimensions={props.architectureDrawing.stairDimensions} offset={props.architectureDrawing.offset} snapping={props.snapping} onPoint={props.onGroundPoint}/>
              : props.architectureDrawing.kind==='roof'&&props.architectureDrawing.roofShape==='conical'
              ? <ConicalRoofDrawing key={props.architectureDrawing.level.id} {...props.architectureDrawing} height={props.architectureDrawing.roofHeight} overhang={props.architectureDrawing.roofOverhang} points={props.wallDraft} onPoint={props.onGroundPoint} snapping={props.snapping}/>
              : props.architectureDrawing.kind==='wall'&&props.architectureDrawing.wallShape!=='straight'
              ? <CurvedWallDrawing project={props.project} key={`${props.architectureDrawing.level.id}-${props.architectureDrawing.wallShape}`} {...props.architectureDrawing} shape={props.architectureDrawing.wallShape} points={props.wallDraft} onPoint={props.onGroundPoint} snapping={props.snapping}/>
              : <ArchitectureDrawing project={props.project} key={props.architectureDrawing.level.id} {...props.architectureDrawing} kind={props.architectureDrawing.kind as 'wall'|'floor'|'roof'} points={props.wallDraft} onPoint={props.onGroundPoint} snapping={props.snapping} walls={props.project.entities.filter((e): e is import('@openlandcraft/core').Wall=>e.kind==='wall'&&e.parentId===props.architectureDrawing?.level.id&&e.joins===true)}/>)}
            {props.project.entities.filter((entity) => entity.kind === 'level' && entity.visible && !hiddenBuildings.includes(entity.buildingId??'') && (!props.isolateLevelId||entity.id===props.isolateLevelId||copyPreviewIds.has(entity.id))).map((level) => level.kind === 'level' && <BuildingLevel key={level.id} project={props.project} level={level} parts={props.project.entities.filter((entity): entity is BuildingPart => entity.parentId === level.id && entity.visible && !hiddenMembers.has(entity.id) && (copyPreviewIds.has(entity.id)||(!(((props.architectureDrawing&&props.architectureDrawing.kind!=='roof')||props.openingPlacement||props.openingEditing||props.wallEditing)&&entity.kind==='roof') && !(props.outlineEditing && ((props.outlineEditing.part.kind==='slab'&&!props.outlineEditing.part.stairs&&(entity.kind==='wall'||entity.kind==='roof'))||(entity.kind==='roof'&&entity.id!==props.outlineEditing.part.id))))) && (entity.kind === 'wall' || entity.kind === 'slab' || entity.kind === 'roof'))} selectedId={props.openingSelection?.focus?null:props.selectedId} selectedIds={selectedParts} onSelect={pick} onWallPick={props.onWallPick} onOutlinePick={props.onOutlinePick} editingPartId={props.wallEditing?.wall.id??props.outlineEditing?.part.id} interactive={!props.stairAttachment&&(props.tool==='select'||(props.tool==='wall-edit'||props.tool==='outline-edit')||props.tool==='opening-edit')} placingOpening={!!props.openingPlacement} editingOpening={!props.stairAttachment&&(!!props.openingEditing||!!props.wallEditing||!!props.outlineEditing)&&!props.editor.getSnapshot().gestureLabel} />)}
            <GroundCharacterProvider project={movementProject} playing={props.playing ?? true}><FishSchoolProvider project={props.project} playing={props.playing ?? true}>
            {props.project.assets.filter((asset) => props.project.entities.some((entity) => entity.kind === 'instance' && entity.assetId === asset.id && entity.visible)).map((asset) => <ModelInstances key={asset.id} windEnabled={props.plantWind} playing={props.playing} asset={asset} growth={props.plantGrowth} project={props.project} instances={props.project.entities.filter((entity): entity is Instance => entity.kind === 'instance' && entity.assetId === asset.id && entity.visible)} selectedId={props.selectedId} selectedIds={selectedParts} onSelect={pick} onError={props.onError} interactive={props.tool === 'select'||!!props.openingPlacement||(!!props.openingEditing||!!props.wallEditing||!!props.outlineEditing)&&!props.editor.getSnapshot().gestureLabel} />)}
            </FishSchoolProvider></GroundCharacterProvider>
          </group>
          {(props.tool==='select'||(props.tool==='wall-edit'||props.tool==='outline-edit'))&&props.openingSelection&&project.entities.filter(e=>e.kind==='level'&&e.visible&&!hiddenBuildings.includes(e.buildingId??'')&&(!props.isolateLevelId||e.id===props.isolateLevelId)).map(level=>level.kind==='level'&&<OpeningSelection key={level.id} level={level} {...props.openingSelection!} topView={props.view==='top'} walls={project.entities.filter((e):e is Extract<typeof e,{kind:'wall'}>=>e.kind==='wall'&&editable(e.id)&&e.parentId===level.id&&e.visible&&!hiddenMembers.has(e.id))}/>)}
          {props.stairAttachment&&<StairAttachmentTargets project={props.project} attachment={props.stairAttachment} isolatedLayerId={props.isolatedLayerId}/>}
          {props.outlineEditing&&<OutlineEdit key={props.outlineEditing.part.id} {...props.outlineEditing} editor={props.editor} snapping={props.snapping} topView={props.view==='top'}/>}
          {props.wallEditing&&<WallEdit key={props.wallEditing.wall.id} {...props.wallEditing} topView={props.view==='top'} editor={props.editor} snapping={props.snapping} walls={project.entities.filter((e):e is Extract<typeof e,{kind:'wall'}>=>e.kind==='wall'&&e.parentId===props.wallEditing!.level.id)}/>}
          {props.openingEditing&&<OpeningEdit key={props.openingEditing.level.id} {...props.openingEditing} editor={props.editor} snapping={props.snapping} topView={props.view==='top'} walls={project.entities.filter((e):e is Extract<typeof e,{kind:'wall'}>=>e.kind==='wall'&&e.parentId===props.openingEditing!.level.id&&e.visible&&!hiddenMembers.has(e.id))}/>}
          {props.openingPlacement&&<OpeningPlacement project={props.project} key={props.openingPlacement.level.id+'-'+props.tool} {...props.openingPlacement} walls={project.entities.filter((e):e is Extract<typeof e,{kind:'wall'}>=>e.kind==='wall'&&editable(e.id)&&e.parentId===props.openingPlacement!.level.id&&e.visible&&!hiddenMembers.has(e.id))}/> }
          {props.tool==='select'&&props.floorCopy&&<FloorCopyGhost copy={props.floorCopy}/>}
          {props.tool==='select'&&selected&&(selected.kind==='unit'||selected.kind==='level')&&props.copyAnchor&&<FloorCopyAnchor project={props.project} id={selected.id} element={props.copyAnchor}/>}
          {props.grid && <gridHelper args={[Math.max(project.site.width, project.site.depth) * 1.33, Math.ceil(Math.max(project.site.width, project.site.depth) / 4), '#b1b9aa', '#cdd1c2']} position={[0, -12.1, 0]} userData={{waterCaptureExclude:true}} />}
          <CameraRig {...props} navigation={navigation} />
          <DragCopy editor={props.editor} enabled={!props.copying&&['select','wall-edit','outline-edit','opening-edit'].includes(props.tool)} selectedId={props.selectedId} selectedIds={props.selectedIds??[]} snapping={props.snapping} onPlaced={props.onCopyPlaced} onStatus={props.onCopyStatus}/>
          {props.tool === 'select' && !props.copying && selected?.visible && (selected.kind === 'block' || selected.kind === 'instance' || selected.kind === 'level') && <group userData={{waterCaptureExclude:true,copyEntityId:selected.id}}><TransformGizmo onError={props.onError} key={selected.id} entity={selected} project={props.project} editor={props.editor} mode={props.transformMode} snapping={props.snapping} /></group>}
          <Metrics onMetrics={props.onMetrics} />
          </LakeSystem>
          </RiverSystem>
          </CoastSystem>
          </WaterOptics>
        </Suspense>
      </Canvas>
      <ViewNavigator bridge={navigation} />
    </div>
  </CanvasBoundary>;
}
