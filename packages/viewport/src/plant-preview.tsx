import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { createSwimRoute, fishHabitat, groundHeight, isBirdAsset, isFishAsset, type Asset, type Project } from '@openlandcraft/core';
import { disposeModel, loadModel } from './models';

/** A borrowed placement preview; never enters the saved scene or selection tree. */
export function PlantPreview({ asset, position }: { asset: Asset; position: [number, number, number] | null }) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true, owned: THREE.Group | undefined;
    loadModel(asset).then(root => {
      if (!alive) { disposeModel(root); return; }
      owned = root;
      if (isFishAsset(asset)) root.position.y -= new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y / 2;
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.raycast = () => undefined;
        object.castShadow = false;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.transparent = true; material.opacity = 0.5; material.depthWrite = false;
        }
      });
      setModel(root);
    }).catch(() => { /* The library loader reports asset errors before enabling placement. */ });
    return () => { alive = false; if (owned) disposeModel(owned); };
  }, [asset.data]);
  return model && position ? <group position={position} userData={{ waterCaptureExclude: !isFishAsset(asset) }}><primitive object={model} dispose={null} /></group> : null;
}

/** Placement origin is ground for plants, sky for birds, and safe water depth for fish. */
export function LibraryPlacementPreview({asset, cursor, project}: {asset:Asset; cursor:[number,number] | null; project:Project}) {
  const habitat = useMemo(() => isFishAsset(asset) ? fishHabitat(project) : null,[asset,project]);
  const position = useMemo<[number,number,number] | null>(() => {
    if (!cursor) return null;
    if (habitat) {
      const route = createSwimRoute(habitat,[cursor[0],100,cursor[1]]);
      return route ? [cursor[0],route.y,cursor[1]] : null;
    }
    return [cursor[0],groundHeight(cursor[0],cursor[1],project.site)+(isBirdAsset(asset)?10:0),cursor[1]];
  },[cursor,habitat,asset,project]);
  return <PlantPreview asset={asset} position={position}/>;
}
