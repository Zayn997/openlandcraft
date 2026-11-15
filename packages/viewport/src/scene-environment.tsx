import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three';
import { DEFAULT_ENVIRONMENT, groundHeight, type Project } from '@openlandcraft/core';
import { environmentAppearance } from './environment-appearance';
import { createWalkEnvironment, walkCollisionMeshes } from './walk-collision';

export function SceneEnvironment({ project, quality, playing }: { project: Project; quality: 'high' | 'low'; playing: boolean }) {
  const environment = project.environment ?? DEFAULT_ENVIRONMENT;
  const appearance = environmentAppearance(environment), extent = Math.max(project.site.width,project.site.depth);
  const position = appearance.direction.multiplyScalar(extent);
  return <>
    <ambientLight intensity={appearance.ambient}/>
    <hemisphereLight args={['#e6f0ed', '#a4a78c', 0.65]}/>
    <directionalLight position={position} color={appearance.sun} intensity={appearance.direct} castShadow
      shadow-mapSize={quality === 'high' ? [2048,2048] : [1024,1024]} shadow-camera-left={-extent*0.75} shadow-camera-right={extent*0.75}
      shadow-camera-top={extent*0.75} shadow-camera-bottom={-extent*0.75} shadow-camera-near={0.1} shadow-camera-far={extent*3} shadow-bias={-0.0003}/>
    {appearance.fog > 0 && <fogExp2 attach="fog" args={[appearance.horizon,appearance.fog]}/>}
    {(environment.weather === 'rain' || environment.weather === 'snow') && <Precipitation project={project} snow={environment.weather === 'snow'} playing={playing} quality={quality}/>}
  </>;
}

function Precipitation({ project, snow, playing, quality }: { project: Project; snow: boolean; playing: boolean; quality: 'high' | 'low' }) {
  const { scene } = useThree();
  const shelterKey = JSON.stringify(project.entities.filter(entity => ['wall','slab','roof','block','level','path','materialRegion','ocean','lake','river'].includes(entity.kind)));
  const reduced = useRef(false);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => { reduced.current = media.matches; }; update(); media.addEventListener('change',update); return () => media.removeEventListener('change',update); }, []);
  const geometry = useMemo(() => {
    const positions: number[] = [], floors: number[] = [], count = quality === 'high' ? 1600 : 600;
    let seed = 731; const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    for (let i=0;i<count;i++) { const x=(random()-0.5)*project.site.width,z=(random()-0.5)*project.site.depth; positions.push(x,random()*55,z); floors.push(groundHeight(x,z,project.site)); }
    const result = new BufferGeometry(); result.setAttribute('position',new Float32BufferAttribute(positions,3)); result.setAttribute('floorHeight',new Float32BufferAttribute(floors,1)); return result;
  }, [project.site.terrain,project.site.width,project.site.depth,quality]);
  useLayoutEffect(() => {
    // Stop precipitation at roofs, decks and water rather than sending it through interiors.
    const world = createWalkEnvironment(project,walkCollisionMeshes(scene,project),1.78);
    const positions=geometry.getAttribute('position'),floors=geometry.getAttribute('floorHeight');
    for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);floors.setX(i,Math.max(world.floor(x,z,200),world.water?.(x,z)??-100));}
    floors.needsUpdate=true;
  },[scene,shelterKey,geometry]);
  const material = useMemo(() => new ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uSnow:{value:Number(snow)}},
    vertexShader:`attribute float floorHeight; uniform float uTime,uSnow; void main(){vec3 p=position;p.y=floorHeight+mod(p.y-uTime*mix(16.0,1.7,uSnow),55.0);vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(mix(150.0,240.0,uSnow)/max(1.0,-mv.z),mix(1.5,2.5,uSnow),mix(5.0,9.0,uSnow));}`,
    fragmentShader:`uniform float uSnow; void main(){vec2 p=gl_PointCoord-0.5;float alpha=mix((1.0-smoothstep(0.05,0.18,abs(p.x)))*(1.0-smoothstep(0.3,0.5,abs(p.y))),1.0-smoothstep(0.2,0.5,length(p)),uSnow);if(alpha<0.05)discard;gl_FragColor=vec4(mix(vec3(0.7,0.8,0.88),vec3(0.96),uSnow),alpha*0.7);}`,
  }),[snow]);
  useEffect(() => () => geometry.dispose(),[geometry]);
  useEffect(() => () => material.dispose(),[material]);
  useFrame((_,delta) => { if(playing&&!reduced.current)material.uniforms.uTime.value+=Math.min(delta,0.1); });
  return <points geometry={geometry} material={material} frustumCulled={false} raycast={()=>{}} userData={{waterCaptureExclude:true}}/>;
}
