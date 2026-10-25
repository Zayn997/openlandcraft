import {compileSurface,gradeHeightfield,terrainTriangleHeight,sampleRiver,pointSegmentDistance,lakeWaterDistance,surfaceElevationAt,type PathPoint,type Heightfield} from '@openlandcraft/landscape';
import type {Project,Path,MaterialRegion} from './model';
import {objectLayerState} from './layers';

export const isSiteSurface=(e:Project['entities'][number]):e is Path|MaterialRegion=>e.kind==='path'||e.kind==='materialRegion'&&e.surface==='paving';
/** Graded and following surfaces share the evaluated ground for junctions.
 * Fixed surfaces join only when their independent heights agree. */
export function gardenSurfaceHeights(p:Project){
  const heights=new Map<string,(point:PathPoint)=>number>();
  for(const e of p.entities.filter(isSiteSurface))heights.set(e.id,e.elevationMode==='fixed'?(q=>surfaceElevationAt(e,p.site,q)):q=>terrainTriangleHeight(p.site,q));
  return (id:string,q:PathPoint)=>heights.get(id)?.(q)??terrainTriangleHeight(p.site,q);
}
const grades=(p:Project)=>p.entities.filter(isSiteSurface).filter(e=>e.elevationMode==='graded'&&e.visible&&objectLayerState(p,e.id).visible);
export function gradingSignature(p:Project){return JSON.stringify(grades(p).map(e=>({id:e.id,points:e.points,width:e.kind==='path'?e.width:undefined,cornerRounding:e.kind==='path'?e.cornerRounding:undefined,elevation:e.elevation,endElevation:e.endElevation,gradingWidth:e.gradingWidth})).sort((a,b)=>a.id.localeCompare(b.id)));}
const fields=new WeakMap<Heightfield,{key:string;field:Heightfield;validated?:string}>();
export function gradedTerrain(p:Project,validateWater=false):Heightfield{
  const surfaces=grades(p);if(!surfaces.length)return p.site.terrain;
  const key=JSON.stringify([p.site.width,p.site.depth,gradingSignature(p)]);
  const waterKey=validateWater?JSON.stringify(p.entities.filter(e=>e.visible&&(e.kind==='ocean'||e.kind==='river'||e.kind==='lake'))):undefined;
  const cached=fields.get(p.site.terrain);if(cached?.key===key&&(!validateWater||cached.validated===waterKey))return cached.field;
  const tests:((point:PathPoint)=>boolean)[]=[];
  if(validateWater)for(const e of p.entities){
    if(!e.visible)continue;
    if(e.kind==='lake')tests.push(q=>lakeWaterDistance(e,...q)>=-e.bank);
    if(e.kind==='river'){const samples=sampleRiver(e.points);tests.push(q=>samples.some((v,i)=>i>0&&pointSegmentDistance(q,[samples[i-1].x,samples[i-1].z],[v.x,v.z])<=e.width/2+e.bank));}
    if(e.kind==='ocean')tests.push(q=>terrainTriangleHeight(p.site,q)<=e.level+e.amplitude+.1);
  }
  const field=gradeHeightfield(p.site,surfaces.map(compileSurface),tests.length?q=>tests.some(test=>test(q)):undefined);
  if(validateWater){const sea=p.entities.find(e=>e.kind==='ocean'&&e.visible);if(sea?.kind==='ocean'&&field.heights.some((height,i)=>height!==p.site.terrain.heights[i]&&height<=sea.level+sea.amplitude+.1))throw new Error('This grade reaches ocean water level. Raise its elevation or move it away from the shore.');}
  fields.set(p.site.terrain,{key,field,validated:waterKey});return field;
}
