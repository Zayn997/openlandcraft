import * as THREE from 'three';
import type { Heightfield } from '@openlandcraft/landscape';
import { coastalWaveGLSL } from './coastal-waves';

/** Nearest texels preserve original samples; the shader interpolates the terrain triangles. */
export function createOceanGround(field: Heightfield): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Float32Array(field.heights), field.columns, field.rows, THREE.RedFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
}

export function oceanSegments(width: number, depth: number, wavelength: number, quality: 'low' | 'high'): [number, number] {
  // Allow for nearshore wavelength compression, not only the deep-water spacing.
  const spacing = wavelength / (quality === 'high' ? 32 : 12), cap = quality === 'high' ? 384 : 128;
  return [Math.min(cap, Math.max(16, Math.ceil(width / spacing))), Math.min(cap, Math.max(16, Math.ceil(depth / spacing)))];
}

// The diagonal matches PlaneGeometry after its rotation onto XZ, including steep banks.
export const oceanGroundGLSL = /* glsl */`
  uniform sampler2D uGround;
  uniform vec2 uGrid;
  uniform vec2 uSite;
  uniform float uLevel;
  float groundAt(vec2 point) {
    vec2 grid = clamp((point / uSite + 0.5) * (uGrid - 1.0), vec2(0.0), uGrid - 1.0);
    ivec2 cell = ivec2(min(floor(grid), uGrid - 2.0));
    vec2 f = grid - vec2(cell);
    float a = texelFetch(uGround, cell, 0).r;
    float b = texelFetch(uGround, cell + ivec2(1, 0), 0).r;
    float c = texelFetch(uGround, cell + ivec2(0, 1), 0).r;
    float d = texelFetch(uGround, cell + ivec2(1, 1), 0).r;
    float h = f.x + f.y <= 1.0 ? a + (b-a)*f.x + (c-a)*f.y : d + (c-d)*(1.0-f.x) + (b-d)*(1.0-f.y);
    return h - min(40.0,length(point-clamp(point,-uSite*0.5,uSite*0.5))) * 0.2 * (1.0-smoothstep(uLevel-0.3,uLevel+0.4,h));
  }
`;

export const oceanWaveGLSL = /* glsl */`
  ${coastalWaveGLSL}
  uniform float uPhase;
  uniform float uAmplitude;
  uniform vec2 uDirection;
  uniform float uSwash;
  uniform float uBreaker;
  uniform float uWaveNumber;
  uniform sampler2D uCoastField;
  uniform sampler2D uCoastHistory;
  uniform vec2 uCoastGrid;
  vec4 coastAt(vec2 point) {
    vec2 grid = clamp((point / uSite + 0.5) * (uCoastGrid - 1.0), vec2(0.0), uCoastGrid - 1.0);
    ivec2 cell = ivec2(min(floor(grid), uCoastGrid - 2.0)); vec2 f = grid - vec2(cell);
    vec4 coast = mix(mix(texelFetch(uCoastField, cell, 0), texelFetch(uCoastField, cell + ivec2(1,0), 0), f.x), mix(texelFetch(uCoastField, cell + ivec2(0,1), 0), texelFetch(uCoastField, cell + ivec2(1,1), 0), f.x), f.y);
    vec2 outside = point-clamp(point,-uSite*0.5,uSite*0.5);
    float blend = 1.0-exp(-length(outside)*0.06);
    coast.x += dot(outside,mix(coast.yz,uDirection*uWaveNumber,blend));
    coast.yz = mix(coast.yz,uDirection*uWaveNumber,blend); coast.w=mix(coast.w,1.0,blend);
    return coast;
  }
  vec4 historyAt(vec2 point) {
    if (any(greaterThan(abs(point),uSite*0.5))) return vec4(0.0);
    vec2 uv = ((point / uSite + 0.5) * (uCoastGrid - 1.0) + 0.5) / uCoastGrid;
    return texture2D(uCoastHistory, uv);
  }
  vec4 waveAt(vec2 point,vec4 coast,float ground) {
    return coastalWave(coast.x,dot(point,vec2(-uDirection.y,uDirection.x)),uPhase,uWaveNumber,uLevel-ground,coast.w,uAmplitude,uBreaker,uSwash);
  }
  float surfaceAt(vec2 point, vec4 coast, float ground) {return uLevel+waveAt(point,coast,ground).x;}
  float waterHeight(vec2 point) { return surfaceAt(point, coastAt(point), groundAt(point)); }
  vec2 surfaceSlope(vec2 point, vec4 coast, float ground) {
    vec4 wave=waveAt(point,coast,ground);
    return coast.yz*wave.y+vec2(-uDirection.y,uDirection.x)*wave.z;
  }
  vec4 coastHash(vec2 point) {
    uvec2 p=uvec2(ivec2(point));
    uvec4 h=uvec4(p.x,p.x+1u,p.x,p.x+1u)*1597334677u^uvec4(p.y,p.y,p.y+1u,p.y+1u)*3812015801u;
    h=(h^(h>>16u))*2246822519u;h=(h^(h>>13u))*3266489917u;h^=h>>16u;
    return vec4(h)/4294967295.0;
  }
  float coastNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    vec4 v = coastHash(i);
    return mix(mix(v.x,v.y,f.x),mix(v.z,v.w,f.x),f.y);
  }
  vec2 noiseSlope(vec2 p) {
    vec2 f=fract(p),u=f*f*(3.0-2.0*f),du=6.0*f*(1.0-f);vec4 h=coastHash(floor(p));
    return vec2(mix(h.y-h.x,h.w-h.z,u.y),mix(h.z-h.x,h.w-h.y,u.x))*du;
  }
  vec2 directionalWindSlope(vec2 point,float time,float footprint,vec2 windDirection) {
    vec2 tangent=vec2(-windDirection.y,windDirection.x),slope=vec2(0.0);
    ${[
      [0.18,2.10,0.038,0.2],[-0.49,3.35,0.033,2.7],[0.88,5.72,0.028,4.2],[-1.03,8.31,0.024,1.8],
      [0.45,13.53,0.019,5.4],[-0.74,21.16,0.013,3.2],[1.20,34.38,0.009,0.7],[-0.19,53.17,0.006,2.1],
    ].map(([angle,k,weight,offset])=>`{
      vec2 direction=windDirection*${Math.cos(angle).toFixed(7)}+tangent*${Math.sin(angle).toFixed(7)};
      float phase=dot(point,direction)*${k}+${offset}-time*${Math.sqrt(9.81*k).toFixed(7)};
      float fade=1.0-smoothstep(0.7,2.5,footprint*${k});
      slope+=direction*cos(phase)*${weight}*fade;
    }`).join('\n')}
    vec2 flow=point-windDirection*time*0.23;
    slope+=noiseSlope(flow*2.7)*0.026*(1.0-smoothstep(0.12,0.5,footprint));
    return slope;
  }
  vec2 windSlope(vec2 point,float time,float footprint){return directionalWindSlope(point,time,footprint,uDirection);}
`;


