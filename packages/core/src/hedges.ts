import {hedgeShapeIssue,hedgeStrips,clipPathPolygon,lakeWaterDistance,pointSegmentDistance,sampleRiver,terrainTriangleHeight,type PathPoint} from '@openlandcraft/landscape';
import {type Hedge,type Project} from './model';
import {gradedTerrain} from './site-grading';
export const ROUND_HEDGE_GESTURE='Round hedge corner';
export function createHedge(project:Project,points?:PathPoint[]):Hedge{
 return {id:crypto.randomUUID(),parentId:'site',kind:'hedge',name:'Clipped hedge run',visible:true,points:points??[[-project.site.width*.2,-project.site.depth*.2],[project.site.width*.2,-project.site.depth*.2]],width:.8,height:1.5,closed:false,rounding:0,topMode:'terrain',color:'#426a35',leafSize:.1,roughness:.9};
}
export function hedgeTop(hedge:Hedge,site:Project['site'],p:PathPoint){return hedge.topMode==='level'?hedge.topElevation!:terrainTriangleHeight(site,p)+hedge.height;}
export function hedgeIssue(hedge:Hedge,project:Project):string|null{
 const issue=hedgeShapeIssue(hedge,project.site);if(issue)return issue;
 const strips=hedgeStrips(hedge),terrain=gradedTerrain(project),site={...project.site,terrain},waters=project.entities.filter(e=>e.kind==='lake'||e.kind==='ocean'||e.kind==='river'),rivers=waters.filter(e=>e.kind==='river').map(e=>({river:e,points:sampleRiver(e.points)}));
 if(hedge.topMode==='terrain'&&!waters.length)return null;
 const check=(p:PathPoint):string|null=>{
  const ground=terrainTriangleHeight(site,p),height=hedgeTop(hedge,site,p)-ground;
  if(height<.3-1e-6||height>5+1e-6)return 'Keep a level hedge top between 0.3 and 5 m above all ground under the run. Adjust the top elevation or terrain.';
  for(const water of waters){
   if(water.kind==='lake'&&lakeWaterDistance(water,...p)>-water.bank-.05)return 'Keep hedge roots clear of lake/moat water and bank blends.';
   if(water.kind==='ocean'&&ground<=water.level+2*water.amplitude+.1)return 'Keep hedge roots on dry ground above ocean water and waves.';
  }
  if(rivers.some(({river,points})=>points.some((v,i)=>i>0&&pointSegmentDistance(p,[points[i-1].x,points[i-1].z],[v.x,v.z])<=river.width/2+river.bank)))return 'Keep hedge roots clear of the river and its bank blend.';
  return null;
 };
 // Dense edge samples check water clearance. Exact intersections with terrain
 // triangles bound every ground extremum under a level clipped top.
 const cell=Math.min(site.width/(terrain.columns-1),site.depth/(terrain.rows-1)),step=Math.min(.25,cell/2);
 for(const s of strips){
  for(const [a,b] of [[s[0],s[1]],[s[1],s[2]],[s[2],s[3]],[s[3],s[0]],[s[0],s[2]]]){const count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let i=0;i<=count;i++){const q:PathPoint=[a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count],error=check(q);if(error)return error;}}
  const dx=site.width/(terrain.columns-1),dz=site.depth/(terrain.rows-1),minC=Math.max(0,Math.floor((Math.min(...s.map(p=>p[0]))+site.width/2)/dx)),maxC=Math.min(terrain.columns-1,Math.ceil((Math.max(...s.map(p=>p[0]))+site.width/2)/dx)),minR=Math.max(0,Math.floor((Math.min(...s.map(p=>p[1]))+site.depth/2)/dz)),maxR=Math.min(terrain.rows-1,Math.ceil((Math.max(...s.map(p=>p[1]))+site.depth/2)/dz));
  for(let r=minR;r<=Math.min(terrain.rows-2,maxR);r++)for(let c=minC;c<=Math.min(terrain.columns-2,maxC);c++){
   const x=c*dx-site.width/2,z=r*dz-site.depth/2,a:PathPoint=[x,z],b:PathPoint=[x+dx,z],d:PathPoint=[x,z+dz],e:PathPoint=[x+dx,z+dz];
   for(const triangle of [[a,b,d],[b,e,d]])for(const p of clipPathPolygon(s,triangle)){const error=check(p);if(error)return error;}
  }
 }
 return null;
}
