import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Ocean, Project } from '@openlandcraft/core';
import { createOceanGround, oceanGroundGLSL, oceanSegments, oceanWaveGLSL } from './ocean-surface';
import { useCoast } from './coast-system';
import {useLakeWater,lakeFieldGLSL,lakeUniforms,updateLakeUniforms} from './lake-system';
import { useWaterOptics } from './water-optics';
import { oceanHorizonGeometry } from './ocean-horizon';
import { beachAppearanceGLSL } from './coast-appearance';
import { waterMaterialGLSL } from './water-material';
import { terrainUniforms, updateTerrainUniforms, appearanceUniforms, updateAppearanceUniforms } from './material-uniforms';
import { oceanBoundary, oceanBoundaryVertex, oceanBoundaryFragment, underwaterVertex, underwaterFragment } from './ocean-volume';

const vertexShader = /* glsl */`
  ${oceanGroundGLSL}
  ${oceanWaveGLSL}
  varying vec3 vWorld;
  varying vec4 vWave;
  void main() {
    vec3 p = position;
    float ground=groundAt(p.xz);vec4 coast=coastAt(p.xz),wave=waveAt(p.xz,coast,ground);
    vec2 slope=coast.yz*wave.y+vec2(-uDirection.y,uDirection.x)*wave.z;
    vWave=vec4(uLevel+wave.x,slope,wave.w);
    p.y = max(vWave.x, ground + 0.012);
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;
const fragmentShader = /* glsl */`
  ${oceanGroundGLSL}
  ${oceanWaveGLSL}
  ${lakeFieldGLSL}
  uniform vec3 uColor;
  uniform float uSelected;
  uniform float uFoam;
  ${waterMaterialGLSL}
  ${beachAppearanceGLSL}
  varying vec3 vWorld;
  varying vec4 vWave;
  void main() {
    vec2 lakePoint=(vWorld.xz-uLakeBounds.xy)/uLakeBounds.zw;
    if(uLakeEnabled>0.5&&all(greaterThanEqual(lakePoint,vec2(0.0)))&&all(lessThanEqual(lakePoint,vec2(1.0)))&&lakeDistanceAt(vWorld.xz)>-0.8)discard;
    float ground = groundAt(vWorld.xz);
    vec4 coast = coastAt(vWorld.xz), history = historyAt(vWorld.xz);
    float height = vWave.x;
    float thickness = height - ground;
    float wetFilm = smoothstep(0.008, 0.045, thickness);
    if (wetFilm < 0.001 && history.r < 0.015) discard;
    float depth = max(0.0, thickness);
    vec2 slope = vWave.yz;
    float distanceToEye = length(cameraPosition - vWorld);
    slope *= 1.0-smoothstep(150.0,700.0,distanceToEye);
    float detail = (1.0 - smoothstep(75.0,350.0,distanceToEye)) * smoothstep(0.01,0.18,depth);
    float wind = min(1.0,uAmplitude*4.0);
    vec2 q = vWorld.xz;
    float footprint=max(length(dFdx(q)),length(dFdy(q)));
    float time=uPhase/sqrt(9.81*uWaveNumber);
    vec2 micro=windSlope(q/uRippleScale,time,footprint/uRippleScale)*(0.5+uRoughness/0.6);
    vec3 normal = normalize(vec3(-slope.x-micro.x*detail*wind, 1.0, -slope.y-micro.y*detail*wind));
    vec3 eye = normalize(cameraPosition - vWorld);
    vec3 color;
    if(gl_FrontFacing)color=waterRadiance(vWorld,normal,depth,uColor,uClarity,uRoughness);
    else{
      // Water-to-air refraction and total internal reflection on the same waves.
      vec3 transmitted=refract(-eye,-normal,1.333);
      float fresnel=0.0204+0.9796*pow(1.0-max(0.0,dot(-normal,eye)),5.0);
      if(dot(transmitted,transmitted)<0.001)fresnel=1.0;
      vec3 reflected=reflect(-eye,-normal);
      float bedPath=min(40.0,depth/max(0.12,-reflected.y));
      vec2 bedPoint=vWorld.xz+reflected.xz*bedPath;
      vec3 bedColor=terrainAlbedo(bedPoint,1.0,0.0)*0.85;
      vec3 absorption=exp(-vec3(0.65,0.18,0.12)*bedPath/max(0.1,uClarity));
      vec3 reflectedColor=mix(uColor*0.18,bedColor,absorption);
      color=mix(textureCube(uSky,transmitted,0.5).rgb,reflectedColor,fresnel);
    }
    vec2 drift=normalize(coast.yz+uDirection*0.001)*time*0.22;
    vec2 foamPoint=q-drift;
    foamPoint+=vec2(coastNoise(foamPoint*0.51),coastNoise(foamPoint*0.57+8.3))*0.65;
    float grain=coastNoise(foamPoint*26.0),patchNoise=coastNoise(foamPoint*9.4);
    float ridge=1.0-abs(patchNoise*2.0-1.0),aa=max(0.025,fwidth(ridge));
    float lace=smoothstep(0.79-aa,0.95+aa,ridge)*(0.65+grain*0.35);
    float remnant=clamp(history.r*2.6,0.0,0.8)*mix(lace,smoothstep(0.38,0.72,patchNoise),0.12);
    float lip=clamp(vWave.w,0.0,1.0)*uFoam*smoothstep(0.32,0.68,coastNoise(foamPoint*1.8))*(0.65+0.35*grain)*0.65;
    float foam=1.0-(1.0-remnant)*(1.0-lip);
    vec3 foamColor=vec3(0.71,0.77,0.72)*(0.88+0.12*grain);
    color = mix(color,foamColor,foam);
    if(gl_FrontFacing)color = mix(color,textureCube(uSky,normalize(vec3(eye.x,0.01,eye.z)),3.0).rgb,smoothstep(250.0,1100.0,distanceToEye)*0.65);
    color = mix(color,vec3(0.80,0.89,0.62),uSelected*0.025);
    float alpha = wetFilm;
    if (wetFilm < 0.001) { color = foamColor; alpha = foam * 0.7; }
    gl_FragColor = vec4(color, max(alpha, foam * 0.8));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const horizonGroundVertex = /* glsl */`
  ${oceanGroundGLSL}
  varying vec3 vWorld;
  void main(){vec3 p=position; p.y=groundAt(p.xz);vWorld=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}
`;
const horizonGroundFragment = /* glsl */`
  ${oceanGroundGLSL}
  ${beachAppearanceGLSL}
  uniform samplerCube uSky;
  varying vec3 vWorld;
  void main(){
    vec2 p=vWorld.xz;
    vec3 n=normalize(vec3(groundAt(p-vec2(0.25,0))-groundAt(p+vec2(0.25,0)),0.5,groundAt(p-vec2(0,0.25))-groundAt(p+vec2(0,0.25))));
    vec3 color=terrainAlbedo(p,1.0-smoothstep(uLevel+0.65,uLevel+3.2,vWorld.y),rockCoverage(n));
    color *= 0.6 + max(0.0,dot(n,normalize(vec3(-0.4,0.70,0.45))))*0.85;
    vec3 eye=normalize(vWorld-cameraPosition);
    color=mix(color,textureCube(uSky,normalize(vec3(eye.x,0.01,eye.z)),3.0).rgb,smoothstep(90.0,900.0,length(vWorld-cameraPosition)));
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function OceanSurface({ ocean, site, selected, quality, horizon = false, cutaway = true }: { ocean: Ocean; site: Project['site']; selected: boolean; quality: 'low' | 'high'; horizon?: boolean; cutaway?: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null), groundMaterial = useRef<THREE.ShaderMaterial>(null), coast = useCoast(), lake=useLakeWater(), optics = useWaterOptics();
  const boundaryMaterial=useRef<THREE.ShaderMaterial>(null),underwaterMaterial=useRef<THREE.ShaderMaterial>(null);
  const ground = useMemo(() => createOceanGround(site.terrain), [site.terrain.columns, site.terrain.rows]);
  useLayoutEffect(() => { (ground.image.data as Float32Array).set(site.terrain.heights); ground.needsUpdate = true; }, [ground, site.terrain]);
  useEffect(() => () => ground.dispose(), [ground]);
  const waveSegments = oceanSegments(site.width, site.depth, ocean.wavelength, quality);
  const columns = Math.max(waveSegments[0], Math.min(quality === 'high' ? 256 : 128, site.terrain.columns - 1)), rows = Math.max(waveSegments[1], Math.min(quality === 'high' ? 256 : 128, site.terrain.rows - 1));
  const geometry = useMemo(() => {
    if (horizon) return oceanHorizonGeometry(site.width,site.depth);
    const geometry = new THREE.PlaneGeometry(site.width, site.depth, columns, rows);
    geometry.rotateX(-Math.PI / 2);
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-site.width / 2, -9, -site.depth / 2), new THREE.Vector3(site.width / 2, 35.1, site.depth / 2));
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    return geometry;
  }, [site.width, site.depth, columns, rows, horizon]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const boundary=useMemo(()=>oceanBoundary(site.width,site.depth,columns,rows),[site.width,site.depth,columns,rows]);
  useEffect(()=>()=>boundary.dispose(),[boundary]);
  const uniforms = useMemo(() => ({
    ...terrainUniforms(),...appearanceUniforms(),...lakeUniforms(ground),
    uPhase: { value: 0 }, uAmplitude: { value: ocean.amplitude },
    uDirection: { value: new THREE.Vector2() }, uLevel: { value: ocean.level },
    uColor: { value: new THREE.Color(ocean.color) }, uSelected: { value: 0 },uFoam:{value:ocean.foam},
    uGround: { value: ground }, uGrid: { value: new THREE.Vector2() }, uSite: { value: new THREE.Vector2() },
    uCoastField: { value: ground }, uCoastHistory: { value: ground }, uCoastGrid: { value: new THREE.Vector2() }, uSwash: { value: ocean.swash }, uBreaker: { value: ocean.breaker },
    uSceneColor: { value: ground }, uSceneDepth: { value: ground }, uSky: { value: null }, uResolution: { value: new THREE.Vector2() }, uNearFar: { value: new THREE.Vector2(0.1,1500) },
    uWaveNumber: { value: Math.PI*2/ocean.wavelength },
    uCameraWorld:{value:new THREE.Matrix4()},uProjectionInverse:{value:new THREE.Matrix4()},uInlandUnderwater:{value:0},
  }), []);
  useFrame(({ gl, camera }) => {
    // R3F may reconcile a new uniforms object. Update the live material after reconciliation.
    if (!coast || !optics) return;
    for (const target of [material.current,groundMaterial.current,boundaryMaterial.current,underwaterMaterial.current]) {
    const live = target?.uniforms; if (!live) continue;
    updateLakeUniforms(live as ReturnType<typeof lakeUniforms>,lake);updateTerrainUniforms(live as ReturnType<typeof terrainUniforms>,site.materials);updateAppearanceUniforms(live as ReturnType<typeof appearanceUniforms>,ocean.appearance);
    live.uSceneColor.value = optics.target.texture; live.uSceneDepth.value = optics.target.depthTexture; live.uSky.value = optics.sky;
    gl.getDrawingBufferSize(live.uResolution.value); live.uNearFar.value.set(camera.near,camera.far);
    live.uCameraWorld.value.copy(camera.matrixWorld);live.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    live.uPhase.value = coast.simulation.clock; live.uGround.value = ground;live.uFoam.value=ocean.foam;
    live.uCoastField.value = coast.field; live.uCoastHistory.value = coast.history; live.uCoastGrid.value.set(coast.simulation.field.columns, coast.simulation.field.rows);
    live.uSwash.value = ocean.swash; live.uBreaker.value = ocean.breaker;
    live.uWaveNumber.value = Math.PI*2/ocean.wavelength;
    live.uGrid.value.set(site.terrain.columns, site.terrain.rows); live.uSite.value.set(site.width, site.depth);
    const angle = THREE.MathUtils.degToRad(ocean.direction); live.uDirection.value.set(Math.cos(angle), Math.sin(angle));
    live.uAmplitude.value = ocean.amplitude; live.uLevel.value = ocean.level;
    live.uColor.value.set(ocean.color); live.uSelected.value = selected ? 1 : 0;
    }
  }, -0.5);
  if (!ocean.visible || !coast || !optics) return null;
  return <>
  {horizon && <mesh geometry={geometry} raycast={() => undefined} frustumCulled={false}>
    <shaderMaterial key={horizonGroundVertex+horizonGroundFragment} ref={groundMaterial} vertexShader={horizonGroundVertex} fragmentShader={horizonGroundFragment} uniforms={uniforms} side={THREE.DoubleSide} />
  </mesh>}
  <mesh geometry={geometry} raycast={() => undefined} userData={{ waterSurface: true }} renderOrder={horizon ? 0 : 1} frustumCulled={!horizon}>
    <shaderMaterial key={vertexShader+fragmentShader} ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} side={THREE.DoubleSide} transparent depthWrite forceSinglePass />
  </mesh>
  {!horizon&&<>
    {cutaway&&<mesh geometry={boundary} raycast={()=>undefined} userData={{waterSurface:true}} renderOrder={2} frustumCulled={false}>
      <shaderMaterial ref={boundaryMaterial} vertexShader={oceanGroundGLSL+oceanWaveGLSL+oceanBoundaryVertex} fragmentShader={oceanGroundGLSL+oceanWaveGLSL+lakeFieldGLSL+waterMaterialGLSL+'\nuniform vec3 uColor;\n'+oceanBoundaryFragment} uniforms={uniforms} side={THREE.DoubleSide} transparent depthWrite forceSinglePass/>
    </mesh>}
    <mesh raycast={()=>undefined} frustumCulled={false} renderOrder={10000} userData={{waterCaptureExclude:true}} onBeforeRender={(_renderer,_scene,camera)=>{const live=underwaterMaterial.current?.uniforms;if(live){live.uInlandUnderwater.value=Number(optics.inlandUnderwater);live.uCameraWorld.value.copy(camera.matrixWorld);live.uProjectionInverse.value.copy(camera.projectionMatrixInverse);}}}>
      <planeGeometry args={[2,2]}/>
      <shaderMaterial ref={underwaterMaterial} vertexShader={oceanGroundGLSL+oceanWaveGLSL+lakeFieldGLSL+underwaterVertex} fragmentShader={oceanGroundGLSL+oceanWaveGLSL+waterMaterialGLSL+'\nuniform vec3 uColor;\n'+underwaterFragment} uniforms={uniforms} transparent depthTest={false} depthWrite={false}/>
    </mesh>
  </>}
  </>;
}
