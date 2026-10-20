import { useEffect, useLayoutEffect, useMemo } from 'react';
import type { Project } from '@openlandcraft/core';
import { terrainClosure, updateTerrainClosure } from './terrain-closure';

export function TerrainClosure({site}:{site:Project['site']}) {
  const geometry=useMemo(()=>terrainClosure(site),[site.width,site.depth,site.terrain.columns,site.terrain.rows]);
  useLayoutEffect(()=>updateTerrainClosure(geometry,site),[geometry,site.terrain]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} receiveShadow castShadow><meshStandardMaterial color="#9a947f" roughness={1}/></mesh>;
}
