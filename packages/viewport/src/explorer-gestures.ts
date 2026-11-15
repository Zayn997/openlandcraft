import { AnimationClip, AnimationMixer, Bone, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type Group } from 'three';

/** Local clips for the curated boy/girl rig. The project asset and its original clips stay untouched. */
export function explorerGestures(source: Group) {
  const rig = source.clone(true), mixer = new AnimationMixer(rig), idle = source.animations.find(clip => clip.name === 'Idle');
  if (idle) { mixer.clipAction(idle).play(); mixer.setTime(0); }
  rig.updateMatrixWorld(true);
  const bones: Bone[] = []; rig.traverse(node => { if (node instanceof Bone) bones.push(node); });
  const base = new Map(bones.map(bone => [bone, { position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(), world: bone.getWorldQuaternion(new Quaternion()), point: bone.getWorldPosition(new Vector3()) }]));
  const named = (name: string) => bones.find(bone => bone.name.replace(/[._]/g, '') === name);
  mixer.stopAllAction(); mixer.uncacheRoot(rig);
  const aim = (bone: Bone | undefined, child: Bone | undefined, direction: Vector3) => {
    if (!bone || !child) return;
    const rest = base.get(bone)!, restDirection = base.get(child)!.point.clone().sub(rest.point).normalize();
    const rotation = new Quaternion().setFromUnitVectors(restDirection, direction.normalize()).multiply(rest.world);
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(rotation));
    bone.updateMatrixWorld(true);
  };
  const feet = () => {
    // This rig has independent foot control bones rather than feet parented to shins.
    for (const side of ['L', 'R']) {
      const shin = named(`LowerLeg${side}`), foot = named(`Foot${side}`);
      if (!shin || !foot) continue;
      const rotation = shin.getWorldQuaternion(new Quaternion()).multiply(base.get(shin)!.world.clone().invert());
      const offset = base.get(foot)!.point.clone().sub(base.get(shin)!.point).applyQuaternion(rotation);
      foot.position.copy(foot.parent!.worldToLocal(shin.getWorldPosition(new Vector3()).add(offset)));
      foot.quaternion.copy(foot.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(rotation).multiply(base.get(foot)!.world));
      foot.updateMatrixWorld(true);
    }
  };
  const clip = (name: string, duration: number, sample: (t: number) => void) => {
    const count = 32, times = Array.from({ length: count + 1 }, (_, i) => i / count * duration);
    const values = new Map(bones.map(bone => [bone, { position: [] as number[], rotation: [] as number[], scale: [] as number[] }]));
    for (let i = 0; i <= count; i++) {
      for (const bone of bones) { const pose = base.get(bone)!; bone.position.copy(pose.position); bone.quaternion.copy(pose.quaternion); bone.scale.copy(pose.scale); }
      rig.updateMatrixWorld(true); sample(i / count); feet();
      for (const bone of bones) { const frames = values.get(bone)!; bone.position.toArray(frames.position, frames.position.length); bone.quaternion.toArray(frames.rotation, frames.rotation.length); bone.scale.toArray(frames.scale, frames.scale.length); }
    }
    return new AnimationClip(name, duration, bones.flatMap(bone => {
      const frames = values.get(bone)!;
      return [new VectorKeyframeTrack(`${bone.name}.position`, times, frames.position), new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, frames.rotation), new VectorKeyframeTrack(`${bone.name}.scale`, times, frames.scale)];
    }));
  };
  const limb = (part: string, side: string, upper: Vector3, lower: Vector3) => {
    const a = named(`Upper${part}${side}`), b = named(`Lower${part}${side}`), end = named(`${part === 'Arm' ? 'Fist' : 'Foot'}${side}`);
    aim(a, b, upper); aim(b, end, lower);
  };
  const jump = clip('ExploreJump', 1, t => {
    const tuck = Math.sin(Math.PI * t), lift = Math.sin(Math.PI * Math.min(1, t * 1.3));
    for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
      limb('Arm', side, new Vector3(sign * 0.55, -0.6 + lift * 1.1, 0.6), new Vector3(sign * 0.3, -0.25 + lift * 0.6, 0.7));
      limb('Leg', side, new Vector3(sign * 0.1, -1, 0.65 * tuck), new Vector3(0, -1, -0.9 * tuck));
    }
  });
  const swim = clip('ExploreSwim', 1.4, t => {
    // Pull from front to back below the surface, then recover forward above it.
    const phase = -t * Math.PI * 2;
    const neck = named('Neck');
    if (neck) { neck.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.65)); neck.updateMatrixWorld(true); }
    for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
      const stroke = phase + (sign > 0 ? 0 : Math.PI);
      limb('Arm', side, new Vector3(sign * 0.35, Math.cos(stroke), -0.65 * Math.sin(stroke)), new Vector3(sign * 0.2, Math.cos(stroke - 0.3), -0.65 * Math.sin(stroke - 0.3)));
      const kick = Math.sin(phase * 2 + (sign > 0 ? 0 : Math.PI));
      limb('Leg', side, new Vector3(sign * 0.12, -1, kick * 0.22), new Vector3(0, -1, -Math.max(0, kick) * 0.4));
    }
  });
  const tread = clip('ExploreTread', 1.8, t => {
    const phase = t * Math.PI * 2;
    for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
      const beat = Math.sin(phase + (sign > 0 ? 0 : Math.PI));
      limb('Arm', side, new Vector3(sign * 0.95, -0.25 + beat * 0.1, 0.2 * Math.cos(phase)), new Vector3(sign * 0.65, -0.4, 0.55 * Math.sin(phase)));
      limb('Leg', side, new Vector3(sign * 0.25, -0.85, beat * 0.3), new Vector3(sign * 0.15, -1, -Math.max(0, beat) * 0.45));
    }
  });
  return { jump, swim, tread };
}
