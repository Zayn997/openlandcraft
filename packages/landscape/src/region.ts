import type {TerrainBounds} from './index';
import {polygonArea,type PathPoint} from './path';
import {segmentDistance} from './lake';

/** Simple closed polygons, independent of water and authored terrain heights. */
export function regionIssue(points:PathPoint[],site:TerrainBounds):string|null {
  if(points.some(([x,z])=>Math.abs(x)>site.width/2||Math.abs(z)>site.depth/2))return 'Keep the region inside the site.';
  const area=polygonArea(points);if(area<4||area>10000)return 'Use a region area between 4 and 10,000 m².';
  let perimeter=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],c=points[(i+2)%points.length];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<0.5)return 'Keep region points at least 0.5 m apart.';perimeter+=length;
    const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if(Math.abs(cross)<1e-8&&(a[0]-b[0])*(c[0]-b[0])+(a[1]-b[1])*(c[1]-b[1])>0)return 'The region boundary doubles back.';
    for(let j=i+2;j<points.length;j++)if(!(i===0&&j===points.length-1)&&segmentDistance(a,b,points[j],points[(j+1)%points.length])<0.25)return 'Region edges cross or are too close.';
  }
  return perimeter>600?'Keep the region perimeter at most 600 m.':null;
}
