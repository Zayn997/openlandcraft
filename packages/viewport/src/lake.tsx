import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import {groundHeight,snap,type Lake,type Project,type Editor} from '@openlandcraft/core';
import {lakeBounds,lakeDistance,type PathPoint} from '@openlandcraft/landscape';
import {createOceanGround,oceanGroundGLSL,oceanWaveGLSL} from './ocean-surface';
import {waterMaterialGLSL} from './water-material';
import {appearanceUniforms,updateAppearanceUniforms} from './material-uniforms';
import {lakeFieldGLSL,lakeUniforms,updateLakeUniforms,useLakeWater} from './lake-system';
import {useWaterOptics} from './water-optics';
import {PointNumber} from './river';
import {clipWaterDomain} from './inland-geometry';
import {InlandVolume,inlandUndersideGLSL} from './inland-volume';
import {lakeWave} from './lake-water';

const lakeWaveGLSL=/* glsl */`
  vec4 lakeWaveAt(vec2 p,float ground){float d=lakeDistanceAt(p);return coastalWave(dot(p,uDirection)*uWaveNumber,dot(p,vec2(-uDirection.y,uDirection.x)),uPhase,uWaveNumber,uLevel-ground,1.0,uAmplitude,0.45,0.4)*smoothstep(-0.8,0.0,d);}
`;
const vertex=/* glsl */`${oceanGroundGLSL}${oceanWaveGLSL}${lakeFieldGLSL}${lakeWaveGLSL}
  varying vec3 vWorld;varying vec3 vWave;
  void main(){vec3 p=position;vec4 wave=lakeWaveAt(p.xz,groundAt(p.xz));p.y=max(uLevel+wave.x,groundAt(p.xz)+0.012);vWorld=p;vWave=vec3(uLevel+wave.x,wave.y,wave.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}
`;
const fragment=/* glsl */`${oceanGroundGLSL}${oceanWaveGLSL}${lakeFieldGLSL}${waterMaterialGLSL}${inlandUndersideGLSL}
  uniform vec3 uColor;varying vec3 vWorld;varying vec3 vWave;
  void main(){float depth=vWave.x-groundAt(vWorld.xz);vec4 history=texture2D(uLakeHistory,lakeUV(vWorld.xz));if(depth<0.008&&history.r<0.02)discard;
    float time=uPhase/sqrt(9.81*uWaveNumber);vec2 q=vWorld.xz/uRippleScale;float footprint=max(length(dFdx(q)),length(dFdy(q)));
    vec2 micro=directionalWindSlope(q,time,footprint,uDirection)*min(1.0,uAmplitude*10.0)*smoothstep(0.01,0.2,depth);
    vec2 slope=uDirection*(vWave.y*uWaveNumber)+vec2(-uDirection.y,uDirection.x)*vWave.z+micro;
    vec3 normal=normalize(vec3(-slope.x,1.0,-slope.y));vec3 color=waterRadiance(vWorld,normal,max(0.0,depth),uColor,uClarity,uRoughness);
    if(!gl_FrontFacing)color=inlandUnderside(vWorld,normal,max(0.0,depth),uColor,uClarity);
    float grain=coastNoise(vWorld.xz*8.0-uDirection*time*0.2);grain=mix(grain,0.5,smoothstep(0.1,0.4,footprint));float foam=smoothstep(0.02,0.3,history.r)*smoothstep(0.25,0.7,grain);
    color=mix(color,vec3(0.72,0.78,0.74),foam*0.8);gl_FragColor=vec4(color,max(smoothstep(0.008,0.045,depth),foam*0.6));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
export function LakeLayer({lake,project,editor,selected,enabled,snapping,quality,onSelect,onError}:{lake:Lake;project:Project;editor:Editor;selected:boolean;enabled:boolean;snapping:boolean;quality:'high'|'low';onSelect:(id:string)=>void;onError:(message:string)=>void}){
  const engine=useLakeWater()!,optics=useWaterOptics(),site=project.site,material=useRef<THREE.ShaderMaterial>(null),surface=useRef<THREE.Mesh>(null);
  const shape=JSON.stringify(lake.points),box=useMemo(()=>lakeBounds(lake),[shape,lake.bank]);
  const geometry=useMemo(()=>{
    const spacing=Math.min(quality==='high'?0.4:0.8,lake.wavelength/6),plane=new THREE.PlaneGeometry(box.width,box.depth,Math.min(256,Math.ceil(box.width/spacing)),Math.min(256,Math.ceil(box.depth/spacing)));
    plane.rotateX(-Math.PI/2);plane.translate(box.minX+box.width/2,0,box.minZ+box.depth/2);
    const g=clipWaterDomain(plane,(x,z)=>lakeDistance(lake.points,x,z)+0.8);plane.dispose();
    g.boundingBox=new THREE.Box3(new THREE.Vector3(box.minX,-9,box.minZ),new THREE.Vector3(box.minX+box.width,36,box.minZ+box.depth));g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());return g;
  },[box,shape,quality,lake.wavelength]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const ground=useMemo(()=>createOceanGround(site.terrain),[site.terrain.columns,site.terrain.rows]);
  useLayoutEffect(()=>{(ground.image.data as Float32Array).set(site.terrain.heights);ground.needsUpdate=true;},[ground,site.terrain]);useEffect(()=>()=>ground.dispose(),[ground]);
  const uniforms=useMemo(()=>({...appearanceUniforms(),...lakeUniforms(ground),uGround:{value:ground},uGrid:{value:new THREE.Vector2()},uSite:{value:new THREE.Vector2()},uLevel:{value:0},uPhase:{value:0},uAmplitude:{value:0},uDirection:{value:new THREE.Vector2()},uWaveNumber:{value:1},uColor:{value:new THREE.Color()},uSceneColor:{value:ground as THREE.Texture},uSceneDepth:{value:ground as THREE.Texture},uSky:{value:null as THREE.Texture|null},uResolution:{value:new THREE.Vector2()},uNearFar:{value:new THREE.Vector2()}}),[]);
  useFrame(({gl,camera})=>{const u=material.current?.uniforms as typeof uniforms|undefined;if(!u||!optics||!engine)return;updateAppearanceUniforms(u,lake.appearance);updateLakeUniforms(u,engine);u.uGround.value=ground;u.uGrid.value.set(site.terrain.columns,site.terrain.rows);u.uSite.value.set(site.width,site.depth);u.uLevel.value=lake.level;u.uAmplitude.value=lake.amplitude;u.uWaveNumber.value=2*Math.PI/lake.wavelength;u.uPhase.value=engine.simulation.clock*Math.sqrt(9.81*u.uWaveNumber.value);const angle=lake.direction*Math.PI/180;u.uDirection.value.set(Math.cos(angle),Math.sin(angle));u.uColor.value.set(lake.color);u.uSceneColor.value=optics.target.texture;u.uSceneDepth.value=optics.target.depthTexture??ground;u.uSky.value=optics.sky;gl.getDrawingBufferSize(u.uResolution.value);u.uNearFar.value.set(camera.near,camera.far);},-0.5);
  const orbit=useThree(s=>s.controls) as unknown as {enabled:boolean}|null,allowed=useRef(enabled);allowed.current=enabled;
  const active=useRef<{lake:Lake;index:number;pointer:number;release:()=>void;valid:boolean}|null>(null);
  const cancel=()=>{const session=active.current;active.current=null;if(session){session.release();editor.cancel();if(orbit)orbit.enabled=allowed.current;}};
  useEffect(()=>{const unsubscribe=editor.subscribe(()=>{if(!editor.getSnapshot().gestureLabel&&active.current)cancel();});window.addEventListener('blur',cancel);window.addEventListener('pointercancel',cancel);return()=>{unsubscribe();window.removeEventListener('blur',cancel);window.removeEventListener('pointercancel',cancel);cancel();};},[editor,orbit]);
  useEffect(()=>{if(!enabled||!selected)cancel();},[enabled,selected]);
  const down=(event:ThreeEvent<PointerEvent>,index:number)=>{if(!enabled||event.button!==0||editor.getSnapshot().gestureLabel)return;event.stopPropagation();editor.begin(`Move lake point ${index+1}`);if(orbit)orbit.enabled=false;const target=event.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};target.setPointerCapture(event.pointerId);active.current={lake,index,pointer:event.pointerId,valid:true,release:()=>{try{target.releasePointerCapture(event.pointerId);}catch{/* Released by browser. */}}};};
  const move=(event:ThreeEvent<PointerEvent>)=>{const session=active.current;if(!session||session.pointer!==event.pointerId)return;event.stopPropagation();const p=event.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-session.lake.level),new THREE.Vector3());if(!p)return;const points=session.lake.points.map(p=>[...p] as PathPoint);points[session.index]=[snapping?snap(p.x):p.x,snapping?snap(p.z):p.z];try{editor.preview({type:'replace',entity:{...session.lake,points}});session.valid=true;onError('');}catch(error){session.valid=false;onError(error instanceof Error?error.message:'Invalid lake boundary.');}};
  const up=(event:ThreeEvent<PointerEvent>)=>{const session=active.current;if(!session||session.pointer!==event.pointerId)return;event.stopPropagation();active.current=null;session.valid?editor.commit():editor.cancel();session.release();if(orbit)orbit.enabled=allowed.current;};
  const pick:THREE.Mesh['raycast']=(raycaster,hits)=>{if(!enabled||!surface.current)return;const point=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-lake.level),new THREE.Vector3());if(!point||lakeDistance(lake.points,point.x,point.z)<0||groundHeight(point.x,point.z,site)>lake.level+0.1)return;const distance=point.distanceTo(raycaster.ray.origin);if(distance>=raycaster.near&&distance<=raycaster.far)hits.push({point,distance,object:surface.current});};
  return <group><mesh ref={surface} geometry={geometry} raycast={pick} userData={{waterSurface:true}} renderOrder={2} onClick={e=>{if(enabled&&e.delta<=4){e.stopPropagation();onSelect(lake.id);}}}><shaderMaterial ref={material} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite side={THREE.DoubleSide} forceSinglePass/></mesh>
    <InlandVolume geometry={geometry} vertex={vertex} uniforms={uniforms} liveUniforms={()=>material.current?.uniforms??uniforms} revision={engine}
      discard="void clipVolume(){float bed=groundAt(vWorld.xz);if(vVolumeSurface-bed<0.008||vWorld.y<bed)discard;}"
      sample={p=>{
        if(Math.abs(p.x)>site.width/2||Math.abs(p.z)>site.depth/2)return null;
        const distance=lakeDistance(lake.points,p.x,p.z);if(distance< -0.8)return null;
        const ground=groundHeight(p.x,p.z,site);
        return {ground,surface:lake.level+lakeWave(lake,p.x,p.z,ground,distance,engine.simulation.clock).height};
      }}/>
    {selected&&enabled&&<group userData={{waterCaptureExclude:true}}><LakeDraft points={lake.points} level={lake.level}/>{lake.points.map((p,i)=><mesh key={i} position={[p[0],lake.level+0.15,p[1]]} renderOrder={15} onPointerDown={e=>down(e,i)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={e=>e.stopPropagation()}><sphereGeometry args={[0.3,12,8]}/><meshBasicMaterial color="#d1e6a2" depthTest={false}/><PointNumber number={i+1}/></mesh>)}</group>}
  </group>;
}
export function LakeDraft({points,level}:{points:PathPoint[];level:number}){
  const geometry=useMemo(()=>{const vertices:THREE.Vector3[]=[];for(let i=0;i<points.length;i++){if(i===points.length-1&&points.length<3)break;const a=points[i],b=points[(i+1)%points.length];vertices.push(new THREE.Vector3(a[0],level+0.1,a[1]),new THREE.Vector3(b[0],level+0.1,b[1]));}return new THREE.BufferGeometry().setFromPoints(vertices);},[points,level]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group userData={{waterCaptureExclude:true}}><lineSegments geometry={geometry} raycast={()=>undefined}><lineBasicMaterial color="#d1e6a2" depthTest={false}/></lineSegments>{points.map((p,i)=><mesh key={i} position={[p[0],level+0.1,p[1]]} raycast={()=>undefined}><sphereGeometry args={[0.2,8,6]}/><meshBasicMaterial color="#d1e6a2" depthTest={false}/></mesh>)}</group>;
}


