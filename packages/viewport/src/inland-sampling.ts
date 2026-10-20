import {groundHeight,type Project,type River} from '@openlandcraft/core';
import type {RiverField} from './river-water';
import {coastalWave} from './coastal-waves';

/** Locate the camera in channel coordinates, respecting both finite end caps. */
export function sampleRiverVolume(field:RiverField,river:River,site:Project['site'],x:number,z:number,time:number) {
  if(Math.abs(x)>site.width/2||Math.abs(z)>site.depth/2)return null;
  const f=field,center=Math.floor(f.columns/2);
  let nearest=Infinity,result:{surface:number;ground:number;along:number}|null=null;
  for(let r=0;r<f.rows-1;r++){
    const i=(r*f.columns+center)*3,j=((r+1)*f.columns+center)*3;
    const dx=f.positions[j]-f.positions[i],dz=f.positions[j+2]-f.positions[i+2],length2=dx*dx+dz*dz;
    if(length2<1e-10)continue;
    const projection=((x-f.positions[i])*dx+(z-f.positions[i+2])*dz)/length2;
    const t=Math.max(0,Math.min(1,projection)),px=f.positions[i]+dx*t,pz=f.positions[i+2]+dz*t,distance=Math.hypot(x-px,z-pz);
    if(distance>f.reach||distance>=nearest)continue;nearest=distance;
    if((r===0&&projection<0)||(r===f.rows-2&&projection>1)){result=null;continue;}
    const value=(k:number)=>f.profile[r*4+k]*(1-t)+f.profile[(r+1)*4+k]*t;
    const level=f.positions[i+1]*(1-t)+f.positions[j+1]*t,ground=groundHeight(x,z,site);
    const across=((x-px)*dz-(z-pz)*dx)/Math.sqrt(length2);
    const wave=coastalWave(value(0),across,time*f.omega,f.k,level-ground,value(1),river.water.amplitude,1.25,0.6);
    result={ground,surface:level+wave.height+0.012,along:(r+t)*f.ds};
  }
  return result;
}
