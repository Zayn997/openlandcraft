import * as THREE from 'three';

/** Boundary strips match the wave grid vertices, so the cut face meets the crests. */
export function oceanBoundary(width:number,depth:number,columns:number,rows:number) {
  const points:[number,number][]=[];
  for(let x=0;x<=columns;x++)points.push([-width/2+x/columns*width,-depth/2]);
  for(let z=1;z<=rows;z++)points.push([width/2,-depth/2+z/rows*depth]);
  for(let x=columns-1;x>=0;x--)points.push([-width/2+x/columns*width,depth/2]);
  for(let z=rows-1;z>0;z--)points.push([-width/2,-depth/2+z/rows*depth]);
  const vertices:number[]=[],indices:number[]=[];
  points.forEach(([x,z])=>vertices.push(x,0,z,x,1,z));
  points.forEach((_,i)=>{const a=i*2,b=((i+1)%points.length)*2;indices.push(a,a+1,b,a+1,b+1,b);});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  return geometry;
}

export const oceanBoundaryVertex=/* glsl */`
  varying vec3 vWorld;
  varying float vWaterDepth;
  void main(){
    float ground=groundAt(position.xz),surface=waterHeight(position.xz);
    vWaterDepth=surface-ground;
    vWorld=vec3(position.x,mix(-12.0,max(ground+0.012,surface),position.y),position.z);
    gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
  }
`;

export const oceanBoundaryFragment=/* glsl */`
  varying vec3 vWorld;
  varying float vWaterDepth;
  void main(){
    vec2 lakePoint=(vWorld.xz-uLakeBounds.xy)/uLakeBounds.zw;
    if(uLakeEnabled>0.5&&all(greaterThanEqual(lakePoint,vec2(0.0)))&&all(lessThanEqual(lakePoint,vec2(1.0)))&&lakeDistanceAt(vWorld.xz)>-0.8)discard;
    if(vWaterDepth<=0.005||vWorld.y<groundAt(vWorld.xz))discard;
    vec3 direction=normalize(vWorld-cameraPosition);
    vec2 uv=gl_FragCoord.xy/uResolution;
    float viewDepth=-(viewMatrix*vec4(vWorld,1.0)).z;
    float captured=-perspectiveDepthToViewZ(texture2D(uSceneDepth,uv).r,uNearFar.x,uNearFar.y);
    float through=max(0.0,(captured-viewDepth)/max(0.05,-(viewMatrix*vec4(direction,0.0)).z));
    vec2 exitDistance=(mix(-uSite*0.5,uSite*0.5,step(vec2(0.0),direction.xz))-vWorld.xz)/(sign(direction.xz)*max(abs(direction.xz),vec2(0.00001))+vec2(0.000001));
    through=min(through,max(0.0,min(exitDistance.x,exitDistance.y)));
    through=min(through,45.0);
    vec3 transmission=exp(-vec3(0.65,0.18,0.12)*through/max(0.1,uClarity));
    vec3 scatter=mix(vec3(0.008,0.10,0.085),uColor*0.32,0.40);
    gl_FragColor=vec4(texture2D(uSceneColor,uv).rgb*transmission+scatter*(1.0-transmission),1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Evaluate camera membership once per fullscreen vertex, rather than for every pixel.
export const underwaterVertex=/* glsl */`
  varying float vSubmerged,vCameraSurface;
  void main(){
    vCameraSurface=waterHeight(cameraPosition.xz);
    float ground=groundAt(cameraPosition.xz);
    vSubmerged=smoothstep(-0.10,0.10,vCameraSurface-cameraPosition.y);
    if(any(greaterThan(abs(cameraPosition.xz),uSite*0.5))||cameraPosition.y<ground||vCameraSurface-ground<0.02)vSubmerged=0.0;
    vec2 lakePoint=(cameraPosition.xz-uLakeBounds.xy)/uLakeBounds.zw;
    if(uLakeEnabled>0.5&&all(greaterThanEqual(lakePoint,vec2(0.0)))&&all(lessThanEqual(lakePoint,vec2(1.0)))&&lakeDistanceAt(cameraPosition.xz)>-0.8)vSubmerged=0.0;
    gl_Position=vec4(position.xy,0.0,1.0);
  }
`;

/** Depth-buffer fog only covers the portion of each ray actually inside the sea. */
export const underwaterFragment=/* glsl */`
  uniform mat4 uCameraWorld,uProjectionInverse;
  uniform float uInlandUnderwater;
  varying float vSubmerged,vCameraSurface;
  void main(){
    if(vSubmerged<0.001||uInlandUnderwater>0.5)discard;
    vec2 uv=gl_FragCoord.xy/uResolution;
    vec4 viewPoint=uProjectionInverse*vec4(uv*2.0-1.0,1.0,1.0);
    vec3 ray=normalize((uCameraWorld*vec4(viewPoint.xyz/viewPoint.w,0.0)).xyz);
    float captured=-perspectiveDepthToViewZ(texture2D(uSceneDepth,uv).r,uNearFar.x,uNearFar.y);
    float path=captured/max(0.001,-(viewMatrix*vec4(ray,0.0)).z);
    vec2 exitDistance=(mix(-uSite*0.5,uSite*0.5,step(vec2(0.0),ray.xz))-cameraPosition.xz)/(sign(ray.xz)*max(abs(ray.xz),vec2(0.00001))+vec2(0.000001));
    path=min(path,max(0.0,min(exitDistance.x,exitDistance.y)));
    if(ray.y>0.001){
      float t=max(0.0,(vCameraSurface-cameraPosition.y)/ray.y);
      for(int i=0;i<4;i++)t=max(0.0,(waterHeight(cameraPosition.xz+ray.xz*t)-cameraPosition.y)/ray.y);
      path=min(path,t);
    }
    float attenuation=1.0-exp(-max(0.0,path)*0.12/max(0.1,uClarity));
    vec3 scatter=mix(vec3(0.008,0.10,0.085),uColor*0.32,0.40);
    gl_FragColor=vec4(scatter,attenuation*vSubmerged);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
