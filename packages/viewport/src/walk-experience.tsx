import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, MathUtils, PerspectiveCamera, Vector3, type AnimationAction } from 'three';
import { groundHeight, type Asset, type Project } from '@openlandcraft/core';
import { loadModel, disposeModel } from './models';
import { useAnimatedModel } from './use-animated-model';
import { advanceWalk, findWalkSpawn, JUMP_SPEED, SWIM_FLOAT_RATIO, type WalkPose, type WalkMotion } from './walk-motion';
import { createWalkEnvironment, walkCollisionMeshes } from './walk-collision';
import { explorerGestures } from './explorer-gestures';

export type WalkCharacter = 'boy' | 'girl';
export type WalkExperienceConfig = { character: WalkCharacter; asset: Asset; firstPerson: boolean };
export type WalkExperienceStatus = { moving: boolean; x: number; z: number; motion?: WalkMotion; error?: string };

function WalkingAvatar({ source, pose, height }: { source: Group; pose: React.RefObject<WalkPose | null>; height: number }) {
  const { object, animation, reduced } = useAnimatedModel(source, 'Idle', false);
  const clips = useMemo(() => explorerGestures(source), [source]);
  const actions = useRef<Record<string, AnimationAction>>({}), pivot = useRef<Group>(null);
  useLayoutEffect(() => {
    const clip = source.animations.find(clip => clip.name === 'Walk');
    const extra = { ...clips, ...(clip ? { walk: clip } : {}) };
    actions.current = Object.fromEntries(Object.entries(extra).map(([key, clip]) => {
      const action = animation.mixer.clipAction(clip).setEffectiveWeight(0).play();
      if (key === 'jump') action.paused = true;
      return [key, action];
    }));
    return () => { Object.values(actions.current).forEach(action => action.stop()); actions.current = {}; };
  }, [source, animation, clips]);
  useLayoutEffect(() => { object.traverse(child => { if ('castShadow' in child) child.castShadow = true; }); }, [object]);
  useFrame((_, delta) => {
    const current = pose.current, speed = current?.speed ?? 0, motion = current?.motion ?? 'ground';
    const walking = Math.min(1, speed / 0.6), swim = motion === 'swim' ? walking : 0;
    const weights: Record<string, number> = { walk: motion === 'ground' ? walking : 0, jump: Number(motion === 'air'), swim, tread: motion === 'swim' ? 1 - swim : 0 };
    const blend = reduced.current ? 1 : 1 - Math.exp(-14 * Math.min(delta, 0.1));
    let weight = 0;
    for (const [key, action] of Object.entries(actions.current)) {
      const next = MathUtils.lerp(action.getEffectiveWeight(), weights[key] ?? 0, blend);
      action.setEffectiveWeight(next); weight += next;
      if (key === 'walk') action.setEffectiveTimeScale(Math.max(0.6, speed / 1.4));
      if (key === 'swim') action.setEffectiveTimeScale(Math.max(0.7, speed / 1.35));
      if (key === 'jump') action.time = motion === 'air' ? MathUtils.clamp(((current?.falling ?? JUMP_SPEED) + JUMP_SPEED) / (JUMP_SPEED * 2), 0.01, 0.99) : 0.99;
    }
    animation.action?.setEffectiveWeight(Math.max(0, 1 - weight));
    animation.mixer.update(reduced.current ? 0 : Math.min(delta, 0.1));
    if (pivot.current) pivot.current.rotation.x = MathUtils.lerp(pivot.current.rotation.x, motion === 'swim' ? 0.12 + swim * 1.05 : 0, blend);
  });
  return <group position={[0, height * 0.72, 0]}><group ref={pivot}><group position={[0, -height * 0.72, 0]}><primitive object={object} dispose={null} /></group></group></group>;
}

