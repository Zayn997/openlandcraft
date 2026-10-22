import * as THREE from 'three';
import type { Asset } from '@openlandcraft/core';

/** Provenance survives asset renaming and source-ID deduplication in saved projects. */
export function isLibraryVegetation(asset: Asset): boolean {
  return asset.attribution?.startsWith('Kenney Nature Kit · CC0-1.0 · https://kenney.nl/assets/nature-kit ·') ?? false;
}

export const plantWindGLSL = /* glsl */`
uniform float uPlantWindTime, uPlantWindEnabled, uPlantWindHeight, uPlantWindStrength, uPlantWindSpeed;
vec2 plantWindDirection() {
  vec2 direction = normalize(vec2(0.85, 0.53));
  #ifdef USE_INSTANCING
    // Undo the instance's yaw so all plants respond to the same world wind.
    direction = vec2(dot(normalize(instanceMatrix[0].xz), direction), dot(normalize(instanceMatrix[2].xz), direction));
  #endif
  return direction;
}
float plantWindWave() {
  vec2 origin = vec2(0.0);
  #ifdef USE_INSTANCING
    origin = instanceMatrix[3].xz;
  #endif
  float phase = dot(origin, vec2(0.37, 0.23));
  float time = uPlantWindTime * uPlantWindSpeed;
  float gust = 0.7 + 0.3 * sin(time * 0.31 + phase * 0.3);
  return (sin(time + phase) + 0.22 * sin(time * 2.17 + phase * 1.4)) * gust * uPlantWindEnabled;
}
`;

export function createPlantWind(source: THREE.Mesh) {
  source.geometry.computeBoundingBox();
  const height = Math.max(0.01, source.geometry.boundingBox!.max.y);
  const strength = height < 1 ? 0.16 : height < 2 ? 0.08 : 0.04;
  const uniforms = { uPlantWindTime: { value: 0 }, uPlantWindEnabled: { value: 0 },
    uPlantWindHeight: { value: height }, uPlantWindStrength: { value: strength }, uPlantWindSpeed: { value: height < 1 ? 1.8 : 0.85 } };
  const patch = <T extends THREE.Material>(material: T): T => {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + plantWindGLSL)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          float windH = clamp(position.y / uPlantWindHeight, 0.0, 1.0);
          vec2 windDerivative = plantWindDirection() * (2.0 * windH * uPlantWindStrength * plantWindWave());
          objectNormal.y -= dot(windDerivative, objectNormal.xz);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float windWeight = clamp(position.y / uPlantWindHeight, 0.0, 1.0);
          transformed.xz += plantWindDirection() * (windWeight * windWeight * uPlantWindHeight * uPlantWindStrength * plantWindWave());`);
    };
    material.customProgramCacheKey = () => 'openlandcraft-plant-wind-v1';
    return material;
  };
  const materials = (Array.isArray(source.material) ? source.material : [source.material]).map(m => patch(m.clone()));
  const depth = patch(new THREE.MeshDepthMaterial());
  const distance = patch(new THREE.MeshDistanceMaterial());
  return { uniforms, material: Array.isArray(source.material) ? materials : materials[0], depth, distance,
    maxDisplacement: height * strength * 1.22,
    dispose: () => { materials.forEach(m => m.dispose()); depth.dispose(); distance.dispose(); } };
}

export function advancePlantWind(time: number, delta: number, playing: boolean, enabled: boolean, reduced: boolean) {
  return { time: time + (playing && enabled && !reduced ? Math.min(Math.max(delta, 0), 0.1) : 0), strength: enabled && !reduced ? 1 : 0 };
}
