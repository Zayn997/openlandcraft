import { MIN_HEIGHT, type Heightfield, type TerrainBounds } from './index';
import { polygonArea, type PathPoint } from './path';
import { sampleRiver, type RiverShape } from './river';

export type LakeShape = { points: PathPoint[]; holes?: PathPoint[][]; level: number; depth: number; bank: number };
export function pointSegmentDistance(p: PathPoint, a: PathPoint, b: PathPoint) {
  const dx=b[0]-a[0], dz=b[1]-a[1], t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
}
const cross=(a:PathPoint,b:PathPoint,c:PathPoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function segmentDistance(a:PathPoint,b:PathPoint,c:PathPoint,d:PathPoint) {
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
/** Positive inside, negative outside. Works for either winding and concave boundaries. */
export function lakeDistance(points:PathPoint[],x:number,z:number) {
  let inside=false,distance=Infinity;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    distance=Math.min(distance,pointSegmentDistance([x,z],a,b));
  }
  return (inside?1:-1)*distance;
}
export function lakeBounds(lake:Pick<LakeShape,'points'|'bank'>) {
  const minX=Math.min(...lake.points.map(p=>p[0]))-lake.bank,minZ=Math.min(...lake.points.map(p=>p[1]))-lake.bank;
  return {minX,minZ,width:Math.max(...lake.points.map(p=>p[0]))+lake.bank-minX,depth:Math.max(...lake.points.map(p=>p[1]))+lake.bank-minZ};
}
/** Signed distance to the water, including retained dry islands. */
export function lakeWaterDistance(lake:Pick<LakeShape,'points'|'holes'>,x:number,z:number){
  return Math.min(lakeDistance(lake.points,x,z),...(lake.holes??[]).map(hole=>-lakeDistance(hole,x,z)));
}
export function lakeIssue(lake:LakeShape,bounds:TerrainBounds,field:Pick<Heightfield,'columns'|'rows'>):string|null {
  const {points,bank,level,depth}=lake,cell=Math.max(bounds.width/(field.columns-1),bounds.depth/(field.rows-1));
  if(level-depth<MIN_HEIGHT)return 'Raise the lake level or reduce depth to keep the basin above -9 m.';
  if(bank<cell)return `Use a bank blend of at least ${Math.ceil(cell*10)/10} m for this terrain resolution.`;
  if(points.some(p=>Math.abs(p[0])+bank>bounds.width/2||Math.abs(p[1])+bank>bounds.depth/2))return 'Keep the lake and its banks inside the site.';
  const area=polygonArea(points);
  if(area<Math.max(16,cell*cell*16)||area>10000)return 'Use a lake area between 16 m² (at least 16 terrain cells) and 10,000 m².';
  let perimeter=0;
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],c=points[(i+2)%points.length],length=Math.hypot(a[0]-b[0],a[1]-b[1]);
    if(length<1)return 'Keep adjacent lake points at least 1 m apart.';
    if(Math.abs(cross(a,b,c))<1e-8&&(a[0]-b[0])*(c[0]-b[0])+(a[1]-b[1])*(c[1]-b[1])>0)return 'The lake boundary doubles back. Move or remove the point.';
    perimeter+=length;
    for(let j=i+2;j<points.length;j++) {
      if(i===0&&j===points.length-1)continue;
      if(segmentDistance(a,b,points[j],points[(j+1)%points.length])<Math.max(0.5,cell))return 'Lake edges cross or are too close. Separate the boundary edges.';
    }
  }
  if(perimeter>400)return 'Keep the lake perimeter at most 400 m.';
  const holes=lake.holes??[];
  for(let i=0;i<holes.length;i++){
    const hole=holes[i],issue=lakeIssue({...lake,points:hole,holes:undefined},bounds,field);
    if(issue)return `Dry island ${i+1}: ${issue}`;
    const gap=Math.max(2*bank+cell,3);
    if(hole.some(p=>lakeDistance(points,...p)<gap))return 'Keep a water channel at least two bank blends plus one terrain cell wide around each island.';
    for(let a=0;a<hole.length;a++)for(let b=0;b<points.length;b++)if(segmentDistance(hole[a],hole[(a+1)%hole.length],points[b],points[(b+1)%points.length])<gap)return 'Island edges must stay inside the outer shoreline with room for both banks.';
    for(let j=0;j<i;j++){
      if(hole.some(p=>lakeDistance(holes[j],...p)>=0)||holes[j].some(p=>lakeDistance(hole,...p)>=0))return 'Dry islands must be separate, without nesting.';
      for(let a=0;a<hole.length;a++)for(let b=0;b<holes[j].length;b++)if(segmentDistance(hole[a],hole[(a+1)%hole.length],holes[j][b],holes[j][(b+1)%holes[j].length])<gap)return 'Leave room for water and both banks between dry islands.';
    }
  }
  if(area-holes.reduce((sum,hole)=>sum+polygonArea(hole),0)<Math.max(16,cell*cell*16))return 'The moat needs at least 16 terrain cells of water.';
  return null;
}
export function lakeRiverOverlap(lake:LakeShape,river:RiverShape) {
  const samples=sampleRiver(river.points),reach=river.width/2+river.bank+lake.bank;
  for(let i=1;i<samples.length;i++) {
    const a:PathPoint=[samples[i-1].x,samples[i-1].z],b:PathPoint=[samples[i].x,samples[i].z];
    if(lakeWaterDistance(lake,...a)>=0)return true;
    for(const loop of [lake.points,...lake.holes??[]])for(let j=0;j<loop.length;j++)if(segmentDistance(a,b,loop[j],loop[(j+1)%loop.length])<=reach)return true;
  }
  return false;
}
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** Lower-only basin over the authored/evaluated surface. Water stays within its bounded basin. */
export function carveLake(field:Heightfield,bounds:TerrainBounds,lake:LakeShape):Heightfield {
  const box=lakeBounds(lake),heights=[...field.heights],dx=bounds.width/(field.columns-1),dz=bounds.depth/(field.rows-1);
  const minC=Math.max(0,Math.floor((box.minX+bounds.width/2)/dx)),maxC=Math.min(field.columns-1,Math.ceil((box.minX+box.width+bounds.width/2)/dx));
  const minR=Math.max(0,Math.floor((box.minZ+bounds.depth/2)/dz)),maxR=Math.min(field.rows-1,Math.ceil((box.minZ+box.depth+bounds.depth/2)/dz));
  for(let r=minR;r<=maxR;r++)for(let c=minC;c<=maxC;c++){
    const index=r*field.columns+c,base=field.heights[index],distance=lakeWaterDistance(lake,c*dx-bounds.width/2,r*dz-bounds.depth/2);
    if(distance<=-lake.bank)continue;
    const target=distance>=0?lake.level-lake.depth*smooth(distance/lake.bank):lake.level+(base-lake.level)*smooth(-distance/lake.bank);
    heights[index]=Math.max(MIN_HEIGHT,Math.min(base,target));
  }
  return {...field,heights};
}
