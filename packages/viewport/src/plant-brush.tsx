import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { PlantBrushStroke, groundHeight, type PlantBrushSettings, type Asset, type Editor, type Project } from '@openlandcraft/core';
import { intersectTerrain } from './terrain-picking';

export type PlantBrushOptions = { settings: PlantBrushSettings; onAdded: (ids: string[]) => void };
type Props = { enabled: boolean; asset?: Asset | null; options?: PlantBrushOptions; editor: Editor; project: Project; onError: (message: string) => void };
type Session = { stroke: PlantBrushStroke; asset: Asset; newAsset: boolean; pointerId: number; release: () => void; published: number };

/** Terrain owns the hit target; this hook owns capture and the single history transaction. */
export function usePlantBrush(props: Props) {
  const latest = useRef(props); latest.current = props;
  const session = useRef<Session | null>(null), frame = useRef<number | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const { gl } = useThree();
  const cancel = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const active = session.current; session.current = null;
    if (active) { active.release(); latest.current.editor.cancel(); }
  };
  useEffect(() => {
    const unsubscribe = props.editor.subscribe(() => { if (session.current && !props.editor.getSnapshot().gestureLabel) cancel(); });
    window.addEventListener('blur', cancel);
    gl.domElement.addEventListener('pointercancel', cancel);
    return () => { unsubscribe(); window.removeEventListener('blur', cancel); gl.domElement.removeEventListener('pointercancel', cancel); cancel(); };
  }, [props.editor, gl]);
  useEffect(() => { cancel(); setCursor(null); }, [props.enabled, props.asset?.id]);
  const publish = () => {
    frame.current = null;
    const active = session.current, { editor, onError, options } = latest.current;
    if (!active || active.published === active.stroke.instances.length) return;
    try {
      editor.preview({ type: 'insert', entities: [...active.stroke.instances], assets: active.newAsset ? [active.asset] : [] });
      options?.onAdded(active.stroke.instances.slice(active.published).map(e => e.id));
      active.published = active.stroke.instances.length;
    } catch (error) { cancel(); onError(error instanceof Error ? error.message : 'Plant painting failed.'); }
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!latest.current.enabled) return;
    event.stopPropagation();
    if (session.current && session.current.pointerId !== event.pointerId) return;
    const hit = intersectTerrain(event.ray, latest.current.project.site);
    setCursor(hit ? [hit.point.x, hit.point.z] : null);
    if (!session.current) return;
    if (!hit) { session.current.stroke.breakPath(); return; }
    session.current.stroke.move(hit.point.x, hit.point.z);
    if (frame.current === null) frame.current = requestAnimationFrame(publish);
  };
  const down = (event: ThreeEvent<PointerEvent>) => {
    const { enabled, asset, options, editor, onError } = latest.current;
    if (!enabled || !asset || !options || event.button !== 0 || session.current) return;
    event.stopPropagation();
    try {
      editor.cancel();
      const project = editor.getSnapshot().project;
      const existing = project.assets.find(source => source.data === asset.data);
      const source = existing ?? { ...asset, id: project.assets.some(a => a.id === asset.id) ? crypto.randomUUID() : asset.id };
      const stroke = new PlantBrushStroke(project, source, { ...options.settings }, Math.floor(Math.random() * 2147483647));
      const target = event.target as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
      editor.begin(`Paint ${asset.name}`);
      session.current = { stroke, asset: source, newAsset: !existing, pointerId: event.pointerId, published: 0,
        release: () => { try { target.releasePointerCapture(event.pointerId); } catch { /* Browser already released capture. */ } } };
      target.setPointerCapture(event.pointerId);
      onError(''); move(event);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      publish();
    } catch (error) { cancel(); onError(error instanceof Error ? error.message : 'Plant painting failed.'); }
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    if (session.current?.pointerId !== event.pointerId) return;
    event.stopPropagation(); move(event);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    publish();
    const active = session.current; session.current = null;
    if (!active) return;
    if (active.published) latest.current.editor.commit(); else latest.current.editor.cancel();
    active.release();
    if (active.stroke.limited) latest.current.onError('Scene limit reached (1,000 objects). Remove objects before painting more.');
    else if (!active.published) latest.current.onError('No room to plant here. Paint clear terrain, increase density, or enlarge the brush.');
  };
  return { down, move, up, cancel, out: () => { if (!session.current) setCursor(null); },
    ring: props.enabled && props.options && cursor ? <PlantBrushRing position={cursor} radius={props.options.settings.radius} project={props.project} /> : null };
}

function PlantBrushRing({ position: [x, z], radius, project }: { position: [number, number]; radius: number; project: Project }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => {
    const px = x + Math.cos(i / 64 * Math.PI * 2) * radius, pz = z + Math.sin(i / 64 * Math.PI * 2) * radius;
    return new THREE.Vector3(px, groundHeight(px, pz, project.site) + 0.12, pz);
  })), [x, z, radius, project.site]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <lineLoop geometry={geometry} raycast={() => undefined} renderOrder={10} userData={{ waterCaptureExclude: true }}><lineBasicMaterial color="#e4ffb2" depthTest={false} /></lineLoop>;
}
