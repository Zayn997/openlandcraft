import { Color, Vector3 } from 'three';
import { DEFAULT_ENVIRONMENT, sunDirection, type Project, type SceneEnvironment } from '@openlandcraft/core';

export const SEASON_COLORS = {
  spring: { color: '#99bb64', strength: 0.32 }, summer: { color: '#869777', strength: 0 },
  autumn: { color: '#b97835', strength: 0.78 }, winter: { color: '#b6beb5', strength: 0.68 },
};
export function environmentAppearance(environment = DEFAULT_ENVIRONMENT) {
  const { weather, sunElevation, season } = environment;
  const cover = { clear: 0, cloudy: 0.8, rain: 0.95, snow: 0.9, fog: 1 }[weather];
  const daylight = 0.35 + 0.65 * Math.sin(sunElevation * Math.PI / 180);
  const warm = Math.max(0, 1 - sunElevation / 30);
  return {
    direction: new Vector3(...sunDirection(environment)), cover,
    sun: new Color('#fff6df').lerp(new Color('#ffab61'), warm),
    sky: new Color(season === 'winter' ? '#88a6bc' : '#729fc4').lerp(new Color('#7e8994'), cover),
    horizon: new Color('#e5e6db').lerp(new Color('#edb785'), warm).lerp(new Color('#afb8be'), cover),
    direct: 2.6 * (1 - cover * 0.93) * daylight / 0.84,
    ambient: 0.35 + cover * 0.3,
    fog: { clear: 0, cloudy: 0.001, rain: 0.007, snow: 0.006, fog: 0.023 }[weather],
  };
}

/** Rendering-only palette: authored materials and terrain data remain intact. */
export function seasonalSite(site: Project['site'], environment?: SceneEnvironment): Project['site'] {
  if (!environment) return site;
  const palette = SEASON_COLORS[environment.season], snow = environment.weather === 'snow';
  if (!palette.strength && !snow && environment.weather !== 'rain') return site;
  const mix = (color: string, strength: number) => {
    const value = new Color(color).lerp(new Color(palette.color), strength);
    if (snow) value.lerp(new Color('#edf1f1'), 0.83);
    if (environment.weather === 'rain') value.multiplyScalar(0.78);
    return `#${value.getHexString()}`;
  };
  return { ...site, materials: { ...site.materials, grass: mix(site.materials.grass,palette.strength), sand: mix(site.materials.sand,palette.strength*0.15), rock: mix(site.materials.rock,palette.strength*0.1) } };
}

export const environmentSkyGLSL = /* glsl */`
uniform vec3 uSkyColor, uHorizonColor, uSunDirection, uSunColor;
uniform float uCloudCover;
float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float skyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),mix(skyHash(i+vec2(0,1)),skyHash(i+vec2(1,1)),f.x),f.y);}
vec3 environmentSky(vec3 direction){
  vec3 d=normalize(direction);
  vec3 sky=mix(uHorizonColor,uSkyColor,pow(max(0.0,d.y),0.55));
  vec2 p=d.xz/(max(d.y,0.0)+0.3)*3.0;
  float noise=skyNoise(p)*0.6+skyNoise(p*2.1)*0.3+skyNoise(p*4.3)*0.1;
  float cloud=smoothstep(0.65-uCloudCover*0.5,0.85-uCloudCover*0.5,noise)*smoothstep(0.0,0.18,d.y)*uCloudCover;
  sky=mix(sky,uHorizonColor*(0.8+noise*0.3),cloud);
  float sun=max(dot(d,uSunDirection),0.0);
  sky+=uSunColor*(pow(sun,500.0)*0.4+smoothstep(0.9995,0.99985,sun)*2.0)*(1.0-uCloudCover);
  return mix(uHorizonColor*0.45,sky,smoothstep(-0.15,0.01,d.y));
}`;
