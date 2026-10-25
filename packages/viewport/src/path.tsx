import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { groundHeight, snapPathPoint, type Editor, type Path, type Project, type Instance } from '@openlandcraft/core';
import { pathLength, pathStrips, pathIssue, roundedRoutePoints, clipPathPolygon, polygonArea, surfaceElevationAt, compileSurface, type SiteSurface, type PathPoint, type PathSurface } from '@openlandcraft/landscape';
import { buildPathMesh, updatePathHeights, PATH_LIFT } from './path-geometry';
import { intersectTerrain } from './terrain-picking';
import { PointNumber } from './river';
import {useDrawingClick} from './drawing-gesture';
import {PathCornerPopover} from './path-corner-popover';
import {BridgeStructure} from './bridge';

export function pathMaterial(surface: Path['surface'],settings:{color?:string;roughness?:number;scale?:number}={}) {
  const material = new THREE.MeshStandardMaterial({ color: settings.color??(surface === 'gravel' ? '#bdad90' : surface === 'paving' ? '#a5a89f' : '#927453'), roughness: settings.roughness??(surface === 'timber' ? 0.85 : 0.96) });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vPathUV;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvPathUV=uv;');
    shader.fragmentShader = 'varying vec2 vPathUV;\nfloat pathHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 p=vPathUV/${(settings.scale??1).toFixed(4)};
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
  material.customProgramCacheKey = () => `path-${surface}-${settings.scale??1}`;
  return material;
}

