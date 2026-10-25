import {lakeDistance} from './lake';
import {pathLength,pathStrips,clipPathPolygon,polygonArea,type PathPoint} from './path';
import {roundedRoutePoints} from './rounded-route';
import {regionTriangles} from './region';
import type {Heightfield,TerrainBounds} from './index';
import {bridgeHeight,type BridgeSettings} from './bridge';

export type SurfaceElevation={elevationMode?:'terrain'|'fixed'|'graded';elevation?:number;endElevation?:number;gradingWidth?:number;bridge?:BridgeSettings};
export type SiteSurface=SurfaceElevation&{id?:string;points:PathPoint[];width?:number;cornerRounding?:number[]};
export type SurfaceSite=TerrainBounds&{terrain:Heightfield};
export const terrainCellDiagonal=(site:SurfaceSite)=>Math.hypot(site.width/(site.terrain.columns-1),site.depth/(site.terrain.rows-1));
/** Match the rendered terrain's triangle interpolation, including diagonal cells. */
export function terrainTriangleHeight(site:SurfaceSite,[x,z]:PathPoint):number{
  const f=site.terrain,gx=(x/site.width+.5)*(f.columns-1),gz=(z/site.depth+.5)*(f.rows-1),c=Math.min(f.columns-2,Math.max(0,Math.floor(gx))),r=Math.min(f.rows-2,Math.max(0,Math.floor(gz))),u=Math.max(0,Math.min(1,gx-c)),v=Math.max(0,Math.min(1,gz-r)),i=r*f.columns+c;
  const a=f.heights[i],b=f.heights[i+1],d=f.heights[i+f.columns],e=f.heights[i+f.columns+1];
  return u+v<=1?a+(b-a)*u+(d-a)*v:e+(d-e)*(1-u)+(b-e)*(1-v);
}
export function compileSurface(surface:SiteSurface){
  const route=surface.width!==undefined&&surface.points.length>=2?roundedRoutePoints({...surface,width:surface.width}):null;
  const polygons=route?pathStrips({points:route,width:surface.width!}):[surface.points],length=route?pathLength(route):0;
  const distances=[0];route?.slice(1).forEach((p,i)=>distances.push(distances[i]+Math.hypot(p[0]-route[i][0],p[1]-route[i][1])));
  const height=(point:PathPoint)=>{
    const start=surface.elevation??0,end=surface.endElevation??start;if(!route||start===end)return start;
    // Interpolate between constant-height miter sections. A nearest-centerline
    // parameter alone jumps across the inside bisector of a sharp bend.
    for(let i=0;i<polygons.length;i++){
      const q=polygons[i];if(lakeDistance(q,...point)<-1e-8)continue;
      for(const ids of [[0,1,2],[0,2,3]]){
        const [a,b,c]=ids.map(j=>q[j]),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
        const u=((b[1]-c[1])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[1]))/den,v=((c[1]-a[1])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[1]))/den,w=1-u-v;
        if(Math.min(u,v,w)<-1e-8)continue;
        const along=ids.reduce((sum,id,j)=>sum+[u,v,w][j]*distances[i+(id===1||id===2?1:0)],0);
        return start+(end-start)*along/(length||1);
      }
    }
    let nearest=Infinity,along=0,best=0;
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz),t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/(n*n||1))),distance=Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dz*t);
      if(distance<nearest){nearest=distance;best=along+n*t;}along+=n;
    }
    return start+(end-start)*best/(length||1);
  };
  // Positive distance outside the footprint, zero throughout its interior.
  const distance=(point:PathPoint)=>Math.max(0,-Math.max(...polygons.map(p=>lakeDistance(p,...point))));
  const vertices=polygons.flat(),bounds={minX:Math.min(...vertices.map(p=>p[0])),maxX:Math.max(...vertices.map(p=>p[0])),minZ:Math.min(...vertices.map(p=>p[1])),maxZ:Math.max(...vertices.map(p=>p[1]))};
  return {surface,polygons,height,distance,bounds};
}
export function surfaceElevationAt(surface:SiteSurface,site:SurfaceSite,point:PathPoint):number{
  if(surface.bridge)return bridgeHeight(surface,site,point);
  return !surface.elevationMode||surface.elevationMode==='terrain'?terrainTriangleHeight(site,point):compileSurface(surface).height(point);
}
export type CompiledSurface=ReturnType<typeof compileSurface>;

