import type { Lake, Ocean, Project } from '@openlandcraft/core';
import { lakeDistance } from '@openlandcraft/landscape';

/** Find real open water with headroom above the bed; never invent a submerged pose. */
export function underwaterCamera(site:Project['site'],ocean:Ocean,lakes:Pick<Lake,'visible'|'points'>[] = []) {
  if(!ocean.visible)return null;
  const {columns,rows,heights}=site.terrain;
  let score=Infinity,position:[number,number,number]|null=null;
  for(let z=1;z<rows-1;z++)for(let x=1;x<columns-1;x++){
    const px=x/(columns-1)*site.width-site.width/2,pz=z/(rows-1)*site.depth-site.depth/2;
    const depth=ocean.level-heights[z*columns+x];
    if(depth<Math.max(1.2,ocean.amplitude*2+0.6)||Math.abs(px)>site.width/2-2||Math.abs(pz)>site.depth/2-2)continue;
    if(lakes.some(lake=>lake.visible&&lakeDistance(lake.points,px,pz)>-0.8))continue;
    const rank=(px-site.width*0.25)**2+pz*pz+50*(depth-2.5)**2;
    if(rank>=score)continue;score=rank;
    position=[px,ocean.level-Math.min(depth-0.4,Math.max(1.2,ocean.amplitude*1.8+0.3)),pz];
  }
  if(!position)return null;
  const angle=ocean.direction*Math.PI/180;
  return {position,target:[position[0]+Math.cos(angle)*4,position[1]+0.15,position[2]+Math.sin(angle)*4] as [number,number,number]};
}
