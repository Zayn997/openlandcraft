import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { evaluateProject, groundHeight, instancePosition, type Block, type Project, type Editor, type BuildingPart, type Instance } from '@openlandcraft/core';
import { TerrainStroke, type BrushSettings, type RiverPoint } from '@openlandcraft/landscape';
import { RiverDraft, RiverLayer } from './river';
import { intersectTerrain } from './terrain-picking';
import { updateTerrainNormals } from './terrain-normals';
import { BuildingLevel, ModelInstances, TransformGizmo, type TransformMode } from './objects';
export { validateModels } from './models';
export type { TransformMode } from './objects';

export type ViewportMetrics = { fps: number; calls: number; triangles: number; renderer: string };
type Props = {
  project: Project; selectedId: string | null; onSelect: (id: string | null) => void;
  grid: boolean; playing: boolean; quality: 'low' | 'high';
  view: 'perspective' | 'top'; frameToken: number;
  onMetrics: (metrics: ViewportMetrics) => void;
  editor: Editor; tool: 'select' | 'terrain' | 'building' | 'river'; brush: BrushSettings;
  onStrokeTime: (milliseconds: number) => void;
  onGroundPoint: (x: number, z: number) => void; onError: (message: string) => void;
  transformMode: TransformMode; snapping: boolean;
  riverDraft: RiverPoint[];
};

class CanvasBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? <div className="canvas-error"><strong>The 3D view could not start.</strong><p>Try a browser with WebGL 2 enabled. Your scene and inspector remain available.</p></div> : this.props.children;
  }
}

