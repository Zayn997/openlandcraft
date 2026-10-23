import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import type {ArchitecturalMaterial as Definition} from '@openlandcraft/core';

// Metre-based triplanar projection covers caps, reveals and curved surfaces without authored UV seams.
const patternShader=`
varying vec3 vCastlePosition;
varying vec3 vCastleNormal;
uniform float uCastleScale;
uniform float uCastlePattern;
float castleHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float castleNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(castleHash(i),castleHash(i+vec2(1,0)),f.x),mix(castleHash(i+vec2(0,1)),castleHash(i+vec2(1,1)),f.x),f.y);}
vec2 castlePattern(vec2 uv){
 float fine=castleNoise(uv*180.0),value,height;
 if(uCastlePattern<0.5){
  vec2 p=uv*vec2(2.0,4.0);float row=floor(p.y);p.x+=mod(row,2.0)*0.5;vec2 cell=floor(p),f=fract(p);
  vec2 aa=max(fwidth(p)*1.2,vec2(0.002));float face=smoothstep(0.025-aa.x,0.025+aa.x,min(f.x,1.0-f.x))*smoothstep(0.035-aa.y,0.035+aa.y,min(f.y,1.0-f.y));
  value=mix(0.38,0.77+castleHash(cell)*0.29+(castleNoise(uv*24.0)-0.5)*0.14,face);height=face*0.008+(fine-0.5)*0.001;
 }else if(uCastlePattern<1.5){
  vec2 p=uv*vec2(4.0,1.0);float board=floor(p.x),edge=min(fract(p.x),1.0-fract(p.x)),face=smoothstep(0.012,0.025+fwidth(p.x),edge);
  float wave=sin(uv.y*8.0+castleHash(vec2(board,0))*6.28)*0.06+castleNoise(vec2(uv.y*3.0,board))*0.09;
  float grain=sin((uv.x+wave)*170.0+castleNoise(uv*vec2(15,2))*12.0)*0.5+0.5;
  value=mix(0.34,0.76+castleHash(vec2(board,1))*0.25-grain*0.17+(fine-0.5)*0.06,face);height=face*0.003+grain*0.0005;
 }else{
  vec2 p=uv*vec2(4.0,6.0);float row=floor(p.y);p.x+=mod(row,2.0)*0.5;vec2 f=fract(p),cell=floor(p);vec2 aa=max(fwidth(p),vec2(0.002));
  float face=smoothstep(0.025-aa.x,0.025+aa.x,min(f.x,1.0-f.x))*smoothstep(0.035-aa.y,0.035+aa.y,min(f.y,1.0-f.y));
  value=mix(0.32,0.72+castleHash(cell)*0.30+f.y*0.1+(fine-0.5)*0.05,face);height=face*(0.004+f.y*0.002);
 }
 return vec2(value,height);
}
vec2 castleSurface(){vec3 w=pow(abs(normalize(vCastleNormal)),vec3(8.0));w/=max(dot(w,vec3(1)),0.0001);vec3 p=vCastlePosition/uCastleScale;return castlePattern(p.zy)*w.x+castlePattern(p.xz)*w.y+castlePattern(p.xy)*w.z;}
vec3 castleBump(vec3 n,float height){vec3 dpdx=dFdx(-vViewPosition),dpdy=dFdy(-vViewPosition),r1=cross(dpdy,n),r2=cross(n,dpdx);float det=dot(dpdx,r1);if(abs(det)<0.00000001)return n;vec3 grad=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);return normalize(abs(det)*n-grad);}
`;
export function buildArchitecturalMaterial(definition?:Definition,fallback='#e4ded1',landing=false):THREE.MeshStandardMaterial{
 const material=new THREE.MeshStandardMaterial({color:definition?.color??fallback,roughness:definition?.roughness??.8,polygonOffset:landing,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 if(!definition)return material;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uCastleScale={value:definition.scale};shader.uniforms.uCastlePattern={value:['stone','timber','roof'].indexOf(definition.pattern)};
  shader.vertexShader='varying vec3 vCastlePosition;\nvarying vec3 vCastleNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCastlePosition=(modelMatrix*vec4(position,1.0)).xyz;\nvCastleNormal=mat3(modelMatrix)*normal;');
  shader.fragmentShader=shader.fragmentShader.replace('void main() {',patternShader+'\nvoid main() {');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec2 castleDetail=castleSurface();\ndiffuseColor.rgb*=castleDetail.x;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=castleBump(normal,castleDetail.y);');
 };
 material.customProgramCacheKey=()=> 'castle-triplanar-v1';
 return material;
}
export function ArchitecturalSurface({definition,color,landing=false}:{definition?:Definition;color:string;landing?:boolean}){
 const material=useMemo(()=>buildArchitecturalMaterial(definition,color,landing),[definition?.pattern,definition?.color,definition?.scale,definition?.roughness,color,landing]);
 useEffect(()=>()=>material.dispose(),[material]);return <primitive object={material} attach="material"/>;
}
