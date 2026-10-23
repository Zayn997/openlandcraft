import * as THREE from 'three';
import {RAILING_SECTION,railingRuns,type RailingHost,type RailingPoint} from '@openlandcraft/core';

/** Combine solid pieces while retaining normals, picking, UVs and a single host mesh. */
export function mergeSolidGeometry(pieces:THREE.BufferGeometry[]):THREE.BufferGeometry{
  const geometry=new THREE.BufferGeometry(),solids=pieces.map(g=>g.index?g.toNonIndexed():g);
  for(const [name,size] of [['position',3],['normal',3],['uv',2]] as const){
    const array=new Float32Array(solids.reduce((n,g)=>n+g.getAttribute('position').count,0)*size);let offset=0;
    for(const g of solids){const attribute=g.getAttribute(name);if(attribute)array.set(attribute.array,offset);offset+=g.getAttribute('position').count*size;}
    geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
  }
  new Set([...solids,...pieces]).forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function buildRailingGeometry(host:RailingHost):THREE.BufferGeometry{
  const runs=railingRuns(host),pieces:THREE.BufferGeometry[]=[],height=(host.kind==='wall'?host.walk?.railings:host.stairs?.railings)?.height??0;
  const beam=(a:RailingPoint,b:RailingPoint)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start),length=direction.length();if(length<1e-8)return;
    const geometry=new THREE.CylinderGeometry(RAILING_SECTION/2,RAILING_SECTION/2,length,8,1,false);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.divideScalar(length)));geometry.translate(...start.add(end).multiplyScalar(.5).toArray());pieces.push(geometry);
  };
  for(const run of runs){
    for(const post of run.posts)beam(post.base,post.top);
    for(let i=1;i<run.top.length;i++)for(const drop of [RAILING_SECTION/2,height/2]){
      const a=run.top[i-1],b=run.top[i];beam([a[0],a[1]-drop,a[2]],[b[0],b[1]-drop,b[2]]);
    }
  }
  return mergeSolidGeometry(pieces);
}