export function PathLayer({ path, project, selected, enabled, snapping, editor, onSelect, onError, owner, selectedAnchor, onAnchorSelect,cornerControls, surfaces }: {
  path: Path; project: Project; selected: boolean; enabled: boolean; snapping: boolean; editor: Editor; onSelect: (id: string) => void; onError: (message: string) => void;
  owner?:Instance;
  surfaces?:PathSurface[];
  selectedAnchor?:number|null;onAnchorSelect?:(index:number)=>void;
  cornerControls?:ReactNode;
}) {
  const centerline=useMemo(()=>roundedRoutePoints(path),[path.points,path.cornerRounding,path.width]);
  const shape = JSON.stringify([centerline,path.bridge]), site = project.site;
  const mesh = useMemo(() => owner ? null : buildPathMesh(path, site, surfaces), [shape, path.width, path.surface, surfaces, site.width, site.depth, site.terrain.columns, site.terrain.rows,!!owner]);
  const elevationKey=JSON.stringify([path.elevationMode,path.elevation,path.endElevation]);
  useLayoutEffect(() => {if(mesh)updatePathHeights(mesh, site,path);}, [mesh, site.terrain,elevationKey]);
  useEffect(() => () => mesh?.geometry.dispose(), [mesh]);
  const material = useMemo(() => pathMaterial(path.surface), [path.surface]);
  useEffect(() => () => material.dispose(), [material]);
  const strips = useMemo(() => surfaces?.map(surface=>surface.points)??pathStrips({...path,points:centerline}), [shape, path.width,surfaces]);
  const surface = useRef<THREE.Mesh>(null);
  const pick: THREE.Mesh['raycast'] = (raycaster, hits) => {
    if (!enabled || !surface.current) return;
    if(path.elevationMode!=='terrain'){THREE.Mesh.prototype.raycast.call(surface.current,raycaster,hits);return;}
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
  const active = useRef<{ path: Path; owner?:Instance; index: number; pointerId: number; release: () => void; valid: boolean;start:[number,number];moved:boolean } | null>(null);
  const cancel = () => { const session = active.current; active.current = null; if (session) { session.release(); editor.cancel(); if (orbit) orbit.enabled = allowed.current; } };
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => { if (!editor.getSnapshot().gestureLabel && active.current) cancel(); });
    window.addEventListener('blur', cancel); window.addEventListener('pointercancel', cancel);
    return () => { unsubscribe(); window.removeEventListener('blur', cancel); window.removeEventListener('pointercancel', cancel); cancel(); };
  }, [editor, orbit]);
  useEffect(() => { if (!enabled || !selected) cancel(); }, [enabled, selected]);
  const down = (event: ThreeEvent<PointerEvent>, index: number) => {
    if (!enabled || event.button !== 0 || editor.getSnapshot().gestureLabel) return;
    event.stopPropagation(); if (orbit) orbit.enabled = false;
    const target = event.target as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
    target.setPointerCapture(event.pointerId);
    active.current = { path, owner, index, pointerId: event.pointerId, valid: true, start:[event.clientX,event.clientY],moved:false,release: () => { try { target.releasePointerCapture(event.pointerId); } catch { /* Capture may already have ended. */ } } };
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    const session = active.current; if (!session || session.pointerId !== event.pointerId) return;
    if(!session.moved){if(Math.hypot(event.clientX-session.start[0],event.clientY-session.start[1])<=4)return;session.moved=true;editor.begin(`Move path point ${session.index+1}`);}
    event.stopPropagation();
    const planePoint=session.path.elevationMode==='terrain'?null:event.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-surfaceElevationAt(session.path,site,session.path.points[session.index])-.18),new THREE.Vector3());
    const hit=planePoint?{point:planePoint}:intersectTerrain(event.ray, site);
    if (!hit) { session.valid = false; onError('Keep the path inside the site.'); return; }
    const points = (session.owner?.walkingRoute?.points??session.path.points).map(p => [...p] as PathPoint);
    points[session.index] = snapPathPoint(project, [hit.point.x, hit.point.z], snapping, session.index === 0 || session.index === points.length - 1,session.path.id,editor.getSnapshot().isolatedLayerId).point;
    try { editor.preview({ type: 'replace', entity: session.owner ? {...session.owner,walkingRoute:{...session.owner.walkingRoute!,points}} : { ...session.path, points } }); session.valid = true; onError(''); }
    catch (error) { session.valid = false; onError(error instanceof Error ? error.message : 'This path point is invalid.'); }
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    const session = active.current; if (!session || session.pointerId !== event.pointerId) return;
    event.stopPropagation(); active.current = null;
    if(session.moved){session.valid ? editor.commit() : editor.cancel();}else onAnchorSelect?.(session.index);
    session.release(); if (orbit) orbit.enabled = allowed.current;
  };
  return <group>
    {path.bridge&&<BridgeStructure path={path} site={site} onSelect={()=>{if(enabled)onSelect(path.id);}}/>}
    {owner ? <PathDraft points={owner.walkingRoute!.points} curvePoints={path.points} width={path.width} site={site} showPoints={false} showDimensions={false}/> : <mesh ref={surface} geometry={mesh!.geometry} material={material} receiveShadow raycast={pick} onClick={event => { if (enabled && event.delta <= 4) { event.stopPropagation(); onSelect(path.id); } }} />}
    {selected && enabled && <group userData={{ waterCaptureExclude: true }}>
      {(owner?.walkingRoute?.points??path.points).map((p, i) => <mesh key={i} position={[p[0], surfaceElevationAt(path,site,p) + 0.18, p[1]]} renderOrder={15}
        onPointerDown={event => down(event, i)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={event => event.stopPropagation()}>
        <sphereGeometry args={[i===selectedAnchor ? .36 : .28, 12, 8]} /><meshBasicMaterial color={i===selectedAnchor?'#d7f29c':'#f6d49a'} depthTest={false} /><PointNumber number={i + 1} />
      </mesh>)}
      <PathDimensions points={owner?.walkingRoute?.points??path.points} site={site} width={path.width} elevationSurface={path} />
      {!path.bridge&&selectedAnchor!=null&&(owner?.walkingRoute?.points??path.points)[selectedAnchor]&&cornerControls&&<PathCornerPopover point={(owner?.walkingRoute?.points??path.points)[selectedAnchor]} site={site} height={surfaceElevationAt(path,site,(owner?.walkingRoute?.points??path.points)[selectedAnchor])}>{cornerControls}</PathCornerPopover>}
    </group>}
  </group>;
}

