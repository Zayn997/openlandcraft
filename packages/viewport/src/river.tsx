import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { groundHeight, snap, type Editor, type Project, type River } from '@openlandcraft/core';
import { sampleRiver, type RiverPoint } from '@openlandcraft/landscape';
import { createOceanGround, oceanGroundGLSL, oceanWaveGLSL } from './ocean-surface';
import { useWaterOptics } from './water-optics';
import { useCoast } from './coast-system';
import { waterMaterialGLSL } from './water-material';
import { appearanceUniforms, updateAppearanceUniforms } from './material-uniforms';
import { riverMouth } from './river-mouth';
import { useRiverWater } from './river-system';
import { riverGeometry, riverPickGeometry, updateRiverProfile } from './river-geometry';

const vertexShader = /* glsl */`
  ${oceanGroundGLSL}
  ${oceanWaveGLSL}
  uniform float uTime,uRiverAmplitude,uRiverK,uRiverOmega,uRiverReach,uRiverLength;
  uniform vec3 uMouth;
  attribute vec2 flow;attribute vec4 riverProfile;
  varying vec3 vWorld,vRiverNormal;varying vec2 vFlow,vOceanSlope,vRiverUV;varying float vMouth;
  void main(){
    vec3 p=position;vFlow=normalize(flow);vOceanSlope=vec2(0.0);vRiverUV=uv;
    float depth=p.y-groundAt(p.xz),across=(uv.x*2.0-1.0)*uRiverReach;
    vec4 wave=coastalWave(riverProfile.x,across,uTime*uRiverOmega,uRiverK,depth,riverProfile.y,uRiverAmplitude,1.25,0.6);
    p.y+=wave.x+0.012;
    vec2 tangent=vec2(vFlow.y,-vFlow.x);
    vec2 slope=vFlow*(wave.y*riverProfile.w+riverProfile.z)+tangent*wave.z;
    vRiverNormal=normalize(vec3(-slope.x,1.0,-slope.y));
    vMouth=uMouth.z*smoothstep(uMouth.x,uMouth.y,uv.y*uRiverLength);
    if(vMouth>0.0){vec4 coast=coastAt(p.xz),sea=waveAt(p.xz,coast,groundAt(p.xz));p.y=mix(p.y,uLevel+sea.x+0.02,vMouth);vOceanSlope=coast.yz*sea.y+vec2(-uDirection.y,uDirection.x)*sea.z;}
    vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }
`;
const fragmentShader = /* glsl */`
  ${oceanGroundGLSL}
  ${oceanWaveGLSL}
  ${waterMaterialGLSL}
  uniform float uTime,uRiverReach,uRiverLength;uniform vec2 uRiverGrid;
  uniform sampler2D uRiverHistory;
  uniform vec3 uColor,uOceanColor,uOceanAppearance;
  varying vec3 vWorld,vRiverNormal;varying vec2 vFlow,vOceanSlope,vRiverUV;varying float vMouth;
  void main(){
    float depth=vWorld.y-groundAt(vWorld.xz);
    if(depth<0.008||vMouth>0.985)discard;
    float clarity=mix(uClarity,uOceanAppearance.x,vMouth),roughness=mix(uRoughness,uOceanAppearance.y,vMouth),scale=mix(uRippleScale,uOceanAppearance.z,vMouth);
    vec2 channel=vec2(vRiverUV.y*uRiverLength,(vRiverUV.x*2.0-1.0)*uRiverReach);
    vec2 q=channel/scale;
    float footprint=max(length(dFdx(q)),length(dFdy(q)));
    // History carries local shear. Uniform detail advection avoids stretching
    // normal/foam frequencies without bound across slower bank cells.
    vec2 detail=directionalWindSlope(q-vec2(uTime*0.8,0.0),uTime,footprint,vec2(1,0));
    vec2 flow=normalize(vFlow),tangent=vec2(flow.y,-flow.x);
    vec2 riverMicro=flow*detail.x+tangent*detail.y;
    vec2 oceanQ=vWorld.xz/scale;
    vec2 seaMicro=windSlope(oceanQ,uPhase/sqrt(9.81*uWaveNumber),max(length(dFdx(oceanQ)),length(dFdy(oceanQ))));
    vec2 micro=mix(riverMicro,seaMicro,vMouth)*(0.5+roughness/0.6);
    vec3 swell=normalize(vec3(-vOceanSlope.x,1.0,-vOceanSlope.y));
    vec3 normal=normalize(mix(vRiverNormal,swell,vMouth)+vec3(-micro.x,0.0,-micro.y)*smoothstep(0.01,0.18,depth));
    vec3 color=waterRadiance(vWorld,normal,depth,mix(uColor,uOceanColor,vMouth),clarity,roughness);
    vec2 historyUV=(vRiverUV*(uRiverGrid-1.0)+0.5)/uRiverGrid;
    float history=texture2D(uRiverHistory,historyUV).r;
    vec2 foamPoint=vec2(channel.x-uTime*0.8,channel.y);
    float breakup=coastNoise(foamPoint*vec2(1.5,3.0))*0.65+coastNoise(foamPoint*vec2(5.0,8.0))*0.35;
    float foamFootprint=max(length(dFdx(foamPoint)),length(dFdy(foamPoint)));
    breakup=mix(breakup,0.5,smoothstep(0.1,0.35,foamFootprint));
    float foam=smoothstep(0.025,0.42,history)*smoothstep(0.25,0.65,breakup)*(1.0-vMouth);
    color=mix(color,vec3(0.73,0.78,0.74),foam*0.85);
    gl_FragColor=vec4(color,max(smoothstep(0.008,0.045,depth),foam*0.8));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function PointNumber({ number }: { number: number }) {
  const sprite = useRef<THREE.Sprite>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    if (!sprite.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    sprite.current.getWorldPosition(world);
    const scale = camera.position.distanceTo(world) * 2 * Math.tan(camera.getEffectiveFOV() * Math.PI / 360) / size.height * 19;
    sprite.current.scale.set(scale, scale, 1);
  });
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#edf8c8'; context.beginPath(); context.arc(32, 32, 28, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#91a96b'; context.lineWidth = 3; context.stroke();
      context.fillStyle = '#36502d'; context.font = 'bold 34px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(number), 32, 34);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }, [number]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite ref={sprite} scale={[1, 1, 1]} renderOrder={16}><spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} /></sprite>;
}

export function RiverLayer({ river, project, selected, editor, quality, enabled, snapping, onSelect, onError }: {
  river: River; project: Project; selected: boolean; editor: Editor; playing: boolean; quality: 'low' | 'high'; enabled: boolean; snapping: boolean;
  onSelect: (id: string) => void; onError: (message: string) => void;
}) {
  const material=useRef<THREE.ShaderMaterial>(null),optics=useWaterOptics(),coast=useCoast(),engine=useRiverWater()!;
  const ocean=project.entities.find(entity=>entity.kind==='ocean'&&entity.visible);
  const mouth=useMemo(()=>riverMouth(river,project.site,ocean?.kind==='ocean'?ocean:undefined),[river.points,river.width,project.site.terrain,project.site.width,project.site.depth,ocean?.visible,ocean?.kind==='ocean'?ocean.level:undefined]);
  const groundTexture=useMemo(()=>createOceanGround(project.site.terrain),[project.site.terrain.columns,project.site.terrain.rows]);
  useLayoutEffect(()=>{(groundTexture.image.data as Float32Array).set(project.site.terrain.heights);groundTexture.needsUpdate=true;},[groundTexture,project.site.terrain]);
  useEffect(()=>()=>groundTexture.dispose(),[groundTexture]);
  const orbit = useThree((state) => state.controls) as unknown as { enabled: boolean } | null;
  const navigationAllowed = useRef(enabled); navigationAllowed.current = enabled;
  const shape=JSON.stringify(river.points);
  const geometry=useMemo(()=>riverGeometry(engine.simulation.field,river.water.wavelength,quality),[shape,river.width,river.bank,river.water.amplitude,river.water.wavelength,quality]);
  useLayoutEffect(()=>updateRiverProfile(geometry,engine.simulation.field),[geometry,engine]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Picking needs a coarse channel surface, not every vertex of the wave mesh.
  const surface=useRef<THREE.Mesh>(null);
  const picker=useMemo(()=>new THREE.Mesh(riverPickGeometry(engine.simulation.field),new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),[shape,river.width,river.bank,river.water.amplitude]);
  useEffect(()=>()=>{picker.geometry.dispose();picker.material.dispose();},[picker]);
  const pick:THREE.Mesh['raycast']=(raycaster,hits)=>{
    if(!enabled||!surface.current)return;
    const candidates:THREE.Intersection[]=[];picker.raycast(raycaster,candidates);
    for(const hit of candidates)if(groundHeight(hit.point.x,hit.point.z,project.site)<hit.point.y+0.05)hits.push({...hit,object:surface.current});
  };
  const uniforms=useMemo(()=>({...appearanceUniforms(),uRiverHistory:{value:engine.history},uRiverGrid:{value:new THREE.Vector2()},uRiverReach:{value:1},uRiverLength:{value:1},uRiverK:{value:1},uRiverOmega:{value:1},uRiverAmplitude:{value:0},uTime:{value:0},uColor:{value:new THREE.Color()},uOceanColor:{value:new THREE.Color()},uOceanAppearance:{value:new THREE.Vector3(1,.3,1)},uMouth:{value:new THREE.Vector3()},
    uGround:{value:groundTexture},uGrid:{value:new THREE.Vector2()},uSite:{value:new THREE.Vector2()},uLevel:{value:0},uCoastField:{value:groundTexture},uCoastHistory:{value:groundTexture},uCoastGrid:{value:new THREE.Vector2(1,1)},
    uPhase:{value:0},uAmplitude:{value:0},uDirection:{value:new THREE.Vector2(1,0)},uSwash:{value:0},uBreaker:{value:0},uWaveNumber:{value:1},
    uSceneColor:{value:groundTexture},uSceneDepth:{value:groundTexture},uSky:{value:null},uResolution:{value:new THREE.Vector2()},uNearFar:{value:new THREE.Vector2(.1,1500)}}),[]);
  useFrame(({gl,camera})=>{
    const u=material.current?.uniforms;if(!u||!optics)return;
    updateAppearanceUniforms(u as ReturnType<typeof appearanceUniforms>,river.appearance);u.uTime.value=engine.simulation.clock;
    const f=engine.simulation.field;u.uRiverHistory.value=engine.history;u.uRiverGrid.value.set(f.columns,f.rows);u.uRiverReach.value=f.reach;u.uRiverLength.value=f.length;u.uRiverK.value=f.k;u.uRiverOmega.value=f.omega;u.uRiverAmplitude.value=river.water.amplitude;u.uColor.value.set(river.color);
    u.uMouth.value.set(mouth.start,mouth.end,Number(mouth.enabled));u.uGround.value=groundTexture;u.uGrid.value.set(project.site.terrain.columns,project.site.terrain.rows);u.uSite.value.set(project.site.width,project.site.depth);
    u.uSceneColor.value=optics.target.texture;u.uSceneDepth.value=optics.target.depthTexture;u.uSky.value=optics.sky;gl.getDrawingBufferSize(u.uResolution.value);u.uNearFar.value.set(camera.near,camera.far);
    if(ocean?.kind==='ocean'&&coast){
      u.uLevel.value=ocean.level;u.uPhase.value=coast.simulation.clock;u.uAmplitude.value=ocean.amplitude;u.uSwash.value=ocean.swash;u.uBreaker.value=ocean.breaker;u.uWaveNumber.value=Math.PI*2/ocean.wavelength;
      const angle=ocean.direction*Math.PI/180;u.uDirection.value.set(Math.cos(angle),Math.sin(angle));u.uCoastField.value=coast.field;u.uCoastHistory.value=coast.history;u.uCoastGrid.value.set(coast.simulation.field.columns,coast.simulation.field.rows);
      u.uOceanColor.value.set(ocean.color);u.uOceanAppearance.value.set(ocean.appearance.clarity,ocean.appearance.roughness,ocean.appearance.rippleScale);
    }else{u.uLevel.value=river.points.at(-1)![1];u.uDirection.value.set(1,0);u.uOceanColor.value.set(river.color);u.uOceanAppearance.value.set(river.appearance.clarity,river.appearance.roughness,river.appearance.rippleScale);}
  },-0.5);
  const path = useMemo(() => { const points = sampleRiver(river.points).map((point) => new THREE.Vector3(point.x, point.y + 0.12, point.z)); return new THREE.BufferGeometry().setFromPoints(points.flatMap((point, index) => index ? [points[index - 1], point] : [])); }, [river.points]);
  useEffect(() => () => path.dispose(), [path]);
  const active = useRef<{ river: River; index: number; plane: THREE.Plane; pointerId: number; release: () => void; valid: boolean } | null>(null);
  const cancel = () => { const session = active.current; active.current = null; if (session) { session.release(); editor.cancel(); if (orbit) orbit.enabled = navigationAllowed.current; } };
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => { if (!editor.getSnapshot().gestureLabel && active.current) cancel(); });
    window.addEventListener('blur', cancel); window.addEventListener('pointercancel', cancel);
    return () => { unsubscribe(); window.removeEventListener('blur', cancel); window.removeEventListener('pointercancel', cancel); cancel(); };
  }, [editor, orbit]);
  useEffect(() => { if (!enabled) cancel(); }, [enabled]);
  const down = (event: ThreeEvent<PointerEvent>, index: number) => {
    if (!enabled || event.button !== 0 || editor.getSnapshot().gestureLabel) return;
    event.stopPropagation(); editor.begin(`Move river point ${index + 1}`);
    if (orbit) orbit.enabled = false;
    const target = event.target as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
    target.setPointerCapture(event.pointerId);
    active.current = { river, index, plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -river.points[index][1]), pointerId: event.pointerId, valid: true,
      release: () => { try { target.releasePointerCapture(event.pointerId); } catch { /* Browser already released capture. */ } } };
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    const session = active.current; if (!session || session.pointerId !== event.pointerId) return;
    event.stopPropagation(); const point = event.ray.intersectPlane(session.plane, new THREE.Vector3()); if (!point) return;
    const points = session.river.points.map((value) => [...value] as RiverPoint);
    points[session.index] = [snapping ? snap(point.x) : point.x, points[session.index][1], snapping ? snap(point.z) : point.z];
    try { editor.preview({ type: 'replace', entity: { ...session.river, points } }); session.valid = true; onError(''); }
    catch (error) { session.valid = false; onError(error instanceof Error ? error.message : 'The point cannot move there.'); }
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    const session = active.current; if (!session || session.pointerId !== event.pointerId) return;
    event.stopPropagation(); active.current = null; session.valid ? editor.commit() : editor.cancel(); session.release(); if (orbit) orbit.enabled = navigationAllowed.current;
  };
  return <group>
    <mesh ref={surface} geometry={geometry} raycast={pick} userData={{waterSurface:true}} renderOrder={2} onClick={(event) => { if (enabled && event.delta <= 4) { event.stopPropagation(); onSelect(river.id); } }}>
      <shaderMaterial key={vertexShader+fragmentShader} ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} side={THREE.DoubleSide} transparent depthWrite />
    </mesh>
    {selected && enabled && <group userData={{waterCaptureExclude:true}}>
      <lineSegments geometry={path} raycast={() => undefined}><lineBasicMaterial color="#d7f29c" depthTest={false} /></lineSegments>
      {river.points.map((point, index) => <mesh key={index} position={[point[0], point[1] + 0.15, point[2]]} renderOrder={15}
        onPointerDown={(event) => down(event, index)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={(event) => event.stopPropagation()}>
        <sphereGeometry args={[0.4, 12, 8]} /><meshBasicMaterial color="#e1f5aa" depthTest={false} />
        <PointNumber number={index + 1} />
      </mesh>)}
    </group>}
  </group>;
}

export function RiverDraft({ points }: { points: RiverPoint[] }) {
  const line = useMemo(() => { const vertices = (points.length > 1 ? sampleRiver(points).map((point) => [point.x, point.y, point.z]) : points).map((point) => new THREE.Vector3(point[0], point[1] + 0.2, point[2])); return new THREE.BufferGeometry().setFromPoints(vertices.flatMap((point, index) => index ? [vertices[index - 1], point] : [])); }, [points]);
  useEffect(() => () => line.dispose(), [line]);
  return <group userData={{waterCaptureExclude:true}}><lineSegments geometry={line} raycast={() => undefined}><lineBasicMaterial color="#e7efaa" depthTest={false} /></lineSegments>{points.map((point, index) => <mesh key={index} position={point} raycast={() => undefined}><sphereGeometry args={[0.35, 10, 8]} /><meshBasicMaterial color="#e7efaa" depthTest={false} /></mesh>)}</group>;
}
