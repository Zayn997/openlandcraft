import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderWaterFrame } from './water-render';

function fixture(autoUpdate = true, needsUpdate = false) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const water = new THREE.Object3D(), preview = new THREE.Object3D(), hidden = new THREE.Object3D(), plant = new THREE.Object3D();
  water.userData.waterSurface = true; preview.userData.waterCaptureExclude = true;
  hidden.userData.waterSurface = true; hidden.visible = false;
  scene.add(water, preview, hidden, plant);
  const destination = new THREE.WebGLRenderTarget(4, 4), capture = new THREE.WebGLRenderTarget(2, 2);
  let target = destination, cubeFace = 2, mipLevel = 1, shadowUpdates = 0;
  const passes: { target: THREE.WebGLRenderTarget; water: boolean; preview: boolean; shadowsReady: boolean; xr: boolean }[] = [];
  const renderer = {
    shadowMap: { autoUpdate, needsUpdate }, xr: { enabled: true }, clear: vi.fn(),
    getRenderTarget: () => target, getActiveCubeFace: () => cubeFace, getActiveMipmapLevel: () => mipLevel,
    setRenderTarget: vi.fn((next: THREE.WebGLRenderTarget, face = 0, mip = 0) => { target = next; cubeFace = face; mipLevel = mip; }),
    render: vi.fn(() => {
      if (renderer.shadowMap.autoUpdate || renderer.shadowMap.needsUpdate) { shadowUpdates++; renderer.shadowMap.needsUpdate = false; }
      passes.push({ target, water: water.visible, preview: preview.visible, shadowsReady: shadowUpdates > 0, xr: renderer.xr.enabled });
    }),
  };
  const run = (enabled = true) => renderWaterFrame(renderer as unknown as THREE.WebGLRenderer, scene, camera, enabled ? capture : null);
  return { renderer, run, water, preview, hidden, plant, passes, capture, destination, updates: () => shadowUpdates };
}

describe('water and main-view render ordering', () => {
  it('initializes shadows before the first capture and reuses them in the main view, every frame', () => {
    const f = fixture(); f.run(); f.run();
    expect(f.updates()).toBe(2);
    expect(f.passes).toEqual(Array.from({ length: 2 }, () => [
      { target: f.capture, water: false, preview: false, shadowsReady: true, xr: false },
      { target: f.destination, water: true, preview: true, shadowsReady: true, xr: true },
    ]).flat());
    expect(f.hidden.visible).toBe(false); expect(f.plant.visible).toBe(true);
    expect(f.renderer.shadowMap.autoUpdate).toBe(true);
    expect(f.renderer.getActiveCubeFace()).toBe(2); expect(f.renderer.getActiveMipmapLevel()).toBe(1);
  });
  it('honors manual shadow updates without regenerating shadows a second time', () => {
    const f = fixture(false, true); f.run(); f.run();
    expect(f.updates()).toBe(1);
    expect(f.passes.every(pass => pass.shadowsReady)).toBe(true);
    expect(f.renderer.shadowMap).toEqual({ autoUpdate: false, needsUpdate: false });
  });
  it.each([1, 2])('restores scene visibility, target, XR and shadow policy if pass %i fails', failedPass => {
    const f = fixture(); let calls = 0;
    f.renderer.render.mockImplementation(() => { if (++calls === failedPass) throw new Error('GPU failure'); });
    expect(() => f.run()).toThrow('GPU failure');
    expect(f.water.visible).toBe(true); expect(f.preview.visible).toBe(true); expect(f.hidden.visible).toBe(false);
    expect(f.renderer.getRenderTarget()).toBe(f.destination);
    expect(f.renderer.getActiveCubeFace()).toBe(2); expect(f.renderer.getActiveMipmapLevel()).toBe(1);
    expect(f.renderer.xr.enabled).toBe(true); expect(f.renderer.shadowMap.autoUpdate).toBe(true);
  });
  it('renders scenes without water once, using normal shadow updates', () => {
    const f = fixture(); f.run(false);
    expect(f.renderer.render).toHaveBeenCalledTimes(1); expect(f.updates()).toBe(1);
    expect(f.renderer.setRenderTarget).not.toHaveBeenCalled(); expect(f.renderer.clear).not.toHaveBeenCalled();
    expect(f.water.visible).toBe(true); expect(f.renderer.shadowMap.autoUpdate).toBe(true);
  });
});
