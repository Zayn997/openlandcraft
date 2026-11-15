import {Line} from '@react-three/drei';
import {groundHeight,type Project,type MirrorRule,type MirrorReferenceLine} from '@openlandcraft/core';
import {ArchitectureLabel} from './architecture-label';
import {referenceLinePoints} from './mirror-axis-picker';
export function MirrorAxis({axis,project,reference}:{axis:Pick<MirrorRule,'start'|'end'>;project:Project;reference?:MirrorReferenceLine}){
 const dx=axis.end[0]-axis.start[0],dz=axis.end[1]-axis.start[1],length=Math.hypot(dx,dz);
 if(length<.2)return null;
 const center=[(axis.start[0]+axis.end[0])/2,(axis.start[1]+axis.end[1])/2],extent=Math.hypot(project.site.width,project.site.depth)/2;
 const points=Array.from({length:65},(_,i):[number,number,number]=>{const t=(i/64*2-1)*extent,x=center[0]+dx/length*t,z=center[1]+dz/length*t;return [x,groundHeight(x,z,project.site)+.4,z];});
 const source=reference&&referenceLinePoints(reference,project),middle=points[32];
 return <group userData={{waterCaptureExclude:true}}>
  {source&&<><Line points={source} color="#76d6e5" lineWidth={4} depthTest={false} raycast={()=>undefined}/><ArchitectureLabel position={source[Math.floor(source.length/2)]} text={`Reference · ${reference!.name}`} screenOffset={[0,-18]}/></>}
  <Line points={points} dashed dashSize={.65} gapSize={.35} color="#edc37e" lineWidth={2} depthTest={false} raycast={()=>undefined}/>
  <ArchitectureLabel position={middle} text="Mirror axis" screenOffset={[0,18]}/>
 </group>;
}