function Terrain({ project, editor, tool, brush, onStrokeTime, onGroundPoint, onSelect }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const previous = useRef<{ geometry: THREE.BufferGeometry; heights: number[] } | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const stroke = useRef<{ stroke: TerrainStroke; plane: THREE.Plane; release: () => void; pointerId: number } | null>(null);
  const scheduled = useRef<number | null>(null);
  const pendingInputTime = useRef<number | null>(null);
  const previewReady = useRef(false);
  const { gl } = useThree();
  const geometry = useMemo(() => {
    const { width, depth } = project.site;
    const geometry = new THREE.PlaneGeometry(width, depth, project.site.terrain.columns - 1, project.site.terrain.rows - 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
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
      if (baseline && baseline[i] === project.site.terrain.heights[i]) continue;
      changed.push(i);
      const x = positions.getX(i), z = positions.getZ(i);
      const y = project.site.terrain.heights[i];
      positions.setY(i, y);
      const land = THREE.MathUtils.smoothstep(y, 0.7, 3.5);
      const noise = Math.sin(x * 1.4 + z * 0.6) * Math.sin(z * 1.7) * 0.025;
      if (y < -1) color.copy(seabed).lerp(sand, THREE.MathUtils.smoothstep(y, -4, -1)); else color.copy(sand).lerp(grass, land);
      color.offsetHSL(0, 0, noise); colors.setXYZ(i, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
    positions.needsUpdate = true;
    if (!baseline || changed.length > positions.count / 20) geometry.computeVertexNormals();
    else updateTerrainNormals(geometry, changed, project.site.terrain.columns, project.site.terrain.rows);
    previous.current = { geometry, heights: project.site.terrain.heights };
    previewReady.current = true;
  }, [geometry, project.site.terrain]);
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
    editor.preview({ type: 'terrain', field: stroke.current.stroke.snapshot() });
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
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
    if (!stroke.current || stroke.current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    move(event);
    if (scheduled.current !== null) cancelAnimationFrame(scheduled.current);
    publish();
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
    <mesh ref={mesh} geometry={geometry} receiveShadow raycast={(raycaster, hits) => { const hit = intersectTerrain(raycaster.ray, project.site); if (hit && hit.distance >= raycaster.near && hit.distance <= raycaster.far && mesh.current) hits.push({ ...hit, object: mesh.current }); }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onPointerOut={() => { if (!stroke.current) setCursor(null); }} onClick={(event) => { if (tool === 'terrain') event.stopPropagation(); if ((tool === 'building' || tool === 'river') && event.delta <= 4) { event.stopPropagation(); onGroundPoint(event.point.x, event.point.z); } else if (tool === 'select' && event.delta <= 4) { event.stopPropagation(); onSelect(null); } }}>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
    {ring && <lineLoop geometry={ring} raycast={() => undefined} renderOrder={10}><lineBasicMaterial color={brush.kind === 'lower' ? '#e7b0a1' : '#e4ffb2'} depthTest={false} /></lineLoop>}
    <mesh position={[0, -10.5, 0]} receiveShadow>
      <boxGeometry args={[project.site.width, 3, project.site.depth]} />
      <meshStandardMaterial color="#b2ab98" roughness={1} />
    </mesh>
  </group>;
}

const waterVertex = /* glsl */`
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uSpeed;
  uniform float uLevel;
  attribute float ground;
  varying vec3 vWorld;
  varying float vGround;
  varying float vWave;
  void main() {
    vec3 p = position;
    float phase = uTime * uSpeed;
    float depth = max(0.0, uLevel - ground);
    float shoreFade = smoothstep(0.0, 1.8, depth);
    float wave = sin(p.x * 0.58 + p.z * 0.22 - phase * 1.5) * 0.65
               + sin(p.x * 1.08 - p.z * 0.52 + phase * 1.1) * 0.35;
    p.y = uLevel + wave * uAmplitude * shoreFade;
    vWave = wave;
    vGround = ground;
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;
const waterFragment = /* glsl */`
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSelected;
  varying vec3 vWorld;
  varying float vGround;
  varying float vWave;
  void main() {
    float depth = vWorld.y - vGround;
    if (depth < 0.025) discard;
    float offshore = smoothstep(0.0, 6.0, depth);
    vec3 shallow = mix(vec3(0.54, 0.75, 0.67), uColor, 0.4);
    vec3 deep = uColor * 0.63;
    vec3 color = mix(shallow, deep, offshore);
    vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (!gl_FrontFacing) normal = -normal;
    vec3 eye = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(0.0, dot(normal, eye)), 3.0);
    color = mix(color, vec3(0.75, 0.84, 0.80), fresnel * 0.4);
    float ripple = sin(vWorld.x * 3.8 + vWorld.z * 2.3 - uTime * uSpeed * 2.0);
    float glint = pow(max(0.0, ripple), 16.0) * 0.055;
    color += glint + vWave * 0.016;
    color = mix(color, vec3(0.80, 0.89, 0.62), uSelected * 0.13);
    gl_FragColor = vec4(color, 0.95);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Water({ project, playing, quality, selectedId, onSelect }: Props) {
  const ocean = project.entities.find((entity) => entity.kind === 'ocean');
  const geometry = useMemo(() => {
    const segments = quality === 'high' ? 128 : 48;
    const geometry = new THREE.PlaneGeometry(project.site.width, project.site.depth, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    geometry.setAttribute('ground', new THREE.Float32BufferAttribute(new Float32Array(positions.count), 1));
    // Shader displacement must not be clipped by the undeformed plane's bounds.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 150);
    return geometry;
  }, [project.site.width, project.site.depth, quality]);
  useLayoutEffect(() => {
    const positions = geometry.attributes.position;
    const ground = geometry.attributes.ground;
    for (let i = 0; i < positions.count; i++) ground.setX(i, groundHeight(positions.getX(i), positions.getZ(i), project.site));
    ground.needsUpdate = true;
  }, [geometry, project.site.terrain]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAmplitude: { value: 0.16 }, uSpeed: { value: 0.8 },
    uLevel: { value: 0 }, uColor: { value: new THREE.Color('#3e8e90') }, uSelected: { value: 0 },
  }), []);
  useFrame((_, delta) => {
    if (playing) uniforms.uTime.value += Math.min(delta, 0.1);
    if (ocean?.kind === 'ocean') {
      uniforms.uAmplitude.value = ocean.amplitude;
      uniforms.uSpeed.value = ocean.speed;
      uniforms.uLevel.value = ocean.level;
      uniforms.uColor.value.set(ocean.color);
      uniforms.uSelected.value = ocean.id === selectedId ? 1 : 0;
    }
  });
  if (!ocean?.visible) return null;
  // Picking uses a separate flat surface; shader fragments can be discarded on land.
  return <mesh geometry={geometry} raycast={() => undefined}>
    <shaderMaterial vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={uniforms} side={THREE.DoubleSide} />
  </mesh>;
}

function Massing({ entity, selected, onSelect }: { entity: Block; selected: boolean; onSelect: (id: string) => void }) {
  return <group position={entity.position} rotation={[0, entity.rotation * Math.PI / 180, 0]}>
    <mesh position={[0, entity.size[1] / 2, 0]} castShadow receiveShadow onClick={(event) => {
      if (event.delta > 4) return;
      event.stopPropagation(); onSelect(entity.id);
    }}>
      <boxGeometry args={entity.size} />
      <meshStandardMaterial color={entity.color} roughness={0.75} />
      <Edges threshold={20} color={selected ? '#d7f29c' : '#7b8176'} lineWidth={selected ? 2 : 0.7} />
    </mesh>
    {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[entity.size[0] + 1.3, entity.size[2] + 1.3]} />
      <meshBasicMaterial color="#d0e89d" transparent opacity={0.24} depthWrite={false} />
    </mesh>}
  </group>;
}

function CameraRig({ project, selectedId, view, frameToken, tool }: Props) {
  const { camera, controls, size } = useThree();
  useEffect(() => {
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!orbit) return;
    let target = new THREE.Vector3(-4, 1, 0);
    const aspectFit = Math.max(1, 1.25 / (size.width / size.height));
    let distance = 78 * Math.max(project.site.width / 90, project.site.depth / 72) * aspectFit;
    if (frameToken > 0) {
      const selected = project.entities.find((e) => e.id === selectedId);
      if (selected?.kind === 'block') {
        target = new THREE.Vector3(...selected.position).add(new THREE.Vector3(0, selected.size[1] / 2, 0));
        distance = Math.max(...selected.size) * 2.8 * aspectFit;
      } else if (selected?.kind === 'instance' || selected?.kind === 'level') {
        target = new THREE.Vector3(...(selected.kind === 'instance' ? instancePosition(selected, project) : selected.position));
        distance = (selected.kind === 'instance' ? 18 * Math.max(...selected.scale) : 30) * aspectFit;
      } else if (selected?.kind === 'river') {
        const bounds = new THREE.Box3().setFromPoints(selected.points.map((point) => new THREE.Vector3(...point)));
        target = bounds.getCenter(new THREE.Vector3()); distance = Math.max(20, bounds.getSize(new THREE.Vector3()).length() * 1.3) * aspectFit;
      } else if (selected && selected.parentId !== 'site') {
        const level = project.entities.find((entity) => entity.id === selected.parentId);
        if (level?.kind === 'level') { target = new THREE.Vector3(...level.position); distance = 30 * aspectFit; }
      }
    }
    orbit.target.copy(target);
    camera.position.copy(target).add(view === 'top' ? new THREE.Vector3(0, distance, 0.01) : new THREE.Vector3(distance * 0.73, distance * 0.67, distance * 0.95));
    camera.lookAt(target); orbit.update();
    // Frame only on an explicit camera action; property changes preserve the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, controls, view, frameToken, size.width, size.height, project.site.width, project.site.depth]);
  return <OrbitControls enabled={tool === 'select'} makeDefault enableDamping dampingFactor={0.12} minDistance={6} maxDistance={800} maxPolarAngle={Math.PI * 0.48} enableRotate={view !== 'top'} mouseButtons={{ LEFT: view === 'top' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} />;
}

function Metrics({ onMetrics }: { onMetrics: Props['onMetrics'] }) {
  const { gl } = useThree();
  const sample = useRef({ elapsed: 0, frames: 0 });
  const renderer = useMemo(() => {
    const context = gl.getContext();
    const extension = context.getExtension('WEBGL_debug_renderer_info');
    return extension ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : 'WebGL 2';
  }, [gl]);
  useFrame((_, delta) => {
    sample.current.elapsed += delta; sample.current.frames++;
    if (sample.current.elapsed >= 1.5) {
      onMetrics({ fps: Math.round(sample.current.frames / sample.current.elapsed), calls: gl.info.render.calls, triangles: gl.info.render.triangles, renderer });
      sample.current = { elapsed: 0, frames: 0 };
    }
  });
  return null;
}

export function Viewport(authored: Props) {
  const project = useMemo(() => evaluateProject(authored.project), [authored.project]);
  const props = { ...authored, project };
  const [hovering, setHovering] = useState(false);
  const selected = props.project.entities.find((entity) => entity.id === props.selectedId);
  const pick = (id: string) => { if (props.tool === 'select') props.onSelect(id); };
  return <CanvasBoundary>
    <div className="canvas-shell" style={{ cursor: props.tool === 'terrain' ? 'crosshair' : hovering ? 'pointer' : 'grab' }}>
      <Canvas shadows="percentage" dpr={props.quality === 'high' ? [1, 1.5] : 1} camera={{ position: [53, 53, 74], fov: 42, near: 0.1, far: 1500 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onPointerMissed={(event) => { if (props.tool === 'select' && event.type === 'click') props.onSelect(null); }}
        onCreated={({ gl }) => { gl.setClearColor('#e5e6db'); }}>
        <color attach="background" args={['#e5e6db']} />
        <ambientLight intensity={1.5} />
        <hemisphereLight args={['#e6f0ed', '#a4a78c', 1.4]} />
        <directionalLight position={[-project.site.width * 0.28, Math.max(project.site.width, project.site.depth) * 0.65, project.site.depth * 0.35]} intensity={3} castShadow shadow-mapSize={props.quality === 'high' ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-project.site.width * 0.7} shadow-camera-right={project.site.width * 0.7} shadow-camera-top={project.site.depth * 0.75} shadow-camera-bottom={-project.site.depth * 0.75} shadow-camera-far={Math.max(project.site.width, project.site.depth) * 3} shadow-bias={-0.0003} />
        <Suspense fallback={null}>
          <Terrain {...props} />
          <Water {...props} />
          {props.project.entities.filter((entity) => entity.kind === 'river' && entity.visible).map((river) => river.kind === 'river' && <RiverLayer key={river.id} river={river} project={props.project} editor={props.editor} selected={river.id === props.selectedId} playing={props.playing} quality={props.quality} enabled={props.tool === 'select'} snapping={props.snapping} onSelect={props.onSelect} onError={props.onError} />)}
          {props.tool === 'river' && <RiverDraft points={props.riverDraft} />}
          <group onPointerOver={() => setHovering(true)} onPointerOut={() => setHovering(false)}>
            {props.project.entities.filter((entity): entity is Block => entity.kind === 'block' && entity.visible).map((entity) => <Massing key={entity.id} entity={entity} selected={entity.id === props.selectedId} onSelect={(id) => { if (props.tool === 'select') props.onSelect(id); }} />)}
            {props.project.entities.filter((entity) => entity.kind === 'level' && entity.visible).map((level) => level.kind === 'level' && <BuildingLevel key={level.id} level={level} parts={props.project.entities.filter((entity): entity is BuildingPart => entity.parentId === level.id && entity.visible && (entity.kind === 'wall' || entity.kind === 'slab' || entity.kind === 'roof'))} selectedId={props.selectedId} onSelect={pick} />)}
            {props.project.assets.filter((asset) => props.project.entities.some((entity) => entity.kind === 'instance' && entity.assetId === asset.id && entity.visible)).map((asset) => <ModelInstances key={asset.id} asset={asset} project={props.project} instances={props.project.entities.filter((entity): entity is Instance => entity.kind === 'instance' && entity.assetId === asset.id && entity.visible)} selectedId={props.selectedId} onSelect={pick} onError={props.onError} interactive={props.tool === 'select'} />)}
          </group>
          {props.grid && <gridHelper args={[Math.max(project.site.width, project.site.depth) * 1.33, Math.ceil(Math.max(project.site.width, project.site.depth) / 4), '#b1b9aa', '#cdd1c2']} position={[0, -12.1, 0]} />}
          <CameraRig {...props} />
          {props.tool === 'select' && selected?.visible && (selected.kind === 'block' || selected.kind === 'instance' || selected.kind === 'level') && <TransformGizmo key={selected.id} entity={selected} project={props.project} editor={props.editor} mode={props.transformMode} snapping={props.snapping} />}
          <Metrics onMetrics={props.onMetrics} />
        </Suspense>
      </Canvas>
    </div>
  </CanvasBoundary>;
}
