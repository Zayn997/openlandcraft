/** Shared bounded optics for river and ocean. groundAt comes from the evaluated terrain. */
export const waterMaterialGLSL=/* glsl */`
  uniform sampler2D uSceneColor,uSceneDepth;
  uniform samplerCube uSky;
  uniform vec2 uResolution,uNearFar;
  uniform mat4 projectionMatrix;
  uniform float uClarity,uRoughness,uRippleScale;
  #include <packing>
  vec3 waterRadiance(vec3 world,vec3 normal,float depth,vec3 tint,float clarity,float roughness){
    vec3 eye=normalize(cameraPosition-world);
    float distanceToEye=length(cameraPosition-world);
    float fresnel=0.0204+0.9796*pow(1.0-max(0.0,dot(normal,eye)),5.0);
    vec2 screenUV=gl_FragCoord.xy/uResolution;
    vec3 ray=refract(-eye,normal,1.0/1.333);
    float path=min(45.0,depth/max(0.22,-ray.y));
    vec2 bed=world.xz+ray.xz*path;
    vec4 projected=projectionMatrix*viewMatrix*vec4(bed.x,groundAt(bed),bed.y,1.0);
    vec2 bentUV=projected.xy/projected.w*0.5+0.5;
    float edge=smoothstep(0.0,0.06,min(min(bentUV.x,bentUV.y),min(1.0-bentUV.x,1.0-bentUV.y)));
    bentUV=mix(screenUV,clamp(bentUV,vec2(0.001),vec2(0.999)),edge);
    float surfaceDistance=-(viewMatrix*vec4(world,1.0)).z;
    float capturedDistance=-perspectiveDepthToViewZ(texture2D(uSceneDepth,bentUV).x,uNearFar.x,uNearFar.y);
    if(capturedDistance<surfaceDistance+0.04)bentUV=screenUV;
    vec3 bottom=texture2D(uSceneColor,bentUV).rgb;
    vec3 transmission=exp(-vec3(0.65,0.18,0.12)*path/clarity);
    vec3 scatter=mix(vec3(0.008,0.10,0.085),tint*0.32,0.40);
    vec3 color=bottom*transmission+scatter*(1.0-transmission);
    vec3 reflection=textureCube(uSky,reflect(-eye,normal),roughness*2.333+smoothstep(20.0,150.0,distanceToEye)*2.0).rgb;
    color=mix(color,reflection,fresnel);
    vec3 light=normalize(vec3(-0.4,0.70,0.45));
    float highlight=max(0.0,dot(normal,normalize(light+eye)));
    float glint=pow(highlight,mix(240.0,70.0,smoothstep(15.0,140.0,distanceToEye))*(1.3-roughness));
    color+=vec3(1.0,0.90,0.73)*glint*0.9*smoothstep(0.0,0.06,depth);
    return color;
  }
`;
