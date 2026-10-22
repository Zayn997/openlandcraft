import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { advancePlantWind, createPlantWind, isLibraryVegetation } from './plant-wind';

describe('vegetation wind', () => {
  it('freezes on pause, returns to rest when disabled, and respects reduced motion', () => {
    expect(advancePlantWind(4, 0.02, true, true, false)).toEqual({ time: 4.02, strength: 1 });
    expect(advancePlantWind(4, 0.02, false, true, false)).toEqual({ time: 4, strength: 1 });
    expect(advancePlantWind(4, 0.02, true, false, false)).toEqual({ time: 4, strength: 0 });
    expect(advancePlantWind(4, 0.02, true, true, true)).toEqual({ time: 4, strength: 0 });
    expect(advancePlantWind(4, 30, true, true, false).time).toBe(4.1);
  });
  it('uses the same deformation and clock for visible, depth and distance passes without mutating source materials', () => {
    const geometry = new THREE.BoxGeometry(1, 5, 1).translate(0, 2.5, 0), material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, material), wind = createPlantWind(mesh);
    const passes = [[wind.material, THREE.ShaderLib.standard], [wind.depth, THREE.ShaderLib.depth], [wind.distance, THREE.ShaderLib.distance]] as const;
    for (const [pass, template] of passes) {
      const shader = { uniforms: { ...template.uniforms }, vertexShader: template.vertexShader, fragmentShader: template.fragmentShader };
      (pass as THREE.Material).onBeforeCompile(shader as Parameters<THREE.Material['onBeforeCompile']>[0], {} as THREE.WebGLRenderer);
      expect(shader.uniforms.uPlantWindTime).toBe(wind.uniforms.uPlantWindTime);
      expect(shader.vertexShader).toContain('transformed.xz += plantWindDirection()');
      expect(shader.vertexShader).toContain('windWeight * windWeight');
    }
    expect(wind.material).not.toBe(material);
    expect(wind.uniforms.uPlantWindHeight.value).toBe(5);
    expect(wind.maxDisplacement).toBeCloseTo(0.244);
    wind.dispose(); geometry.dispose(); material.dispose();
  });
  it('limits automatic wind to the curated plant provenance, including renamed assets', () => {
    const base = { id: 'renamed-source', name: 'My custom label', data: '', attribution: '' };
    expect(isLibraryVegetation({ ...base, attribution: 'Kenney Nature Kit · CC0-1.0 · https://kenney.nl/assets/nature-kit · Optimized and recolored in Blender for OpenLandcraft.' })).toBe(true);
    expect(isLibraryVegetation({ ...base, name: 'Pine' })).toBe(false);
  });
});
