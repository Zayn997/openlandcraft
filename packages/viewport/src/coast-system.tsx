import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Ocean, Project } from '@openlandcraft/core';
import { CoastHistory } from './coast';
import { beachAppearanceGLSL } from './coast-appearance';
import { terrainUniforms, updateTerrainUniforms } from './material-uniforms';
import { useRiverWater } from './river-system';
import {useLakeWater,lakeFieldGLSL,lakeUniforms,updateLakeUniforms} from './lake-system';

type CoastResources = { simulation: CoastHistory; field: THREE.DataTexture; history: THREE.DataTexture };
const CoastContext = createContext<CoastResources | null>(null);
export const useCoast = () => useContext(CoastContext);

export function CoastSystem({ site, ocean, playing, preview, transient, children }: { site: Project['site']; ocean?: Ocean; playing: boolean; preview: { reset: number; step: number }; transient: boolean; children: ReactNode }) {
  const resources = useMemo<CoastResources | null>(() => {
    if (!ocean) return null;
    const simulation = new CoastHistory(site, ocean), f = simulation.field;
    const field = new THREE.DataTexture(f.packed, f.columns, f.rows, THREE.RGBAFormat, THREE.FloatType); field.needsUpdate = true;
    const history = new THREE.DataTexture(simulation.pixels, f.columns, f.rows, THREE.RGBAFormat); history.minFilter = history.magFilter = THREE.LinearFilter; history.needsUpdate = true;
    return { simulation, field, history };
  }, [site.terrain, site.width, site.depth, ocean?.id, ocean?.visible, ocean?.level, ocean?.amplitude, ocean?.wavelength, ocean?.direction, ocean?.swash, preview.reset]);
  useEffect(() => () => { resources?.field.dispose(); resources?.history.dispose(); }, [resources]);
  useLayoutEffect(() => { if (transient && resources) { resources.simulation.clearHistory(); resources.history.needsUpdate = true; } }, [transient, resources]);
  const lastStep = useRef(preview.step);
  useEffect(() => {
    if (lastStep.current === preview.step) return;
    lastStep.current = preview.step;
    if (resources && !playing && ocean?.visible) { resources.simulation.ocean = ocean; resources.simulation.advance(0.25); resources.simulation.advance(0.25); resources.history.needsUpdate = true; }
  }, [preview.step, resources, playing, ocean?.visible]);
  useFrame((_, delta) => {
    if (!resources || !ocean) return; resources.simulation.ocean = ocean;
    if (!playing || !ocean.visible) return;
    if (transient) resources.simulation.advanceClock(delta);
    else if (resources.simulation.advance(delta)) resources.history.needsUpdate = true;
  }, -1);
  return <CoastContext.Provider value={resources}>{children}</CoastContext.Provider>;
}