/** Non-destructive, order-independent cut/fill. A one-cell hard shoulder makes
 * all terrain triangles under a flat court agree with its target elevation. */
export function gradeHeightfield(site:SurfaceSite,surfaces:CompiledSurface[],water?:(point:PathPoint)=>boolean):Heightfield{
  if(!surfaces.length)return site.terrain;
  const pad=terrainCellDiagonal(site)*1.01,field=site.terrain,heights=[...field.heights];
  for(const {surface,bounds} of surfaces){
    const width=surface.gradingWidth!;
    if(width<pad+.25)throw new Error(`Use a grading transition of at least ${Math.ceil((pad+.25)*10)/10} m for this terrain grid.`);
    if(bounds.minX-width < -site.width/2||bounds.maxX+width>site.width/2||bounds.minZ-width < -site.depth/2||bounds.maxZ+width>site.depth/2)throw new Error('Keep the complete grading transition inside the site.');
  }
  for(let i=0;i<surfaces.length;i++)for(let j=0;j<i;j++){
    const a=surfaces[i],b=surfaces[j];if(a.bounds.minX>=b.bounds.maxX||a.bounds.maxX<=b.bounds.minX||a.bounds.minZ>=b.bounds.maxZ||a.bounds.maxZ<=b.bounds.minZ)continue;
    const ap=a.surface.width!==undefined?a.polygons:regionTriangles(a.surface.points),bp=b.surface.width!==undefined?b.polygons:regionTriangles(b.surface.points);
    for(const x of ap)for(const y of bp){const overlap=clipPathPolygon(x,y);if(polygonArea(overlap)<1e-8)continue;
      const center:PathPoint=[overlap.reduce((s,p)=>s+p[0],0)/overlap.length,overlap.reduce((s,p)=>s+p[1],0)/overlap.length];
      if([...overlap,center].some(p=>Math.abs(a.height(p)-b.height(p))>.015))throw new Error('Overlapping grades need matching elevations. Adjust their heights, shorten the path, or separate their boundaries.');
    }
  }
  for(let row=0;row<field.rows;row++)for(let col=0;col<field.columns;col++){
    const point:PathPoint=[col*site.width/(field.columns-1)-site.width/2,row*site.depth/(field.rows-1)-site.depth/2];
    let sum=0,weight=0,maximum=0,hardSum=0,hardCount=0,padSum=0,padCount=0;
    for(const grade of surfaces){
      const width=grade.surface.gradingWidth!,b=grade.bounds;
      if(point[0]<b.minX-width||point[0]>b.maxX+width||point[1]<b.minZ-width||point[1]>b.maxZ+width)continue;
      const distance=grade.distance(point);if(distance>=width)continue;
      if(water?.(point))throw new Error('Keep grading and its transition clear of water and banks. Use fixed elevations for a surface without terrain changes.');
      const t=Math.max(0,Math.min(1,(width-distance)/(width-pad))),w=t*t*(3-2*t),target=grade.height(point);
      // An authored footprint takes precedence over another grade's sampled
      // shoulder. This lets a sloping approach meet a level courtyard edge.
      if(w>=1-1e-9){if(distance<=1e-8){hardSum+=target;hardCount++;}else{padSum+=target;padCount++;}}
      sum+=target*w;weight+=w;maximum=Math.max(maximum,w);
    }
    const index=row*field.columns+col;
    if(weight)heights[index]=hardCount?hardSum/hardCount:padCount?padSum/padCount:field.heights[index]+(sum/weight-field.heights[index])*maximum;
  }
  return {...field,heights};
}
