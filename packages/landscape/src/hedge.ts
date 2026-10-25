import {clipPathPolygon,pathLength,pathStrips,polygonArea,type PathPoint} from './path';
import {roundedRoutePoints} from './rounded-route';
import type {TerrainBounds} from './index';
export type HedgeShape={points:PathPoint[];width:number;closed:boolean;rounding:number;cornerRounding?:number[]};
/** Keep the appearance of format-38 runs until a corner is edited individually. */
export function hedgeCornerAmounts(hedge:HedgeShape):number[]{return hedge.cornerRounding??hedge.points.map((_,i)=>hedge.closed||i===0||i===hedge.points.length-1?0:hedge.rounding);}
export function hedgeRoute(hedge:HedgeShape):PathPoint[]{
 return roundedRoutePoints({...hedge,cornerRounding:hedgeCornerAmounts(hedge)});
}
export function hedgeStrips(hedge:HedgeShape):PathPoint[][]{
 const points=hedgeRoute(hedge);return hedge.closed?pathStrips({points:[points.at(-2)!,...points,points[1]],width:hedge.width}).slice(1,-1):pathStrips({points,width:hedge.width});
}
export function hedgeShapeIssue(hedge:HedgeShape,site:TerrainBounds):string|null{
 const {points,width,closed}=hedge,n=points.length;if(closed&&n<3)return 'A closed hedge needs at least three different corners.';
 if(closed&&hedge.rounding!==0)return 'Set rounding at the closed hedge’s individual anchors.';
 const route=closed?[...points,points[0]]:points;
 if(pathLength(route)>250)return 'Keep each hedge run within 250 m.';
 for(let i=0;i<route.length-1;i++)if(Math.hypot(route[i+1][0]-route[i][0],route[i+1][1]-route[i][1])<1)return 'Keep adjacent hedge points at least 1 m apart.';
 for(let i=closed?0:1;i<(closed?n:n-1);i++){
  const a=points[(i+n-1)%n],b=points[i],c=points[(i+1)%n],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];
  if((u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1)<-.5)return 'Spread hedge corners to avoid turns sharper than 120 degrees.';
 }
 const strips=hedgeStrips(hedge),boxes=strips.map(s=>({minX:Math.min(...s.map(p=>p[0])),maxX:Math.max(...s.map(p=>p[0])),minZ:Math.min(...s.map(p=>p[1])),maxZ:Math.max(...s.map(p=>p[1]))})),cross=(a:PathPoint,b:PathPoint,c:PathPoint)=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
 for(let i=0;i<strips.length;i++){
  const s=strips[i];if(s.some(p=>Math.abs(p[0])>site.width/2+1e-8||Math.abs(p[1])>site.depth/2+1e-8))return 'Keep the complete hedge width inside the site.';
  if(s.some((p,j)=>cross(p,s[(j+1)%4],s[(j+2)%4])<=1e-8))return 'The hedge is too wide for these corners. Narrow it or spread the points.';
  for(let j=0;j<i;j++){if(boxes[i].maxX<=boxes[j].minX||boxes[i].minX>=boxes[j].maxX||boxes[i].maxZ<=boxes[j].minZ||boxes[i].minZ>=boxes[j].maxZ)continue;if(polygonArea(clipPathPolygon(s,strips[j]))>1e-6)return 'A hedge run cannot cross or overlap itself. Move its corners or split it into separate runs.';}
 }
 return null;
}
