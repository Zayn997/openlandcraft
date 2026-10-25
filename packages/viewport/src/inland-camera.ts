import {groundHeight,type Project,type Lake,type River} from '@openlandcraft/core';
import {lakeWaterDistance,sampleRiver} from '@openlandcraft/landscape';

/** A dive must fit between the real carved bed and the trough allowance. */
export function inlandWaterCamera(site:Project['site'],water:Lake|River):{position:[number,number,number];target:[number,number,number]}|null {
  if(!water.visible)return null;
  const amplitude=water.kind==='river'?water.water.amplitude:water.amplitude;
  let best=-Infinity,pose:{position:[number,number,number];target:[number,number,number]}|null=null;
  const consider=(x:number,z:number,level:number,dx:number,dz:number,margin:number,preference=0)=>{
    if(Math.abs(x)>site.width/2-0.5||Math.abs(z)>site.depth/2-0.5)return;
    const depth=level-groundHeight(x,z,site);
    if(depth<Math.max(0.5,amplitude*2+0.3)||margin<0.5)return;
    const score=Math.min(depth,water.depth)+Math.min(margin,5)*0.1+preference;
    if(score<=best)return;best=score;
    const y=level-Math.min(depth-0.22,Math.max(0.3,amplitude*1.7+0.2));
    pose={position:[x,y,z],target:[x+dx*3,y+0.04,z+dz*3]};
  };
  if(water.kind==='lake'){
    const {columns,rows}=site.terrain,angle=water.direction*Math.PI/180;
    for(let r=1;r<rows-1;r++)for(let c=1;c<columns-1;c++){
      const x=c/(columns-1)*site.width-site.width/2,z=r/(rows-1)*site.depth-site.depth/2;
      consider(x,z,water.level,Math.cos(angle),Math.sin(angle),lakeWaterDistance(water,x,z));
    }
  }else{
    const path=sampleRiver(water.points);
    for(let i=1;i<path.length-2;i++){
      const a=path[i],b=path[i+1],length=Math.hypot(b.x-a.x,b.z-a.z);
      if(length>0)consider(a.x,a.z,a.y,(b.x-a.x)/length,(b.z-a.z)/length,Math.min(water.width/2,a.along,path.at(-1)!.along-a.along),-Math.abs(a.along/path.at(-1)!.along-0.35)*4);
    }
  }
  return pose;
}
