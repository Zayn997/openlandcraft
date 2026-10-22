/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createPlacedInstance, createSite, Editor, encodeGlb, inspectGlb, isBirdAsset } from '@openlandcraft/core';
import { serializeProject, deserializeProject } from '@openlandcraft/project';
import { loadModel, disposeModel } from '../../../packages/viewport/src/models';
import { staticMeshes } from '../../../packages/viewport/src/instancing';
import { BIRD_CREDIT } from './bird-library';

const bytes=readFileSync(new URL('../public/models/birds/songbird.glb',import.meta.url));
const asset={id:'songbird',name:'Songbird',data:encodeGlb(bytes),attribution:BIRD_CREDIT};
describe('CC0 bird asset', () => {
  it('ships an embedded rig and a looping wing clip with independently cloned skeletons', async () => {
    inspectGlb(bytes); expect(bytes.length).toBeLessThan(300_000);
    const source=await loadModel(asset), a=clone(source), b=clone(source);
    expect(source.userData.birdFlight).toBe(true);
    expect(staticMeshes(source)).toBeNull();
    const clip=source.animations.find(c=>c.name==='Flight')!;
    expect(clip.duration).toBeCloseTo(0.8);
    let meshA!:THREE.SkinnedMesh,meshB!:THREE.SkinnedMesh;
    a.traverse(o=>{if(o instanceof THREE.SkinnedMesh)meshA=o;});
    b.traverse(o=>{if(o instanceof THREE.SkinnedMesh)meshB=o;});
    expect(meshA.skeleton).not.toBe(meshB.skeleton);
    const mixer=new THREE.AnimationMixer(a);mixer.clipAction(clip).play();
    const sample=(time:number)=>{mixer.setTime(time);a.updateMatrixWorld(true);meshA.skeleton.update();return meshA.skeleton.boneMatrices!.slice();};
    sample(0.2); expect(a.getObjectByName('Bone002')!.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(a.getObjectByName('Bone006')!.getWorldPosition(new THREE.Vector3()).y,2);
    const start=sample(0), up=sample(0.2), end=sample(clip.duration);
    expect(Array.from(up)).not.toEqual(Array.from(start));
    end.forEach((value,index)=>expect(value).toBeCloseTo(start[index],4));
    // React development mode replays effect cleanup/setup on the same clone.
    mixer.stopAllAction();mixer.uncacheRoot(a);mixer.clipAction(clip).play();
    expect(Array.from(sample(0.2))).toEqual(Array.from(up));
    expect(new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3()).x).toBeGreaterThan(1);
    mixer.stopAllAction();mixer.uncacheRoot(a);meshA.skeleton.dispose();meshB.skeleton.dispose();disposeModel(source);
  });
  it('round-trips flight metadata, supports undo/redo, and does not depend on editable credit or asset names', () => {
    const editor=new Editor(createSite({name:'Bird study',width:40,depth:40,resolution:129,preset:'flat'}));
    const entity=createPlacedInstance(editor.getSnapshot().project,asset,3,4,true,'bird-1');entity.position[1]=10;
    editor.execute({type:'insert',entities:[entity],assets:[asset]},'Add bird');
    const saved=deserializeProject(serializeProject(editor.getSnapshot().project));
    expect(isBirdAsset({...saved.assets[0],name:'Renamed',attribution:''})).toBe(true);
    expect(saved.entities.find(e=>e.id===entity.id)).toEqual(entity);
    editor.undo();expect(editor.getSnapshot().project.assets).toHaveLength(0);
    editor.redo();expect(editor.getSnapshot().project.entities).toHaveLength(1);
    expect(isBirdAsset({ ...asset, data: '', attribution:BIRD_CREDIT })).toBe(false);
  });
});