function PathDimensions({ points, site, width,elevationSurface }: { points: PathPoint[]; site: Project['site']; width?: number;elevationSurface?:SiteSurface }) {
  return <>{points.slice(1).map((p, i) => {
    const a = points[i], x = (p[0] + a[0]) / 2, z = (p[1] + a[1]) / 2;
    return <Html key={i} position={[x, (elevationSurface?surfaceElevationAt(elevationSurface,site,[x,z]):groundHeight(x,z,site)) + 0.4, z]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}><span className="path-dimension">{Math.hypot(p[0]-a[0],p[1]-a[1]).toFixed(1)} m{i === 0 && width !== undefined ? ` · ${width.toFixed(1)} m wide` : ''}</span></Html>;
  })}</>;
}

export function PathDraft({ points, curvePoints, site, width, showPoints=true, showDimensions=true, selectedAnchor, onAnchorSelect,cornerControls,elevationSurface }: { points: PathPoint[]; curvePoints?:PathPoint[]; site: Project['site']; width?:number; showPoints?:boolean;showDimensions?:boolean;selectedAnchor?:number|null;onAnchorSelect?:(index:number)=>void;cornerControls?:ReactNode;elevationSurface?:SiteSurface }) {
  const centerline=curvePoints??points,{gl}=useThree(),anchorClick=useDrawingClick(gl.domElement,!!onAnchorSelect);
  const height=useMemo(()=>elevationSurface&&elevationSurface.elevationMode&&elevationSurface.elevationMode!=='terrain'?compileSurface(elevationSurface).height:(p:PathPoint)=>groundHeight(...p,site),[elevationSurface,site]);
  const footprint = useMemo(() => width && centerline.length > 1 && !pathIssue({points:centerline,width},site,{sampled:!!curvePoints}) ? buildPathMesh({...elevationSurface,points:centerline,width,cornerRounding:undefined},site) : null,[centerline,width,site,elevationSurface]);
  useEffect(() => () => footprint?.geometry.dispose(),[footprint]);
  const geometry = useMemo(() => {
    const vertices: THREE.Vector3[] = [];
    centerline.slice(1).forEach((b, i) => {
      const a = centerline[i], count = Math.max(1, Math.ceil(pathLength([a, b]) / 0.5));
      for (let j = 0; j < count; j++) for (const t of [j / count, (j + 1) / count]) {
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        vertices.push(new THREE.Vector3(x, height([x,z]) + 0.1, z));
      }
    });
    return new THREE.BufferGeometry().setFromPoints(vertices);
  }, [centerline, site.terrain,height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group userData={{ waterCaptureExclude: true }}>
    {footprint && <mesh geometry={footprint.geometry} position={[0,0.025,0]} renderOrder={14} raycast={() => undefined}><meshBasicMaterial color="#d7f29c" transparent opacity={0.32} depthWrite={false} side={THREE.DoubleSide}/></mesh>}
    <lineSegments geometry={geometry} raycast={() => undefined}><lineBasicMaterial color="#f7d49b" depthTest={false} /></lineSegments>
    {showPoints && points.map((p, i) => <mesh key={i} position={[p[0], height(p) + 0.2, p[1]]} raycast={onAnchorSelect?THREE.Mesh.prototype.raycast:()=>undefined} onClick={event=>{if(onAnchorSelect){event.stopPropagation();if(event.delta<=4&&anchorClick(event.button))onAnchorSelect(i);}}}><sphereGeometry args={[i===selectedAnchor ? .34 : .25, 10, 8]} /><meshBasicMaterial color={i===selectedAnchor?'#d7f29c':'#f7d49b'} depthTest={false} />{onAnchorSelect&&<PointNumber number={i+1}/>}</mesh>)}
    {showDimensions && <PathDimensions points={points} site={site} width={width} elevationSurface={elevationSurface}/>}
    {selectedAnchor!=null&&points[selectedAnchor]&&cornerControls&&<PathCornerPopover point={points[selectedAnchor]} site={site} height={height(points[selectedAnchor])}>{cornerControls}</PathCornerPopover>}
  </group>;
}
