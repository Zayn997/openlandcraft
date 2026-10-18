import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { groundHeight, snapPathPoint, type Editor, type Path, type Project } from '@openlandcraft/core';
import { pathLength, pathStrips, clipPathPolygon, polygonArea, type PathPoint } from '@openlandcraft/landscape';
import { buildPathMesh, updatePathHeights, PATH_LIFT } from './path-geometry';
import { intersectTerrain } from './terrain-picking';
import { PointNumber } from './river';

function pathMaterial(surface: Path['surface']) {
  const material = new THREE.MeshStandardMaterial({ color: surface === 'gravel' ? '#bdad90' : surface === 'paving' ? '#a5a89f' : '#927453', roughness: surface === 'timber' ? 0.85 : 0.96 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vPathUV;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvPathUV=uv;');
    shader.fragmentShader = 'varying vec2 vPathUV;\nfloat pathHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 p=vPathUV;
      float grain=pathHash(floor(p*38.0));
      grain=mix(grain,0.5,smoothstep(0.01,0.07,max(length(dFdx(p)),length(dFdy(p)))));
      diffuseColor.rgb*=0.85+grain*0.3;
      ${surface === 'gravel' ? '' : surface === 'paving' ? `
        vec2 tile=vec2(p.x/0.5+mod(floor(p.y/0.7),2.0)*0.5,p.y/0.7);
        vec2 seam=min(fract(tile),1.0-fract(tile));
        vec2 aa=fwidth(tile);
        float joint=1.0-min(smoothstep(0.008,0.008+aa.x,seam.x),smoothstep(0.008,0.008+aa.y,seam.y));
        diffuseColor.rgb*=mix(0.92+0.16*pathHash(floor(tile)),0.63,joint);
      ` : `
        float board=p.y/0.18;
        float seam=min(fract(board),1.0-fract(board));
        float joint=1.0-smoothstep(0.012,0.012+fwidth(board),seam);
        float wood=sin(p.x*34.0+sin(p.x*3.0+floor(board))*2.0);
        wood*=1.0-smoothstep(0.015,0.1,fwidth(p.x));
        diffuseColor.rgb*=mix(0.88+0.18*pathHash(vec2(floor(board),1.0))+wood*0.04,0.55,joint);
      `}`);
  };
  material.customProgramCacheKey = () => `path-${surface}`;
  return material;
}

export function PathLayer({ path, project, selected, enabled, snapping, editor, onSelect, onError }: {
  path: Path; project: Project; selected: boolean; enabled: boolean; snapping: boolean; editor: Editor; onSelect: (id: string) => void; onError: (message: string) => void;
}) {
  const shape = JSON.stringify(path.points), site = project.site;
  const mesh = useMemo(() => buildPathMesh(path, site), [shape, path.width, site.width, site.depth, site.terrain.columns, site.terrain.rows]);
  useLayoutEffect(() => updatePathHeights(mesh, site), [mesh, site.terrain]);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  const material = useMemo(() => pathMaterial(path.surface), [path.surface]);
  useEffect(() => () => material.dispose(), [material]);
  const strips = useMemo(() => pathStrips(path), [shape, path.width]);
  const surface = useRef<THREE.Mesh>(null);
  const pick: THREE.Mesh['raycast'] = (raycaster, hits) => {
    if (!enabled || !surface.current) return;
    const ray = raycaster.ray.clone(); ray.origin.y -= PATH_LIFT;
    const hit = intersectTerrain(ray, site);
    if (!hit || hit.distance < raycaster.near || hit.distance > raycaster.far) return;
    const p: PathPoint = [hit.point.x, hit.point.z], e = 0.0001;
    if (strips.some(strip => polygonArea(clipPathPolygon([[p[0]-e,p[1]-e],[p[0]+e,p[1]-e],[p[0]+e,p[1]+e],[p[0]-e,p[1]+e]], strip)) > 0)) {
      hit.point.y += PATH_LIFT; hits.push({ ...hit, object: surface.current });
    }
  };
  const orbit = useThree(state => state.controls) as unknown as { enabled: boolean } | null;
  const allowed = useRef(enabled); allowed.current = enabled;
  const active = useRef<{ path: Path; index: number; pointerId: number; release: () => void; valid: boolean } | null>(null);
  const cancel = () => { const session = active.current; active.current = null; if (session) { session.release(); editor.cancel(); if (orbit) orbit.enabled = allowed.current; } };
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => { if (!editor.getSnapshot().gestureLabel && active.current) cancel(); });
    window.addEventListener('blur', cancel); window.addEventListener('pointercancel', cancel);
    return () => { unsubscribe(); window.removeEventListener('blur', cancel); window.removeEventListener('pointercancel', cancel); cancel(); };
  }, [editor, orbit]);
  useEffect(() => { if (!enabled || !selected) cancel(); }, [enabled, selected]);
  const down = (event: ThreeEvent<PointerEvent>, index: number) => {
    if (!enabled || event.button !== 0 || editor.getSnapshot().gestureLabel) return;
    event.stopPropagation(); editor.begin(`Move path point ${index + 1}`); if (orbit) orbit.enabled = false;
    const target = event.target as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
    target.setPointerCapture(event.pointerId);
    active.current = { path, index, pointerId: event.pointerId, valid: true, release: () => { try { target.releasePointerCapture(event.pointerId); } catch { /* Capture may already have ended. */ } } };
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    const session = active.current; if (!session || session.pointerId !== event.pointerId) return;
    event.stopPropagation(); const hit = intersectTerrain(event.ray, site);
    if (!hit) { session.valid = false; onError('Keep the path inside the site.'); return; }
    const points = session.path.points.map(p => [...p] as PathPoint);
    points[session.index] = snapPathPoint(project, [hit.point.x, hit.point.z], snapping, session.index === 0 || session.index === points.length - 1).point;
    try { editor.preview({ type: 'replace', entity: { ...session.path, points } }); session.valid = true; onError(''); }
    catch (error) { session.valid = false; onError(error instanceof Error ? error.message : 'This path point is invalid.'); }
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    const session = active.current; if (!session || session.pointerId !== event.pointerId) return;
    event.stopPropagation(); active.current = null; session.valid ? editor.commit() : editor.cancel(); session.release(); if (orbit) orbit.enabled = allowed.current;
  };
  return <group>
    <mesh ref={surface} geometry={mesh.geometry} material={material} receiveShadow raycast={pick} onClick={event => { if (enabled && event.delta <= 4) { event.stopPropagation(); onSelect(path.id); } }} />
    {selected && enabled && <group userData={{ waterCaptureExclude: true }}>
      {path.points.map((p, i) => <mesh key={i} position={[p[0], groundHeight(...p, site) + 0.18, p[1]]} renderOrder={15}
        onPointerDown={event => down(event, i)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={event => event.stopPropagation()}>
        <sphereGeometry args={[0.28, 12, 8]} /><meshBasicMaterial color="#f6d49a" depthTest={false} /><PointNumber number={i + 1} />
      </mesh>)}
      <PathDimensions points={path.points} site={site} width={path.width} />
    </group>}
  </group>;
}

function PathDimensions({ points, site, width }: { points: PathPoint[]; site: Project['site']; width?: number }) {
  return <>{points.slice(1).map((p, i) => {
    const a = points[i], x = (p[0] + a[0]) / 2, z = (p[1] + a[1]) / 2;
    return <Html key={i} position={[x, groundHeight(x, z, site) + 0.4, z]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}><span className="path-dimension">{Math.hypot(p[0]-a[0],p[1]-a[1]).toFixed(1)} m{i === 0 && width !== undefined ? ` · ${width.toFixed(1)} m wide` : ''}</span></Html>;
  })}</>;
}

export function PathDraft({ points, site }: { points: PathPoint[]; site: Project['site'] }) {
  const geometry = useMemo(() => {
    const vertices: THREE.Vector3[] = [];
    points.slice(1).forEach((b, i) => {
      const a = points[i], count = Math.max(1, Math.ceil(pathLength([a, b]) / 0.5));
      for (let j = 0; j < count; j++) for (const t of [j / count, (j + 1) / count]) {
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        vertices.push(new THREE.Vector3(x, groundHeight(x, z, site) + 0.1, z));
      }
    });
    return new THREE.BufferGeometry().setFromPoints(vertices);
  }, [points, site.terrain]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group userData={{ waterCaptureExclude: true }}>
    <lineSegments geometry={geometry} raycast={() => undefined}><lineBasicMaterial color="#f7d49b" depthTest={false} /></lineSegments>
    {points.map((p, i) => <mesh key={i} position={[p[0], groundHeight(...p, site) + 0.2, p[1]]} raycast={() => undefined}><sphereGeometry args={[0.25, 10, 8]} /><meshBasicMaterial color="#f7d49b" depthTest={false} /></mesh>)}
    <PathDimensions points={points} site={site} />
  </group>;
}
