import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createAnimatedRaycast } from './animated-picking';

/** Each animal owns its skeleton/mixer; loaded geometry and materials stay shared. */
export function useAnimatedModel(source: THREE.Group, clipName: string, interactive: boolean) {
  const object = useMemo(() => clone(source), [source]), reduced = useRef(false);
  const animation = useMemo(() => ({ mixer: new THREE.AnimationMixer(object), clip: source.animations.find(c => c.name === clipName), action: null as THREE.AnimationAction | null }), [object, source, clipName]);
  useLayoutEffect(() => {
    animation.action = animation.clip ? animation.mixer.clipAction(animation.clip).play() : null;
    return () => {
      animation.mixer.stopAllAction(); animation.mixer.uncacheRoot(object); animation.action = null;
      object.traverse(child => { if (child instanceof THREE.SkinnedMesh) child.skeleton.dispose(); });
    };
  }, [animation, object]);
  const meshes = useMemo(() => {
    const values: { mesh: THREE.Mesh; raycast: THREE.Mesh['raycast'] }[] = [];
    object.traverse(child => { if (child instanceof THREE.Mesh) {
      values.push({ mesh: child, raycast: createAnimatedRaycast(child) }); child.frustumCulled = false;
    } });
    return values;
  }, [object]);
  useLayoutEffect(() => { meshes.forEach(({ mesh, raycast }) => { mesh.raycast = interactive ? raycast : () => undefined; }); }, [meshes, interactive]);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = preference.matches; };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  return { object, animation, reduced };
}
