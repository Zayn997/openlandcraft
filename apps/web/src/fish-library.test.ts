/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createPlacedInstance, createSite, Editor, encodeGlb, inspectGlb, isFishAsset } from '@openlandcraft/core';
import { serializeProject, deserializeProject } from '@openlandcraft/project';
import { loadModel, disposeModel } from '../../../packages/viewport/src/models';
import { staticMeshes } from '../../../packages/viewport/src/instancing';
import { FISH_CREDIT } from './fish-library';
import { upgradeLibraryFish } from './fish-upgrade';

const bytes=readFileSync(new URL('../public/models/fish/reef-fish.glb',import.meta.url));
const asset={id:'reef-fish',name:'Reef fish',data:encodeGlb(bytes),attribution:FISH_CREDIT};
describe('CC0 fish asset', () => {
  it('ships an embedded rig and a looping swim clip with independently cloned skeletons', async () => {
    inspectGlb(bytes); expect(bytes.length).toBeLessThan(60_000);
    const source=await loadModel(asset), a=clone(source), b=clone(source);
    expect(source.userData.fishSwim).toBe(true);
    expect(staticMeshes(source)).toBeNull();
    const clip=source.animations.find(c=>c.name==='Swim')!;
    expect(clip.duration).toBeCloseTo(1.2);
    let meshA!:THREE.SkinnedMesh,meshB!:THREE.SkinnedMesh;
    a.traverse(o=>{if(o instanceof THREE.SkinnedMesh)meshA=o;});
    b.traverse(o=>{if(o instanceof THREE.SkinnedMesh)meshB=o;});
    expect(meshA.skeleton).not.toBe(meshB.skeleton);
    const mixer=new THREE.AnimationMixer(a);mixer.clipAction(clip).play();
    const sample=(time:number)=>{mixer.setTime(time);a.updateMatrixWorld(true);meshA.skeleton.update();return meshA.skeleton.boneMatrices!.slice();};
    const start=sample(0), up=sample(0.2), end=sample(clip.duration);
    expect(Array.from(up)).not.toEqual(Array.from(start));
    end.forEach((value,index)=>expect(value).toBeCloseTo(start[index],4));
    // React development mode replays effect cleanup/setup on the same clone.
    mixer.stopAllAction();mixer.uncacheRoot(a);mixer.clipAction(clip).play();
    expect(Array.from(sample(0.2))).toEqual(Array.from(up));
    const size=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
    expect(size.z).toBeCloseTo(0.8,1);
    // Verify the route's conservative body sphere encloses every deformed vertex.
    for (let t=0;t<clip.duration;t+=0.05) {
      sample(t);
      for (let i=0;i<meshA.geometry.attributes.position.count;i++) {
        const p=meshA.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(meshA.matrixWorld);
        p.y-=size.y/2;
        expect(p.length()).toBeLessThan(0.5);
      }
    }
    mixer.stopAllAction();mixer.uncacheRoot(a);meshA.skeleton.dispose();meshB.skeleton.dispose();disposeModel(source);
  });
  it('round-trips swimming metadata, supports undo/redo, and does not depend on editable credit or asset names', () => {
    const editor=new Editor(createSite({name:'Fish study',width:40,depth:40,resolution:129,preset:'flat'}));
    const entity=createPlacedInstance(editor.getSnapshot().project,asset,3,4,true,'fish-1');entity.position[1]=-1;entity.anchor='fixed';
    editor.execute({type:'insert',entities:[entity],assets:[asset]},'Add fish');
    const saved=deserializeProject(serializeProject(editor.getSnapshot().project));
    expect(isFishAsset({...saved.assets[0],name:'Renamed',attribution:''})).toBe(true);
    expect(saved.entities.find(e=>e.id===entity.id)).toEqual(entity);
    editor.undo();expect(editor.getSnapshot().project.assets).toHaveLength(0);
    editor.redo();expect(editor.getSnapshot().project.entities).toHaveLength(1);
    expect(isFishAsset({ ...asset, data: '', attribution:FISH_CREDIT })).toBe(false);
  });
});

const legacyBytes=readFileSync(new URL('./fixtures/reef-fish-v1.glb',import.meta.url));
afterEach(() => vi.unstubAllGlobals());
describe('bundled fish shape update', () => {
  it('updates exact legacy geometry while preserving placements, asset IDs, names and custom credits', async () => {
    const project=createSite({name:'Saved fish',width:40,depth:40,resolution:129,preset:'flat'});
    const legacy={...asset,id:'imported-identity',name:'My fish',data:encodeGlb(legacyBytes),attribution:'Personal source note'};
    project.assets=[legacy];project.entities=[createPlacedInstance(project,legacy,3,4,false,'existing-fish')];
    const fetcher=vi.fn(async () => new Response(bytes));vi.stubGlobal('fetch',fetcher);
    const next=await upgradeLibraryFish(project);
    expect(next.assets[0]).toEqual({...legacy,data:asset.data});
    expect(next.entities).toBe(project.entities);expect(project.assets[0].data).toBe(legacy.data);
    expect(await upgradeLibraryFish(next)).toBe(next);expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves customized meshes with the same ID and keeps portable projects usable offline', async () => {
    const project=createSite({name:'Custom fish',width:40,depth:40,resolution:129,preset:'flat'});
    const modified=Uint8Array.from(legacyBytes);modified[modified.length-1]^=1;
    project.assets=[{...asset,data:encodeGlb(modified)}];
    const fetcher=vi.fn(async () => {throw new Error('Offline');});vi.stubGlobal('fetch',fetcher);
    expect(await upgradeLibraryFish(project)).toBe(project);expect(fetcher).not.toHaveBeenCalled();
    project.assets=[{...asset,data:encodeGlb(legacyBytes)}];
    expect(await upgradeLibraryFish(project)).toBe(project);expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
