import type { Camera, Object3D, Scene, WebGLRenderer, WebGLRenderTarget } from 'three';
import {startWork,endWork} from './frame-profile';

/** Render shadows before the refraction capture, then reuse them in the main view.
 * Deferring the first shadow pass until after capture corrupts the captured plant
 * geometry on cold loads. Both color passes must see initialized shadow resources.
 */
export function renderWaterFrame(renderer: WebGLRenderer, scene: Scene, camera: Camera, capture: WebGLRenderTarget | null) {
  if (!capture) { const start=startWork();renderer.render(scene, camera);endWork('main-render',start);return; }
  const previous = renderer.getRenderTarget();
  const cubeFace = renderer.getActiveCubeFace(), mipLevel = renderer.getActiveMipmapLevel();
  const autoUpdate = renderer.shadowMap.autoUpdate, xr = renderer.xr.enabled;
  const hidden: Object3D[] = [];
  scene.traverse(object => {
    if (object.visible && (object.userData.waterSurface || object.userData.waterCaptureExclude)) {
      hidden.push(object); object.visible = false;
    }
  });
  try {
    renderer.xr.enabled = false;
    renderer.setRenderTarget(capture);
    renderer.clear();
    // Keep the caller's shadow update policy for the first pass, including a
    // manually requested update. Three clears needsUpdate once it is consumed.
    const captureStart=startWork();
    renderer.render(scene, camera);
    endWork('water-capture-and-shadows',captureStart);
    hidden.forEach(object => { object.visible = true; });
    renderer.setRenderTarget(previous, cubeFace, mipLevel);
    renderer.xr.enabled = xr;
    renderer.shadowMap.autoUpdate = false;
    const mainStart=startWork();
    renderer.render(scene, camera);
    endWork('main-render',mainStart);
  } finally {
    hidden.forEach(object => { object.visible = true; });
    renderer.setRenderTarget(previous, cubeFace, mipLevel);
    renderer.shadowMap.autoUpdate = autoUpdate;
    renderer.xr.enabled = xr;
  }
}