export function WalkExperience({ project, config, onStatus }: { project: Project; config: WalkExperienceConfig; onStatus: (status: WalkExperienceStatus) => void }) {
  const { camera, gl, scene } = useThree();
  const [source, setSource] = useState<Group | null>(null);
  const avatar = useRef<Group>(null), keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0, pitch: 0.22 });
  const reduced = useRef(false);
  const height = config.character === 'boy' ? 1.78 : 1.68;
  const world = useMemo(() => createWalkEnvironment(project, walkCollisionMeshes(scene, project), height), [project, scene, height]);
  const pose = useRef<WalkPose | null>(null), published = useRef(0), cameraReady = useRef(false);
  const desired = useMemo(() => new Vector3(), []), head = useMemo(() => new Vector3(), []);
  useEffect(() => {
    let alive = true, owned: Group | null = null;
    setSource(null); keys.current.clear();
    loadModel(config.asset).then(object => { if (!alive) { disposeModel(object); return; } owned = object; setSource(object); }).catch(error => {
      if (alive) onStatus({ moving: false, x: pose.current?.x ?? 0, z: pose.current?.z ?? 0, error: error instanceof Error ? error.message : 'Character could not load.' });
    });
    return () => { alive = false; if (owned) disposeModel(owned); };
  }, [config.asset]);
  useEffect(() => {
    const point = findWalkSpawn(project);
    if (!point) { onStatus({ moving: false, x: 0, z: 0, error: 'No clear starting position was found. Leave Explore and clear some space.' }); return; }
    const [x, z] = point, floor = world.floor(x, z, groundHeight(x, z, project.site) + 0.34), water = world.water?.(x, z) ?? null;
    const swimming = water !== null && water - floor > height * 0.62;
    pose.current = { x, y: swimming ? water - height * SWIM_FLOAT_RATIO : floor, z, yaw: Math.atan2(-x, -z), falling: 0, speed: 0, motion: swimming ? 'swim' : 'ground' };
    look.current.yaw = Math.atan2(x, z); cameraReady.current = false;
    onStatus({ moving: false, x, z, motion: pose.current.motion });
  }, [project]);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.fov = 60; camera.near = 0.05; camera.updateProjectionMatrix(); cameraReady.current = false;
  }, [camera, config.firstPerson]);
  useEffect(() => {
    const canvas = gl.domElement;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => { reduced.current = preference.matches; };
    updatePreference(); preference.addEventListener('change', updatePreference);
    const previousTabIndex = canvas.getAttribute('tabindex'), previousLabel = canvas.getAttribute('aria-label');
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Explore scene. WASD or arrow keys move or swim, Space jumps, drag to look, Shift moves faster, Escape returns to editing.'); canvas.focus({ preventScroll: true });
    let drag: { id: number; x: number; y: number } | null = null;
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input, textarea, select, [role="textbox"], [contenteditable="true"]');
    const down = (event: KeyboardEvent) => {
      if (editable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Space' && event.target instanceof HTMLElement && event.target.closest('button, a, [role="button"], [role="checkbox"]')) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'].includes(event.code)) { event.preventDefault(); keys.current.add(event.code); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const clear = () => { keys.current.clear(); drag = null; };
    const pointerDown = (event: PointerEvent) => { if (event.button !== 0) return; canvas.focus({ preventScroll: true }); drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); };
    const pointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      look.current.yaw -= (event.clientX - drag.x) * 0.004;
      look.current.pitch = MathUtils.clamp(look.current.pitch + (event.clientY - drag.y) * 0.003, -0.2, 0.8);
      drag.x = event.clientX; drag.y = event.clientY;
    };
    const pointerUp = (event: PointerEvent) => { if (drag?.id !== event.pointerId) return; drag = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', clear); canvas.addEventListener('lostpointercapture', clear);
    return () => {
      preference.removeEventListener('change', updatePreference);
      clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', clear); canvas.removeEventListener('lostpointercapture', clear);
      if (previousTabIndex === null) canvas.removeAttribute('tabindex'); else canvas.setAttribute('tabindex', previousTabIndex);
      if (previousLabel === null) canvas.removeAttribute('aria-label'); else canvas.setAttribute('aria-label', previousLabel);
    };
  }, [gl]);
  useFrame((_, delta) => {
    if (!(camera instanceof PerspectiveCamera) || !pose.current || !source) return;
    const held = keys.current;
    const next = advanceWalk(pose.current, {
      forward: Number(held.has('KeyW') || held.has('ArrowUp')) - Number(held.has('KeyS') || held.has('ArrowDown')),
      right: Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft')),
      running: held.has('ShiftLeft') || held.has('ShiftRight'), jump: held.has('Space'), yaw: look.current.yaw,
    }, delta, world);
    pose.current = next;
    if (avatar.current) { avatar.current.position.set(next.x, next.y, next.z); avatar.current.rotation.y = next.yaw; avatar.current.visible = !config.firstPerson; }
    const { yaw, pitch } = look.current;
    head.set(next.x, next.y + (config.firstPerson ? height * 0.92 : height * 0.72), next.z);
    if (config.firstPerson) {
      camera.position.copy(head);
      desired.set(head.x - Math.sin(yaw) * Math.cos(pitch), head.y - Math.sin(pitch), head.z - Math.cos(yaw) * Math.cos(pitch));
      camera.lookAt(desired);
    } else {
      desired.set(head.x + Math.sin(yaw) * 4.5 * Math.cos(pitch), head.y + 4.5 * Math.sin(pitch), head.z + Math.cos(yaw) * 4.5 * Math.cos(pitch));
      desired.copy(world.obstructed(head, desired));
      desired.y = Math.max(desired.y, groundHeight(desired.x, desired.z, project.site) + 0.3, (world.water?.(desired.x, desired.z) ?? -Infinity) + 0.25);
      if (!cameraReady.current || reduced.current) camera.position.copy(desired); else camera.position.lerp(desired, 1 - Math.exp(-14 * Math.min(delta, 0.1)));
      camera.lookAt(head);
    }
    camera.updateMatrixWorld(); cameraReady.current = true;
    published.current += delta;
    if (published.current >= 0.12) { published.current = 0; onStatus({ moving: next.speed > 0.05, x: next.x, z: next.z, motion: next.motion }); }
  });
  return <group ref={avatar} visible={false} userData={{ experienceAvatar: true, waterCaptureExclude: true }}>
    {source && <WalkingAvatar source={source} pose={pose} height={height} />}
  </group>;
}