export function CoastalTerrainMaterial({site}:{site:Project['site']}) {
  const coast = useCoast(),river=useRiverWater(),lake=useLakeWater();
  const empty = useMemo(() => { const texture = new THREE.DataTexture(new Uint8Array(4), 1, 1); texture.needsUpdate = true; return texture; }, []);
  // Main and offscreen shader variants must share the same live uniform objects.
  const uniforms = useMemo(() => ({ ...terrainUniforms(),...lakeUniforms(empty),uRiverMap:{value:empty},uRiverHistory:{value:empty},uRiverBounds:{value:new THREE.Vector2(1,1)},uRiverMapGrid:{value:new THREE.Vector2(1,1)},uRiverGrid:{value:new THREE.Vector2(1,1)},uWetBank:{value:0},uCoastHistory:{value:empty},uCoastBounds:{value:new THREE.Vector2(1,1)},uCoastSize:{value:new THREE.Vector2(1,1)},uWetSand:{value:0},uBeachLevel:{value:0},uBeachEnabled:{value:0} }),[empty]);
  const material = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    material.customProgramCacheKey = () => 'openlandcraft-lake-water-10';
    material.onBeforeCompile = (compiled) => {
      Object.assign(compiled.uniforms,uniforms);
      compiled.vertexShader = 'attribute float channel; varying float vChannel; varying vec3 vCoastNormal; varying vec3 vCoastWorld;\n' + compiled.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvCoastWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;vCoastNormal=normalize(mat3(modelMatrix)*normal);vChannel=channel;');
      compiled.fragmentShader = 'uniform sampler2D uRiverMap,uRiverHistory;uniform vec2 uRiverBounds,uRiverGrid,uRiverMapGrid;uniform float uWetBank;uniform sampler2D uCoastHistory; uniform vec2 uCoastBounds; uniform vec2 uCoastSize; uniform float uWetSand; uniform float uBeachLevel; uniform float uBeachEnabled; varying float vChannel; varying vec3 vCoastNormal; varying vec3 vCoastWorld;\n' + beachAppearanceGLSL + lakeFieldGLSL + compiled.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 coastUV = ((vCoastWorld.xz / uCoastBounds + 0.5) * (uCoastSize - 1.0) + 0.5) / uCoastSize;
          float coastWet = texture2D(uCoastHistory, coastUV).g * uWetSand;
          vec4 riverMap=vec4(0.0);float riverWet=0.0;
          if(uWetBank>0.0){
            vec2 rg=clamp((vCoastWorld.xz/uRiverBounds+0.5)*(uRiverMapGrid-1.0),vec2(0.0),uRiverMapGrid-1.0);
            ivec2 rc=ivec2(min(floor(rg),uRiverMapGrid-2.0));vec2 rf=rg-vec2(rc);
            riverMap=mix(mix(texelFetch(uRiverMap,rc,0),texelFetch(uRiverMap,rc+ivec2(1,0),0),rf.x),mix(texelFetch(uRiverMap,rc+ivec2(0,1),0),texelFetch(uRiverMap,rc+ivec2(1,1),0),rf.x),rf.y);
            riverMap.xyz/=max(0.0001,riverMap.a);
            if(riverMap.a>0.001){vec2 riverUV=(riverMap.xy*(uRiverGrid-1.0)+0.5)/uRiverGrid;riverWet=texture2D(uRiverHistory,riverUV).g*riverMap.a*uWetBank;}
          }
          float rockMask=rockCoverage(normalize(vCoastNormal));
          float sandMask = max(vChannel,(1.0 - smoothstep(uBeachLevel+0.65,uBeachLevel+3.2,vCoastWorld.y))*uBeachEnabled);
          float lakeWet=lakeWetAt(vCoastWorld.xz);sandMask=max(sandMask,max(riverWet,lakeWet));
          float polish=max(coastWet*sandMask*smoothstep(uBeachLevel-0.03,uBeachLevel+0.06,vCoastWorld.y),riverWet*smoothstep(riverMap.z-0.03,riverMap.z+0.06,vCoastWorld.y));
          coastWet=max(coastWet,max(riverWet,lakeWet));polish=max(polish,lakeWet*smoothstep(uLakeLevel-0.03,uLakeLevel+0.06,vCoastWorld.y));
          diffuseColor.rgb = terrainAlbedo(vCoastWorld.xz,sandMask,rockMask);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.59,0.63,0.63),coastWet*sandMask);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(uTerrainRoughness,0.20,polish*(1.0-rockMask));')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nvec2 sandSlope = beachSlope(vCoastWorld.xz) * sandMask * (1.0-coastWet*0.7);\nnormal = normalize(normal + mat3(viewMatrix) * vec3(-sandSlope.x,0.0,-sandSlope.y));');
    };
    return material;
  }, [uniforms]);
  useFrame(() => {
    const live = uniforms;
    updateTerrainUniforms(live,site.materials);updateLakeUniforms(live,lake);
    live.uRiverMap.value=river?.map??empty;live.uRiverHistory.value=river?.history??empty;
    live.uRiverMapGrid.value.set(river?.simulation.field.mapColumns??1,river?.simulation.field.mapRows??1);
    live.uRiverBounds.value.set(site.width,site.depth);live.uRiverGrid.value.set(river?.simulation.field.columns??1,river?.simulation.field.rows??1);live.uWetBank.value=river?.simulation.river.water.wetBank??0;
    const f = coast?.simulation.field;
    live.uCoastHistory.value = coast?.history ?? empty;
    live.uCoastBounds.value.set(f?.width ?? 1, f?.depth ?? 1); live.uCoastSize.value.set(f?.columns ?? 1, f?.rows ?? 1);
    live.uWetSand.value = coast?.simulation.ocean.visible ? coast.simulation.ocean.wetSand : 0;
    live.uBeachLevel.value = coast?.simulation.ocean.visible ? coast.simulation.ocean.level : 0;
    live.uBeachEnabled.value = coast?.simulation.ocean.visible ? 1 : 0;
  }, -0.5);
  useEffect(() => () => { material.dispose(); empty.dispose(); }, [material, empty]);
  return <primitive object={material} attach="material" />;
}
