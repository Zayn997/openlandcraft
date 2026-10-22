/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createPlacedInstance, createSite, Editor, encodeGlb, groundCharacterKind, groundRoutes, inspectGlb } from '@openlandcraft/core';
import { serializeProject, deserializeProject } from '@openlandcraft/project';
import { loadModel, disposeModel } from '../../../packages/viewport/src/models';
import { CHARACTERS, HORSE_CREDIT, CHARACTER_CREDIT } from './character-library';

describe('CC0 horses and people', () => {
  for (const character of CHARACTERS) it(`${character.id} has independent, bounded walk and idle animation`, async () => {
    const bytes = readFileSync(new URL(`../public/models/characters/${character.id}.glb`,import.meta.url));
    inspectGlb(bytes); expect(bytes.length).toBeLessThan(450_000);
    const asset = {id:character.id,name:character.name,data:encodeGlb(bytes),attribution:character.category === 'Animals' ? HORSE_CREDIT : CHARACTER_CREDIT};
    expect(groundCharacterKind({...asset,name:'Renamed',attribution:''})).toBe(character.category === 'Animals' ? 'horse' : 'person');
    const source = await loadModel(asset), object = clone(source), other = clone(source);
    expect(source.userData.groundCharacter).toBe(true);
    const meshes:THREE.SkinnedMesh[] = [], others:THREE.SkinnedMesh[] = [];
    object.traverse(o => { if (o instanceof THREE.SkinnedMesh) meshes.push(o); });
    other.traverse(o => { if (o instanceof THREE.SkinnedMesh) others.push(o); });
    expect(meshes.length).toBeGreaterThan(0); expect(meshes[0].skeleton).not.toBe(others[0].skeleton);
    const project = createSite({name:'Character study',width:40,depth:40,resolution:129,preset:'flat'});
    const entity = createPlacedInstance(project,asset,0,0,false,'actor'); project.assets = [asset]; project.entities = [entity];
    const route = groundRoutes(project).get(entity.id)!;
    if (character.category === 'Animals') expect(route.radius).toBeGreaterThan(0);
    else expect(route.reason).toBe('no-path');
    const mixer = new THREE.AnimationMixer(object);
    for (const name of ['Idle','Walk']) {
      const clip = source.animations.find(c => c.name === name)!; expect(clip).toBeDefined();
      if(character.id==='horse'&&name==='Walk')expect(clip.duration).toBeCloseTo(32/30,5);
      mixer.stopAllAction(); mixer.clipAction(clip).play();
      let first:number[] = [], previous:number[] = [], changed = false, radius = 0, bottom = Infinity, top = -Infinity;
      for (let step = 0; step <= 32; step++) {
        mixer.setTime(step/32*clip.duration); object.updateMatrixWorld(true);
        const pose = meshes.flatMap(mesh => { mesh.skeleton.update(); return Array.from(mesh.skeleton.boneMatrices!); });
        // Every interval of the horse's moving loop must articulate, including its second half.
        if(character.id==='horse'&&name==='Walk'&&step>0)expect(Math.max(...pose.map((v,i)=>Math.abs(v-previous[i])))).toBeGreaterThan(.001);
        previous=pose;
        if (!step) first = pose;
        else if (pose.some((v,i) => Math.abs(v-first[i]) > 0.01)) changed = true;
        for (const mesh of meshes) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          const p = mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
          radius = Math.max(radius,Math.hypot(p.x,p.z)); bottom = Math.min(bottom,p.y); top = Math.max(top,p.y);
          if (character.category === 'Animals') for (const pitch of [-0.28,0.28]) {
            const tilted = p.clone().applyAxisAngle(new THREE.Vector3(1,0,0),pitch);
            radius = Math.max(radius,Math.hypot(tilted.x,tilted.z));
          }
        }
      }
      expect(changed).toBe(true);
      expect(radius).toBeLessThan(route.bodyRadius);
      expect(bottom).toBeGreaterThan(-0.13); expect(top).toBeLessThan(route.height+0.2);
      mixer.setTime(clip.duration); object.updateMatrixWorld(true);
      meshes.forEach(mesh => mesh.skeleton.update());
      const end = meshes.flatMap(mesh => Array.from(mesh.skeleton.boneMatrices!));
      end.forEach((v,i) => expect(v).toBeCloseTo(first[i],4));
      mixer.setTime(clip.duration-0.0001); object.updateMatrixWorld(true); meshes.forEach(mesh => mesh.skeleton.update());
      const nearEnd = meshes.flatMap(mesh => Array.from(mesh.skeleton.boneMatrices!));
      expect(Math.max(...nearEnd.map((v,i) => Math.abs(v-first[i])))).toBeLessThan(0.015);
    }
    const editor = new Editor(createSite({name:'Save test',width:40,depth:40,resolution:129,preset:'flat'}));
    editor.execute({type:'insert',entities:[entity],assets:[asset]},'Place character');
    const saved = deserializeProject(serializeProject(editor.getSnapshot().project));
    expect(saved.entities[0]).toEqual(entity); expect(groundCharacterKind(saved.assets[0])).toBe(groundCharacterKind(asset));
    editor.undo(); expect(editor.getSnapshot().project.entities).toHaveLength(0);
    editor.redo(); expect(editor.getSnapshot().project.entities).toHaveLength(1);
    mixer.stopAllAction(); mixer.uncacheRoot(object);
    meshes.forEach(m => m.skeleton.dispose()); others.forEach(m => m.skeleton.dispose()); disposeModel(source);
  });
});
