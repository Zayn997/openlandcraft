/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AnimationMixer, Bone, Vector3 } from 'three';
import { encodeGlb } from '@openlandcraft/core';
import { loadModel, disposeModel } from './models';
import { explorerGestures } from './explorer-gestures';

describe('boy and girl jump/swim gestures', () => {
  it.each(['person-male','person-female'])('pulls underwater and recovers forward above water for %s', async id => {
    const data = encodeGlb(readFileSync(new URL(`../../../apps/web/public/models/characters/${id}.glb`, import.meta.url)));
    const source = await loadModel({ id, name: id, data, attribution: '' }), clip = explorerGestures(source).swim;
    const rig = source.clone(true); rig.rotation.x = 1.17;
    const named = (name: string) => { let match: Bone | undefined; rig.traverse(node => { if (node instanceof Bone && node.name.replace(/[._]/g, '') === name) match = node; }); return match!; };
    const mixer = new AnimationMixer(rig); mixer.clipAction(clip).play();
    const sample = (phase: number) => {
      mixer.setTime(phase * clip.duration); rig.updateMatrixWorld(true);
      return named('FistL').getWorldPosition(new Vector3()).sub(named('UpperArmL').getWorldPosition(new Vector3()));
    };
    const entry = sample(0), pull = sample(0.25), back = sample(0.5), recovery = sample(0.75);
    expect(pull.y).toBeLessThan(0); expect(recovery.y).toBeGreaterThan(0);
    expect(back.z).toBeLessThan(pull.z); expect(entry.z).toBeGreaterThan(recovery.z);
    // Opposite arms alternate their pull and recovery rather than moving together.
    mixer.setTime(clip.duration * 0.25); rig.updateMatrixWorld(true);
    const right = named('FistR').getWorldPosition(new Vector3()).sub(named('UpperArmR').getWorldPosition(new Vector3()));
    expect(right.y).toBeGreaterThan(0);
    mixer.uncacheRoot(rig); disposeModel(source);
  });
  it.each(['person-male','person-female'])('animates the actual %s rig without changing source clips or disconnecting feet', async id => {
    const data = encodeGlb(readFileSync(new URL(`../../../apps/web/public/models/characters/${id}.glb`, import.meta.url)));
    const source = await loadModel({ id, name: id, data, attribution: '' }), before = source.toJSON();
    const gestures = explorerGestures(source); expect(source.toJSON()).toEqual(before); expect(source.animations.map(clip => clip.name)).toEqual(['Idle','Walk']);
    const rig = source.clone(true), bones: Bone[] = []; rig.traverse(node => { if (node instanceof Bone) bones.push(node); });
    const named = (name: string) => bones.find(bone => bone.name.replace(/[._]/g, '') === name)!;
    const mixer = new AnimationMixer(rig), measurements: number[] = [];
    for (const clip of Object.values(gestures)) {
      expect(clip.tracks.length).toBe(bones.length * 3); expect(clip.validate()).toBe(true);
      const action = mixer.clipAction(clip).play();
      for (const t of [0,0.25,0.5,0.75]) {
        mixer.setTime(t * clip.duration); rig.updateMatrixWorld(true);
        for (const bone of bones) { expect([...bone.position, ...bone.quaternion].every(Number.isFinite)).toBe(true); expect(bone.quaternion.length()).toBeCloseTo(1, 4); }
        const knee = named('LowerLegL').getWorldPosition(new Vector3()), foot = named('FootL').getWorldPosition(new Vector3()); measurements.push(knee.distanceTo(foot));
      }
      action.stop();
      if (clip !== gestures.jump) for (const track of clip.tracks) {
        const size = track.getValueSize();
        for (let i = 0; i < size; i++) expect(track.values[i]).toBeCloseTo(track.values[track.values.length - size + i], 5);
      }
    }
    expect(Math.max(...measurements) - Math.min(...measurements)).toBeLessThan(0.0001);
    expect(gestures.swim.tracks.find(track => track.name.includes('UpperArmL') && track.name.endsWith('quaternion'))!.values).not.toEqual(gestures.tread.tracks.find(track => track.name.includes('UpperArmL') && track.name.endsWith('quaternion'))!.values);
    mixer.uncacheRoot(rig); disposeModel(source);
  });
});
