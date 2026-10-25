import {useRef,type ReactNode} from 'react';
import {Html} from '@react-three/drei';
import {Vector3} from 'three';
import {groundHeight,type Project} from '@openlandcraft/core';
import type {PathPoint} from '@openlandcraft/landscape';

/** Keep the editor beside its world-space anchor and inside the viewer edges. */
export function PathCornerPopover({point,site,children,height}:{point:PathPoint;site:Project['site'];children:ReactNode;height?:number}){
  const panel=useRef<HTMLDivElement>(null),position=useRef(new Vector3());
  return <Html position={[point[0],(height??groundHeight(...point,site))+.25,point[1]]} zIndexRange={[40,30]}
    calculatePosition={(object,camera,size)=>{
      const projected=position.current.setFromMatrixPosition(object.matrixWorld).project(camera);
      const x=(projected.x+1)*size.width/2,y=(1-projected.y)*size.height/2;
      const width=panel.current?.offsetWidth??210,height=panel.current?.offsetHeight??42;
      return [Math.max(8,Math.min(size.width-width-8,x+width+24>size.width?x-width-20:x+20)),Math.max(8,Math.min(size.height-height-36,y-height/2))];
    }}>
    <div ref={panel} style={{width:210,maxWidth:'calc(100vw - 32px)',pointerEvents:'auto'}}
      onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()}>
      {children}
    </div>
  </Html>;
}
