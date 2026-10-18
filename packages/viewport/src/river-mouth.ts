import { groundHeight, type Ocean, type Project, type River } from '@openlandcraft/core';
import { sampleRiver } from '@openlandcraft/landscape';

/** Only a downstream endpoint actually submerged at sea level joins the ocean. */
export function riverMouth(river:River,site:Project['site'],ocean?:Ocean) {
  const length=sampleRiver(river.points).at(-1)!.along,end=river.points.at(-1)!;
  const enabled=!!ocean?.visible&&Math.abs(end[1]-ocean.level)<=0.2&&groundHeight(end[0],end[2],site)<ocean.level-0.1;
  return {enabled,start:Math.max(0,length-Math.max(8,river.width*2)),end:length};
}
