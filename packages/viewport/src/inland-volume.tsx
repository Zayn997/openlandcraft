import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {waterBoundary,updateWaterBoundary} from './inland-geometry';
import {useWaterOptics} from './water-optics';
import {oceanGroundGLSL} from './ocean-surface';
import {waterMaterialGLSL} from './water-material';
import {TERRAIN_BASE} from './terrain-closure';

export const inlandUndersideGLSL=/* glsl */`
  vec3 inlandUnderside(vec3 world,vec3 normal,float depth,vec3 tint,float clarity){
    vec3 eye=normalize(cameraPosition-world),ray=refract(-eye,-normal,1.333);
    float fresnel=0.0204+0.9796*pow(1.0-max(0.0,dot(-normal,eye)),5.0);
    if(dot(ray,ray)<0.001)fresnel=1.0;
    vec3 reflected=reflect(-eye,-normal);
    float path=min(30.0,depth/max(0.12,-reflected.y));
    vec3 transmission=exp(-vec3(0.65,0.18,0.12)*path/max(0.1,clarity));
    vec3 bed=mix(tint*0.18,vec3(0.32,0.34,0.24),transmission);
    return mix(textureCube(uSky,ray,0.5).rgb,bed,fresnel);
  }
`;
const fogVertex='void main(){gl_Position=vec4(position.xy,0.0,1.0);}';
const fogFragment=/* glsl */`
  #include <packing>
  uniform sampler2D uExitDepth,uSceneDepth;
  uniform vec2 uResolution,uNearFar;
  uniform mat4 uProjectionInverse;
  uniform vec3 uColor;
  uniform float uClarity,uSubmerged;
  void main(){
    vec2 uv=gl_FragCoord.xy/uResolution;
    float depth=min(texture2D(uExitDepth,uv).r,texture2D(uSceneDepth,uv).r);
    float distance=-perspectiveDepthToViewZ(depth,uNearFar.x,uNearFar.y);
    vec4 p=uProjectionInverse*vec4(uv*2.0-1.0,1.0,1.0);
    vec3 ray=normalize(p.xyz/p.w);
    float path=min(45.0,distance/max(0.001,-ray.z));
    vec3 scatter=mix(vec3(0.008,0.10,0.085),uColor*0.32,0.40);
    gl_FragColor=vec4(scatter,(1.0-exp(-path*0.12/max(0.1,uClarity)))*uSubmerged);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A depth-only capture of this water body's animated shell gives the first ray exit.
 * The shared terrain/object capture supplies the bed. Neither capture includes fog. */
export function InlandVolume({geometry,vertex,discard,uniforms,revision,sample,liveUniforms}:{
  geometry:THREE.BufferGeometry;vertex:string;discard:string;uniforms:Record<string,THREE.IUniform>;revision:unknown;
  sample:(position:THREE.Vector3)=>{surface:number;ground:number}|null;
  liveUniforms:()=>Record<string,THREE.IUniform>;
}){
  const optics=useWaterOptics(),overlay=useRef<THREE.Mesh>(null),wallMaterial=useRef<THREE.ShaderMaterial>(null),fogMaterial=useRef<THREE.ShaderMaterial>(null);
  const boundary=useMemo(()=>waterBoundary(geometry),[geometry]);
  const profileVersion=useRef(-1);
  useLayoutEffect(()=>updateWaterBoundary(boundary,geometry),[boundary,geometry,revision]);
  const volumeVertex=useMemo(()=>`attribute float volumeBottom;varying float vVolumeSurface;\n${vertex}`.replace('vWorld=p;','vVolumeSurface=p.y;p.y=mix(p.y,'+TERRAIN_BASE.toFixed(1)+',volumeBottom);vWorld=p;'),[vertex]);
  const clip=`varying vec3 vWorld;varying float vVolumeSurface;\n${discard}\n`;
  const resources=useMemo(()=>{
    // Attributes stay shared with the editable river's phase/profile updates.
    const top=new THREE.BufferGeometry();top.index=geometry.index;
    for(const [name,attribute] of Object.entries(geometry.attributes))top.setAttribute(name,attribute);
    top.setAttribute('volumeBottom',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count),1));
    const exit=new THREE.ShaderMaterial({vertexShader:volumeVertex,fragmentShader:oceanGroundGLSL+clip+'void main(){clipVolume();gl_FragColor=vec4(1.0);}',uniforms,side:THREE.DoubleSide});
    const scene=new THREE.Scene();for(const shape of [top,boundary]){const mesh=new THREE.Mesh(shape,exit);mesh.frustumCulled=false;scene.add(mesh);}
    const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    target.depthTexture.minFilter=target.depthTexture.magFilter=THREE.NearestFilter;
    return {top,exit,scene,target};
  },[geometry,boundary,volumeVertex,discard,uniforms]);
  useEffect(()=>()=>{resources.top.dispose();resources.exit.dispose();resources.target.dispose();boundary.dispose();},[resources,boundary]);
  const fog=useMemo(()=>({...uniforms,uExitDepth:{value:resources.target.depthTexture},uProjectionInverse:{value:new THREE.Matrix4()},uSubmerged:{value:0}}),[uniforms,resources]);
  const wallFragment=oceanGroundGLSL+waterMaterialGLSL+'\nuniform vec3 uColor;\n'+clip+/* glsl */`
    void main(){
      clipVolume();
      vec2 uv=gl_FragCoord.xy/uResolution;
      float nearDistance=-(viewMatrix*vec4(vWorld,1.0)).z;
      float farDistance=-perspectiveDepthToViewZ(texture2D(uSceneDepth,uv).r,uNearFar.x,uNearFar.y);
      float path=min(20.0,max(0.0,farDistance-nearDistance));
      vec3 transmission=exp(-vec3(0.65,0.18,0.12)*path/max(0.1,uClarity));
      vec3 scatter=mix(vec3(0.008,0.10,0.085),uColor*0.32,0.40);
      gl_FragColor=vec4(texture2D(uSceneColor,uv).rgb*transmission+scatter*(1.0-transmission),1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;
  useFrame(({gl,camera})=>{
    if(!overlay.current||!optics)return;
    const profile=geometry.getAttribute('riverProfile') as THREE.BufferAttribute|undefined;
    if(profile&&profile.version!==profileVersion.current){updateWaterBoundary(boundary,geometry);profileVersion.current=profile.version;}
    const live=liveUniforms();resources.exit.uniforms=live;
    if(wallMaterial.current)wallMaterial.current.uniforms=live;
    const activeFog=fogMaterial.current?.uniforms;
    if(activeFog)for(const key of Object.keys(live))activeFog[key]=live[key];
    const water=sample(camera.position),submerged=water&&camera.position.y>=water.ground&&water.surface-water.ground>0.02?THREE.MathUtils.smoothstep(water.surface-camera.position.y,-0.08,0.08):0;
    overlay.current.visible=submerged>0;
    if(!submerged)return;
    optics.inlandUnderwater=true;
    if(activeFog){activeFog.uSubmerged.value=submerged;activeFog.uProjectionInverse.value.copy(camera.projectionMatrixInverse);}
    if(resources.target.width!==optics.target.width||resources.target.height!==optics.target.height)resources.target.setSize(optics.target.width,optics.target.height);
    const previous=gl.getRenderTarget(),xr=gl.xr.enabled;
    try{gl.xr.enabled=false;gl.setRenderTarget(resources.target);gl.clear();gl.render(resources.scene,camera);}
    finally{gl.setRenderTarget(previous);gl.xr.enabled=xr;}
  },-0.1);
  return <>
    <mesh geometry={boundary} frustumCulled={false} raycast={()=>undefined} userData={{waterSurface:true}} renderOrder={3}>
      <shaderMaterial ref={wallMaterial} vertexShader={volumeVertex} fragmentShader={wallFragment} uniforms={uniforms} side={THREE.DoubleSide} transparent depthWrite forceSinglePass/>
    </mesh>
    <mesh ref={overlay} visible={false} frustumCulled={false} raycast={()=>undefined} renderOrder={10001} userData={{waterCaptureExclude:true}}>
      <planeGeometry args={[2,2]}/><shaderMaterial ref={fogMaterial} vertexShader={fogVertex} fragmentShader={fogFragment} uniforms={fog} transparent depthTest={false} depthWrite={false}/>
    </mesh>
  </>;
}
