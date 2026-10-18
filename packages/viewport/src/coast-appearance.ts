/** Shared, world-space beach material. Distances are metres; colors are linear. */
export const beachAppearanceGLSL = /* glsl */`
  uniform vec3 uSandColor,uGrassColor,uRockColor;
  uniform float uTerrainScale,uTerrainRoughness,uRockSlope;
  float beachHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float beachNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(beachHash(i), beachHash(i+vec2(1,0)), f.x), mix(beachHash(i+vec2(0,1)), beachHash(i+vec2(1,1)), f.x), f.y);
  }
  float sandRipple(vec2 p) { return p.x * 15.0 + sin(p.y * 1.7) * 0.65 + sin(p.y * 0.37) * 1.8 + beachNoise(p*0.8)*3.0; }
  vec3 beachAlbedo(vec2 p) {
    p/=uTerrainScale;
    float broad = beachNoise(p * 0.19) * 0.65 + beachNoise(p * 0.73) * 0.35;
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    float grain = (beachNoise(p * 110.0) - 0.5) * (1.0 - smoothstep(0.006, 0.025, footprint));
    float ripple = sin(sandRipple(p)) * (1.0 - smoothstep(0.012, 0.12, footprint));
    return uSandColor * (0.90 + broad * 0.17 + grain * 0.16 + ripple * 0.012);
  }
  vec2 beachSlope(vec2 p) {
    p/=uTerrainScale;
    float fade = 1.0 - smoothstep(0.012, 0.12, max(length(dFdx(p)), length(dFdy(p))));
    float c = cos(sandRipple(p));
    return vec2(0.014 * c, 0.002 * c * cos(p.y * 1.7)) * fade;
  }
  float rockCoverage(vec3 n){return 1.0-smoothstep(cos(radians(uRockSlope+8.0)),cos(radians(uRockSlope-8.0)),clamp(n.y,0.0,1.0));}
  vec3 terrainAlbedo(vec2 p,float sand,float rock){
    float variation=0.91+beachNoise(p/uTerrainScale*0.23)*0.18;
    vec3 ground=mix(uGrassColor*variation,beachAlbedo(p),sand);
    return mix(ground,uRockColor*(0.78+beachNoise(p/uTerrainScale*1.7)*0.30),rock);
  }
`;

export const coastalSkyGLSL = /* glsl */`
  vec3 coastalSky(vec3 direction) {
    vec3 d=normalize(direction);
    vec3 sky=mix(vec3(0.36,0.43,0.47),vec3(0.055,0.12,0.22),pow(max(0.0,d.y),0.55));
    return mix(vec3(0.26,0.25,0.20),sky,smoothstep(-0.10,0.02,d.y));
  }
`;
