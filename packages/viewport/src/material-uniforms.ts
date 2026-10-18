import * as THREE from 'three';
import type { TerrainMaterials, WaterAppearance } from '@openlandcraft/core';

export const terrainUniforms=()=>({uSandColor:{value:new THREE.Color()},uGrassColor:{value:new THREE.Color()},uRockColor:{value:new THREE.Color()},uTerrainScale:{value:1},uTerrainRoughness:{value:0.95},uRockSlope:{value:48}});
export function updateTerrainUniforms(u:ReturnType<typeof terrainUniforms>,material:TerrainMaterials){
  u.uSandColor.value.set(material.sand);u.uGrassColor.value.set(material.grass);u.uRockColor.value.set(material.rock);
  u.uTerrainScale.value=material.scale;u.uTerrainRoughness.value=material.roughness;u.uRockSlope.value=material.rockSlope;
}
export const appearanceUniforms=()=>({uClarity:{value:1},uRoughness:{value:0.3},uRippleScale:{value:1}});
export function updateAppearanceUniforms(u:ReturnType<typeof appearanceUniforms>,appearance:WaterAppearance){
  u.uClarity.value=appearance.clarity;u.uRoughness.value=appearance.roughness;u.uRippleScale.value=appearance.rippleScale;
}
