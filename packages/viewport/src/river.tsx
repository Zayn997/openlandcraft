import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { groundHeight, snap, type Editor, type Project, type River } from '@openlandcraft/core';
import { sampleRiver, type RiverPoint } from '@openlandcraft/landscape';

const vertexShader = `
  uniform float uTime; uniform float uSpeed;
  attribute float ground; varying vec2 vUv; varying float vDepth;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.y += sin(uv.y * 2.4 - uTime * uSpeed * 2.0) * 0.012 * sin(uv.x * 3.14159);
    vDepth = p.y - ground;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const fragmentShader = `
  uniform float uTime; uniform float uSpeed; uniform vec3 uColor;
  varying vec2 vUv; varying float vDepth;
  void main() {
    if (vDepth < 0.008) discard;
    float phase = vUv.y - uTime * uSpeed * 1.8;
    float ripples = pow(max(0.0, sin(phase * 4.0 + sin(vUv.x * 14.0) * 0.7)), 12.0);
    float edge = pow(abs(vUv.x * 2.0 - 1.0), 5.0);
    vec3 color = mix(uColor * 0.75, vec3(0.61, 0.78, 0.69), edge * 0.55 + exp(-vDepth * 2.0) * 0.3);
    color += ripples * 0.085;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function PointNumber({ number }: { number: number }) {
  const sprite = useRef<THREE.Sprite>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    if (!sprite.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    sprite.current.getWorldPosition(world);
    const scale = camera.position.distanceTo(world) * 2 * Math.tan(camera.getEffectiveFOV() * Math.PI / 360) / size.height * 19;
    sprite.current.scale.set(scale, scale, 1);
  });
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#edf8c8'; context.beginPath(); context.arc(32, 32, 28, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#91a96b'; context.lineWidth = 3; context.stroke();
      context.fillStyle = '#36502d'; context.font = 'bold 34px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(number), 32, 34);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }, [number]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite ref={sprite} scale={[1, 1, 1]} renderOrder={16}><spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} /></sprite>;
}

