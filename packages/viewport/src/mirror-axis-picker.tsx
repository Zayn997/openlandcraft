import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Raycaster, Vector2, Vector3 } from 'three';
import { groundHeight, mirrorAxisPoint, mirrorReferenceLines, type MirrorReferenceLine, type PlanPoint, type Project } from '@openlandcraft/core';
import { DrawingGesture } from './drawing-gesture';
import { intersectTerrain } from './terrain-picking';
import { ArchitectureLabel } from './architecture-label';

export type MirrorAxisInput = {
  mode: 'draw' | 'reference';
  points: PlanPoint[];
  onPoint: (point: PlanPoint) => void;
  onReference: (line: MirrorReferenceLine) => void;
};

export function referenceLinePoints(line: MirrorReferenceLine, project: Project): [number, number, number][] {
  const count = line.height === undefined ? 33 : 2;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1), x = line.start[0] + (line.end[0] - line.start[0]) * t, z = line.start[1] + (line.end[1] - line.start[1]) * t;
    return [x, (line.height ?? groundHeight(x, z, project.site)) + 0.3, z];
  });
}

/** Canvas input runs independently of model raycasts, so an existing object never
 * intercepts an axis click or changes the fixed source selection.
 */
export function MirrorAxisPicker({ project, isolatedId, input, snapping }: { project: Project; isolatedId?: string | null; input: MirrorAxisInput; snapping: boolean }) {
  const { gl, camera } = useThree();
  const [cursor, setCursor] = useState<PlanPoint | null>(null);
  const [hover, setHover] = useState<MirrorReferenceLine | null>(null);
  const references = useMemo(() => mirrorReferenceLines(project, isolatedId), [project, isolatedId]);
  const segments = useMemo(() => references.map(line => ({ line, points: referenceLinePoints(line, project).map(point => new Vector3(...point)) })), [references, project]);
  useEffect(() => {
    const canvas = gl.domElement, gesture = new DrawingGesture(), raycaster = new Raycaster();
    const at = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (input.mode === 'reference') {
        let nearest: MirrorReferenceLine | null = null, best = 10;
        for (const { line, points } of segments) for (let i = 1; i < points.length; i++) {
          const a = points[i - 1].clone().project(camera), b = points[i].clone().project(camera);
          if (a.z < -1 || a.z > 1 || b.z < -1 || b.z > 1) continue;
          const ax = (a.x + 1) * rect.width / 2, ay = (1 - a.y) * rect.height / 2;
          const bx = (b.x + 1) * rect.width / 2, by = (1 - b.y) * rect.height / 2;
          const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
          if (length < 1) continue;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
          const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy);
          if (distance < best) { best = distance; nearest = line; }
        }
        setHover(nearest);
        return { line: nearest };
      }
      raycaster.setFromCamera(new Vector2(x / rect.width * 2 - 1, 1 - y / rect.height * 2), camera);
      const hit = intersectTerrain(raycaster.ray, project.site);
      const point = hit ? mirrorAxisPoint([hit.point.x, hit.point.z], input.points[0], snapping, event.shiftKey) : null;
      setCursor(point);
      return { point };
    };
    const down = (event: PointerEvent) => gesture.down(event.pointerId, event.button, event.clientX, event.clientY);
    const move = (event: PointerEvent) => { gesture.move(event.pointerId, event.clientX, event.clientY); at(event); };
    const up = (event: PointerEvent) => {
      gesture.up(event.pointerId, event.button, event.clientX, event.clientY);
      if (!gesture.consume(event.button)) return;
      const result = at(event);
      if (result.line) input.onReference(result.line);
      if (result.point) input.onPoint(result.point);
    };
    const cancel = () => gesture.cancel();
    const leave = () => { setCursor(null); setHover(null); };
    canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointermove', move, true); canvas.addEventListener('pointerup', up, true);
    canvas.addEventListener('pointercancel', cancel, true); canvas.addEventListener('lostpointercapture', cancel, true); canvas.addEventListener('wheel', cancel, { capture: true, passive: true }); canvas.addEventListener('pointerleave', leave); window.addEventListener('blur', cancel);
    return () => {
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true); canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', cancel, true); canvas.removeEventListener('lostpointercapture', cancel, true); canvas.removeEventListener('wheel', cancel, true); canvas.removeEventListener('pointerleave', leave); window.removeEventListener('blur', cancel);
    };
  }, [gl, camera, input, snapping, segments]);
  const last = input.points.at(-1);
  const showCursor = cursor && (!last || Math.hypot(cursor[0] - last[0], cursor[1] - last[1]) >= 0.2);
  const points = [...input.points, ...(showCursor ? [cursor!] : [])].map(([x, z]): [number, number, number] => [x, groundHeight(x, z, project.site) + 0.4, z]);
  const reference = hover && referenceLinePoints(hover, project);
  return <group userData={{ waterCaptureExclude: true }}>
    {input.mode === 'draw' && points.length > 1 && <Line points={points} color="#edc37e" dashed dashSize={0.5} gapSize={0.25} lineWidth={2} depthTest={false} raycast={() => undefined} />}
    {input.mode === 'draw' && points.map((point, i) => <ArchitectureLabel key={i} position={point} text={i === 0 ? 'Axis start' : 'Axis end'} />)}
    {reference && <><Line points={reference} color="#76d6e5" lineWidth={4} depthTest={false} raycast={() => undefined} /><ArchitectureLabel position={reference[Math.floor(reference.length / 2)]} text={`Reference · ${hover!.name}`} screenOffset={[0, -18]} /></>}
  </group>;
}
