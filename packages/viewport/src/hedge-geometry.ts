import * as THREE from 'three';
import {hedgeRoute,hedgeStrips} from '@openlandcraft/landscape';
import {hedgeTop,type Hedge,type Project} from '@openlandcraft/core';
import {buildPathMesh,PATH_LIFT} from './path-geometry';
/** A closed trimmed volume, with bottom/side edges following terrain triangles. */
export function buildHedgeGeometry(hedge:Hedge,site:Project['site']){
 const strips=hedgeStrips(hedge),top=buildPathMesh({points:hedgeRoute(hedge),width:hedge.width,surface:'gravel'},site,strips.map((points,segment)=>({points,segment}))),p=top.geometry.getAttribute('position'),positions:number[]=[],edges=new Map<string,{a:number;b:number;count:number}>();
 const key=(i:number)=>`${Math.round(p.getX(i)*1e5)}:${Math.round(p.getZ(i)*1e5)}`;
 const at=(i:number,upper:boolean):[number,number,number]=>[p.getX(i),upper?hedgeTop(hedge,site,[p.getX(i),p.getZ(i)]):p.getY(i)-PATH_LIFT-.08,p.getZ(i)];
 for(let i=0;i<p.count;i+=3){
  const area=(p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getX(i+2)-p.getX(i));if(Math.abs(area)<1e-9)continue;
  for(const j of [i,i+1,i+2])positions.push(...at(j,true));
  for(const j of [i+2,i+1,i])positions.push(...at(j,false));
  for(let n=0;n<3;n++){const a=i+n,b=i+(n+1)%3,ka=key(a),kb=key(b),k=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`,edge=edges.get(k);if(edge)edge.count++;else edges.set(k,{a,b,count:1});}
 }
 let boundaryEdges=0;
 for(const {a,b,count} of edges.values())if(count===1){boundaryEdges++;const A=at(a,true),B=at(b,true),C=at(a,false),D=at(b,false);positions.push(...B,...A,...C,...B,...C,...D);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.boundaryEdges=boundaryEdges;geometry.userData.topTriangles=p.count/3;top.geometry.dispose();return geometry;
}
export function hedgeMaterial(hedge:Pick<Hedge,'color'|'leafSize'|'roughness'>){
 const material=new THREE.MeshStandardMaterial({color:hedge.color,roughness:hedge.roughness});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vHedgePoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHedgePoint=position;');
  shader.fragmentShader='varying vec3 vHedgePoint;\nfloat hedgeHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 leafPoint=vHedgePoint/${hedge.leafSize.toFixed(4)};
   vec3 cell=floor(leafPoint);float leaf=hedgeHash(cell),fine=hedgeHash(floor(leafPoint*3.0));
   float fade=smoothstep(0.3,1.5,max(length(dFdx(leafPoint)),length(dFdy(leafPoint))));
   diffuseColor.rgb*=mix(0.72+leaf*0.45+fine*0.16,1.0,fade);
  `);
 };
 material.customProgramCacheKey=()=>`clipped-hedge-${hedge.leafSize}`;return material;
}
