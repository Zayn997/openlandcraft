import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {worldUnitsPerPixel} from './camera-projection';

/** Screen-sized dimensions without a second React DOM root inside the canvas. */
export function ArchitectureLabel({position,text}:{position:[number,number,number];text:string}) {
  const sprite=useRef<THREE.Sprite>(null),world=useMemo(()=>new THREE.Vector3(),[]);
  const label=useMemo(()=>{
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d')!;
    context.font='22px sans-serif';const width=Math.ceil(context.measureText(text).width)+24;
    canvas.width=width;canvas.height=44;
    context.fillStyle='#253127';context.strokeStyle='#a4b982';context.lineWidth=2;
    context.beginPath();context.roundRect(1,1,width-2,42,6);context.fill();context.stroke();
    context.font='22px sans-serif';context.fillStyle='#eef3df';context.textAlign='center';context.textBaseline='middle';context.fillText(text,width/2,23);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return {texture,width:width/2,height:22};
  },[text]);
  useEffect(()=>()=>label.texture.dispose(),[label]);
  useFrame(({camera,size})=>{
    if(!sprite.current)return;
    sprite.current.getWorldPosition(world);
    const unit=worldUnitsPerPixel(camera,world,size.height);
    sprite.current.scale.set(unit*label.width,unit*label.height,1);
  });
  return <sprite ref={sprite} position={position} renderOrder={16} raycast={()=>undefined} userData={{waterCaptureExclude:true}}>
    <spriteMaterial map={label.texture} transparent depthTest={false} depthWrite={false} toneMapped={false}/>
  </sprite>;
}
