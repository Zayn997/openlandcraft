import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {ARCHITECTURAL_MATERIAL_DEFAULTS,architecturalMaterials,insetOpening,openingSamples,openingTop,type Opening,type Project,type Wall} from '@openlandcraft/core';
import {wallSurfaceBuilder} from './wall-profile-geometry';
import {ArchitecturalSurface} from './architectural-material';

export type OpeningComponent='frame'|'panel'|'glass';
export function openingInnerProfile(o:Opening):Opening{const border=o.joinery?.frame?.width??0;return insetOpening(o,border,o.kind==='window'?border:0);}
export function buildOpeningComponentGeometry(w:Wall,o:Opening,component:OpeningComponent):THREE.BufferGeometry{
 const j=o.joinery,config=j?.[component],{quad,p,finish}=wallSurfaceBuilder(w,[w],true);if(!config)return finish();
 const inner=openingInnerProfile(o),outer=component==='frame'?o:insetOpening(inner,.012,.012),cut=component==='frame'?inner:null;
 const depth=Math.min(w.thickness,component==='frame'?j!.frame!.depth:component==='panel'?j!.panel!.thickness:j!.glass!.thickness),half=depth/2;
 const samples=[...openingSamples(outer),...(cut?openingSamples(cut):[])];
 if(w.curve){const count=Math.max(1,Math.ceil(outer.width/w.curve.radius/(Math.PI/60)));for(let i=1;i<count;i++)samples.push(outer.offset+outer.width*i/count);}
 const xs=[...new Set(samples)].sort((a,b)=>a-b);
 const band=(a:number,b:number,loA:number,loB:number,hiA:number,hiB:number)=>{
  if(hiA-loA<1e-9&&hiB-loB<1e-9)return;
  for(const side of [-half,half])quad([p(a,loA,side),p(b,loB,side),p(b,hiB,side),p(a,hiA,side)],side<0);
  quad([p(a,loA,-half),p(b,loB,-half),p(b,loB,half),p(a,loA,half)]);
  quad([p(a,hiA,-half),p(b,hiB,-half),p(b,hiB,half),p(a,hiA,half)],true);
 };
 for(let i=1;i<xs.length;i++){
  const a=xs[i-1],b=xs[i];if(b-a<1e-9)continue;const inCut=cut&&(a+b)/2>cut.offset&&(a+b)/2<cut.offset+cut.width;
  if(inCut){band(a,b,outer.sill,outer.sill,cut.sill,cut.sill);band(a,b,openingTop(cut,a),openingTop(cut,b),openingTop(outer,a),openingTop(outer,b));}
  else band(a,b,outer.sill,outer.sill,openingTop(outer,a),openingTop(outer,b));
 }
 const cap=(x:number,lo:number,hi:number,reverse:boolean)=>quad([p(x,lo,-half),p(x,lo,half),p(x,hi,half),p(x,hi,-half)],reverse);
 cap(outer.offset,outer.sill,openingTop(outer,outer.offset),false);cap(outer.offset+outer.width,outer.sill,openingTop(outer,outer.offset+outer.width),true);
 if(cut){cap(cut.offset,cut.sill,openingTop(cut,cut.offset),true);cap(cut.offset+cut.width,cut.sill,openingTop(cut,cut.offset+cut.width),false);}
 return finish();
}
const noRaycast=()=>undefined;
function ComponentMesh({wall,opening,component,project}:{wall:Wall;opening:Opening;component:OpeningComponent;project:Project}){
 const config=opening.joinery![component]!,geometry=useMemo(()=>buildOpeningComponentGeometry(wall,opening,component),[wall,opening,component]);useEffect(()=>()=>geometry.dispose(),[geometry]);
 const materialId='materialId' in config?config.materialId:undefined,shared=materialId?architecturalMaterials(project).find(m=>m.id===materialId):undefined;
 const timber={...ARCHITECTURAL_MATERIAL_DEFAULTS[1],color:config.color};
 return <mesh geometry={geometry} raycast={noRaycast} castShadow={component!=='glass'} receiveShadow userData={{copyEntityId:wall.id,copyOpeningId:opening.id}}>
  {component==='glass'?<meshStandardMaterial color={config.color} roughness={.12} metalness={.05} transparent opacity={opening.joinery!.glass!.opacity} depthWrite={false}/>:<ArchitecturalSurface definition={shared??timber} color={config.color}/>}
 </mesh>;
}
/** Hosted components share the opening's selection, history and wall path. */
export function OpeningJoineryMeshes({wall,project}:{wall:Wall;project:Project}){
 return <>{wall.openings?.flatMap(opening=>(['frame','panel','glass'] as const).filter(component=>!!opening.joinery?.[component]).map(component=><ComponentMesh key={opening.id+'-'+component} wall={wall} opening={opening} component={component} project={project}/>))}</>;
}