export function RiverLayer({ river, project, selected, editor, playing, quality, enabled, snapping, onSelect, onError }: {
  river: River; project: Project; selected: boolean; editor: Editor; playing: boolean; quality: 'low' | 'high'; enabled: boolean; snapping: boolean;
  onSelect: (id: string) => void; onError: (message: string) => void;
}) {
  const orbit = useThree((state) => state.controls) as unknown as { enabled: boolean } | null;
  const navigationAllowed = useRef(enabled); navigationAllowed.current = enabled;
  const geometry = useMemo(() => {
    const samples = sampleRiver(river.points), across = quality === 'high' ? 8 : 4;
    const positions: number[] = [], uv: number[] = [], ground: number[] = [], indices: number[] = [];
    samples.forEach((point, row) => {
      const previous = samples[Math.max(0, row - 1)], next = samples[Math.min(samples.length - 1, row + 1)];
      const dx = next.x - previous.x, dz = next.z - previous.z, length = Math.hypot(dx, dz) || 1;
      for (let column = 0; column <= across; column++) {
        const fraction = column / across, offset = (fraction - 0.5) * river.width;
        const x = point.x + dz / length * offset, z = point.z - dx / length * offset;
        positions.push(x, point.y + 0.015, z); uv.push(fraction, point.along); ground.push(groundHeight(x, z, project.site));
        if (row < samples.length - 1 && column < across) {
          const a = row * (across + 1) + column, b = a + across + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    });
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setAttribute('ground', new THREE.Float32BufferAttribute(ground, 1));
    geometry.setIndex(indices); geometry.computeBoundingSphere(); return geometry;
  }, [river.points, river.width, project.site.terrain, quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSpeed: { value: river.speed }, uColor: { value: new THREE.Color(river.color) } }), []);
  useFrame((_, delta) => { if (playing) uniforms.uTime.value += Math.min(delta, 0.1); uniforms.uSpeed.value = river.speed; uniforms.uColor.value.set(river.color); });
  const path = useMemo(() => { const points = sampleRiver(river.points).map((point) => new THREE.Vector3(point.x, point.y + 0.12, point.z)); return new THREE.BufferGeometry().setFromPoints(points.flatMap((point, index) => index ? [points[index - 1], point] : [])); }, [river.points]);
  useEffect(() => () => path.dispose(), [path]);
  const active = useRef<{ river: River; index: number; plane: THREE.Plane; pointerId: number; release: () => void; valid: boolean } | null>(null);
  const cancel = () => { const session = active.current; active.current = null; if (session) { session.release(); editor.cancel(); if (orbit) orbit.enabled = navigationAllowed.current; } };
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => { if (!editor.getSnapshot().gestureLabel && active.current) cancel(); });
    window.addEventListener('blur', cancel); window.addEventListener('pointercancel', cancel);
    return () => { unsubscribe(); window.removeEventListener('blur', cancel); window.removeEventListener('pointercancel', cancel); cancel(); };
  }, [editor, orbit]);
  useEffect(() => { if (!enabled) cancel(); }, [enabled]);
  const down = (event: ThreeEvent<PointerEvent>, index: number) => {
    if (!enabled || event.button !== 0 || editor.getSnapshot().gestureLabel) return;
    event.stopPropagation(); editor.begin(`Move river point ${index + 1}`);
    if (orbit) orbit.enabled = false;
    const target = event.target as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
    target.setPointerCapture(event.pointerId);
    active.current = { river, index, plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -river.points[index][1]), pointerId: event.pointerId, valid: true,
      release: () => { try { target.releasePointerCapture(event.pointerId); } catch { /* Browser already released capture. */ } } };
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    const session = active.current; if (!session || session.pointerId !== event.pointerId) return;
    event.stopPropagation(); const point = event.ray.intersectPlane(session.plane, new THREE.Vector3()); if (!point) return;
    const points = session.river.points.map((value) => [...value] as RiverPoint);
    points[session.index] = [snapping ? snap(point.x) : point.x, points[session.index][1], snapping ? snap(point.z) : point.z];
    try { editor.preview({ type: 'replace', entity: { ...session.river, points } }); session.valid = true; onError(''); }
    catch (error) { session.valid = false; onError(error instanceof Error ? error.message : 'The point cannot move there.'); }
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    const session = active.current; if (!session || session.pointerId !== event.pointerId) return;
    event.stopPropagation(); active.current = null; session.valid ? editor.commit() : editor.cancel(); session.release(); if (orbit) orbit.enabled = navigationAllowed.current;
  };
  return <group>
    <mesh geometry={geometry} onClick={(event) => { if (enabled && event.delta <= 4) { event.stopPropagation(); onSelect(river.id); } }}>
      <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} side={THREE.DoubleSide} />
    </mesh>
    {selected && enabled && <>
      <lineSegments geometry={path} raycast={() => undefined}><lineBasicMaterial color="#d7f29c" depthTest={false} /></lineSegments>
      {river.points.map((point, index) => <mesh key={index} position={[point[0], point[1] + 0.15, point[2]]} renderOrder={15}
        onPointerDown={(event) => down(event, index)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={(event) => event.stopPropagation()}>
        <sphereGeometry args={[0.4, 12, 8]} /><meshBasicMaterial color="#e1f5aa" depthTest={false} />
        <PointNumber number={index + 1} />
      </mesh>)}
    </>}
  </group>;
}

export function RiverDraft({ points }: { points: RiverPoint[] }) {
  const line = useMemo(() => { const vertices = (points.length > 1 ? sampleRiver(points).map((point) => [point.x, point.y, point.z]) : points).map((point) => new THREE.Vector3(point[0], point[1] + 0.2, point[2])); return new THREE.BufferGeometry().setFromPoints(vertices.flatMap((point, index) => index ? [vertices[index - 1], point] : [])); }, [points]);
  useEffect(() => () => line.dispose(), [line]);
  return <group><lineSegments geometry={line} raycast={() => undefined}><lineBasicMaterial color="#e7efaa" depthTest={false} /></lineSegments>{points.map((point, index) => <mesh key={index} position={point} raycast={() => undefined}><sphereGeometry args={[0.35, 10, 8]} /><meshBasicMaterial color="#e7efaa" depthTest={false} /></mesh>)}</group>;
}
