import {footprint} from './architecture';
import {lakeDistance,pointSegmentDistance,polygonArea,pathStrips,sampleRiver,type PathPoint} from '@openlandcraft/landscape';
import {groundHeight,parseProject,type Entity,type Instance,type MaterialRegion,type PlantingRegion,type Project,type Region} from './model';
import {evaluateProject} from './surface';

export const REGION_SURFACES={grass:{color:'#75875b',roughness:0.95},sand:{color:'#c8b992',roughness:0.95},rock:{color:'#898b81',roughness:0.85},gravel:{color:'#b4a48a',roughness:0.98}} as const;
export function createRegion(project:Project,type:'material'|'planting',points?:PathPoint[]):Region {
  const x=-project.site.width*0.3,z=project.site.depth*0.25,r=Math.min(10,project.site.width*0.12,project.site.depth*0.12);
  const common={id:crypto.randomUUID(),parentId:'site' as const,visible:true,points:points??[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]] as PathPoint[]};
  if(type==='material')return {...common,kind:'materialRegion',name:'Surface region',surface:'gravel',...REGION_SURFACES.gravel,detailScale:1};
  if(!project.assets.length)throw new Error('Import a model or add a Demo tree before creating a planting region.');
  return {...common,kind:'plantingRegion',name:'Planting region',assetId:project.assets[0].id,seed:42,density:8,scaleMin:0.7,scaleMax:1.2,spacing:2.5,clearance:1,exclusions:{water:true,paths:true,buildings:true}};
}

/** Compile obstacle queries once per explicit regeneration, never per animation frame. Hidden obstacles reserve space too. */
export function plantingObstacle(project:Project,region:PlantingRegion):(x:number,z:number)=>boolean {
  const tests:((x:number,z:number)=>boolean)[]=[],margin=region.clearance;
  for(const e of project.entities){
    if(region.exclusions.water&&e.kind==='lake')tests.push((x,z)=>lakeDistance(e.points,x,z)>=-e.bank-margin);
    if(region.exclusions.water&&e.kind==='ocean')tests.push((x,z)=>groundHeight(x,z,project.site)<=e.level+e.amplitude+0.1+margin*0.1);
    if(region.exclusions.water&&e.kind==='river'){
      const samples=sampleRiver(e.points);tests.push((x,z)=>samples.some((p,i)=>i>0&&pointSegmentDistance([x,z],[samples[i-1].x,samples[i-1].z],[p.x,p.z])<=e.width/2+e.bank+margin));
    }
    if(region.exclusions.paths&&e.kind==='path'){const strips=pathStrips(e);tests.push((x,z)=>strips.some(p=>lakeDistance(p,x,z)>=-margin));}
    if(region.exclusions.buildings&&(e.kind==='block'||e.kind==='wall'||e.kind==='slab'||e.kind==='roof')){
      const origin=e.kind==='block'?e:project.entities.find(p=>p.kind==='level'&&p.id===e.parentId);
      if(!origin||!('position' in origin)||!('rotation' in origin))continue;
      const angle=origin.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
      tests.push((x,z)=>{
        const dx=x-origin.position[0],dz=z-origin.position[2],p:PathPoint=[dx*cos-dz*sin,dx*sin+dz*cos];
        if((e.kind==='slab'||e.kind==='roof')&&e.outline)return lakeDistance(footprint(e),p[0],p[1])>=-margin;
        if(e.kind==='wall')return pointSegmentDistance(p,e.start,e.end)<=e.thickness/2+margin;
        const center=e.kind==='block'?[0,0]:e.center,width=e.kind==='block'?e.size[0]:e.width,depth=e.kind==='block'?e.size[2]:e.depth;
        return Math.abs(p[0]-center[0])<=width/2+margin&&Math.abs(p[1]-center[1])<=depth/2+margin;
      });
    }
  }
  return (x,z)=>tests.some(test=>test(x,z));
}
export type PlantingResult={instances:Instance[];requested:number;target:number;attempts:number};
export function generatePlanting(project:Project,region:PlantingRegion):PlantingResult {
  // Validate parameters before using them as loop bounds or random state.
  const entities=project.entities.filter(e=>e.id!==region.id&&!(e.kind==='instance'&&e.regionId===region.id));
  const baseline=parseProject({...project,entities:[...entities,region],objectLayers:Object.fromEntries(Object.entries(project.objectLayers).filter(([id])=>id==='terrain'||id===region.id||entities.some(e=>e.id===id)))}),site=evaluateProject(baseline).site;
  const blocked=plantingObstacle({...baseline,site},region),occupied=entities.filter((e):e is Instance=>e.kind==='instance'),ids=new Set(entities.map(e=>e.id));
  const requested=Math.floor(polygonArea(region.points)*region.density/100),target=Math.min(200,requested),instances:Instance[]=[];
  const minX=Math.min(...region.points.map(p=>p[0])),maxX=Math.max(...region.points.map(p=>p[0])),minZ=Math.min(...region.points.map(p=>p[1])),maxZ=Math.max(...region.points.map(p=>p[1]));
  let state=region.seed>>>0,attempts=0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(;attempts<Math.max(100,target*60)&&instances.length<target;attempts++){
    const x=minX+random()*(maxX-minX),z=minZ+random()*(maxZ-minZ),scale=region.scaleMin+random()*(region.scaleMax-region.scaleMin),rotation=random()*360,id=`${region.id.slice(0,70)}:plant:${attempts}`;
    if(ids.has(id)||lakeDistance(region.points,x,z)<region.spacing/2||blocked(x,z))continue;
    if([...occupied,...instances].some(e=>Math.hypot(e.position[0]-x,e.position[2]-z)<region.spacing))continue;
    instances.push({id,kind:'instance',parentId:'site',name:`${region.name.slice(0,60)} ${attempts+1}`,visible:true,assetId:region.assetId,regionId:region.id,position:[x,0,z],rotation,scale:[scale,scale,scale],anchor:'terrain'});
  }
  if(entities.length+1+instances.length>1000)throw new Error('This planting preview exceeds the 1,000-entity scene budget. Reduce density or remove objects.');
  if(occupied.filter(e=>e.regionId).length+instances.length>500)throw new Error('This preview exceeds 500 generated plants across the scene. Reduce density.');
  return {instances,requested,target,attempts};
}

export function regeneratePlanting(project:Project,region:PlantingRegion):Project {
  const {instances}=generatePlanting(project,region);
  return {...project,entities:[...project.entities.filter(e=>e.id!==region.id&&!(e.kind==='instance'&&e.regionId===region.id)),region,...instances]};
}

export function detachedInstance(entity:Instance):Instance {const {regionId:_,...independent}=entity;return independent;}
export function plantingInstanceChanged(a:Instance,b:Instance){return a.name!==b.name||a.visible!==b.visible||a.assetId!==b.assetId||a.anchor!==b.anchor||a.rotation!==b.rotation||JSON.stringify(a.position)!==JSON.stringify(b.position)||JSON.stringify(a.scale)!==JSON.stringify(b.scale);}
export const isRegion=(entity:Entity):entity is Region=>entity.kind==='materialRegion'||entity.kind==='plantingRegion';


