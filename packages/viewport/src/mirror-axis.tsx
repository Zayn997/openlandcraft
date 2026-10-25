import {Line} from '@react-three/drei';
import {groundHeight,type Project,type MirrorRule} from '@openlandcraft/core';
import {ArchitectureLabel} from './architecture-label';
export function MirrorAxis({axis,project}:{axis:Pick<MirrorRule,'start'|'end'>;project:Project}){
 const points=Array.from({length:65},(_,i):[number,number,number]=>{const x=axis.start[0]+(axis.end[0]-axis.start[0])*i/64,z=axis.start[1]+(axis.end[1]-axis.start[1])*i/64;return [x,groundHeight(x,z,project.site)+.25,z];});
 return <group userData={{waterCaptureExclude:true}}><Line points={points} dashed dashSize={.5} gapSize={.25} color="#edc37e" lineWidth={2} raycast={()=>undefined}/>{[points[0],points[64]].map((p,i)=><ArchitectureLabel key={i} position={p} text={`Mirror axis ${i+1}`}/>)}</group>;
}
