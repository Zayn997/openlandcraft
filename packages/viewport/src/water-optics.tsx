import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { coastalSkyGLSL } from './coast-appearance';
import { opticsSize } from './optics-budget';
import { renderWaterFrame } from './water-render';
import {finishFrameWork} from './frame-profile';

type Optics = { target: THREE.WebGLRenderTarget; sky: THREE.CubeTexture; inlandUnderwater:boolean };
const Context = createContext<Optics | null>(null);
export const useWaterOptics = () => useContext(Context);

/** One water-free scene capture for actual terrain/object transmission; no recursive renders. */
export function WaterOptics({ enabled, immersive, quality, children }: { enabled: boolean; immersive: boolean; quality: 'high' | 'low'; children: ReactNode }) {
  const { gl, scene, camera, size } = useThree();
  const resources = useMemo(() => {
    const type = gl.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const cube = new THREE.WebGLCubeRenderTarget(128, { type, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const target = new THREE.WebGLRenderTarget(1, 1, { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;
    return { target, sky: cube.texture, cube, inlandUnderwater:false };
  }, [gl]);
  useLayoutEffect(() => {
    // GPU work belongs to the committed lifecycle, including React StrictMode's replay.
    const skyScene = new THREE.Scene();
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `${coastalSkyGLSL}\nvarying vec3 vDirection; void main(){gl_FragColor=vec4(coastalSky(vDirection),1.0);}`,
    });
    const geometry = new THREE.SphereGeometry(5, 32, 16);
    skyScene.add(new THREE.Mesh(geometry, material));
    const cubeCamera = new THREE.CubeCamera(0.1, 10, resources.cube);
    cubeCamera.update(gl, skyScene);
    const generator = new THREE.PMREMGenerator(gl), environment = generator.fromCubemap(resources.sky);
    generator.dispose(); geometry.dispose(); material.dispose();
    const previous = scene.environment, intensity = scene.environmentIntensity;
    scene.environment = environment.texture; scene.environmentIntensity = 0.65;
    return () => {
      scene.environment = previous; scene.environmentIntensity = intensity;
      resources.target.dispose(); environment.dispose(); resources.cube.dispose();
    };
  }, [resources, scene, gl]);
  useLayoutEffect(() => {
    const previous = scene.background;
    if (immersive) scene.background = resources.sky;
    return () => { scene.background = previous; };
  }, [resources, scene, immersive]);
  useLayoutEffect(() => {
    resources.target.setSize(...opticsSize(size.width,size.height,gl.getPixelRatio(),quality));
  }, [resources, gl, size.width, size.height, quality]);
  // Inland volume callbacks set this after the reset and before the final render.
  useFrame(() => { resources.inlandUnderwater = false; }, -0.25);
  // Own the final render so shadows run once, before capture, after all camera,
  // simulation and plant-growth updates. Positive priority disables R3F's extra render.
  useFrame(() => { renderWaterFrame(gl, scene, camera, enabled ? resources.target : null);finishFrameWork(); }, 1);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}
