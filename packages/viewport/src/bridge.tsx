import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {bridgeHeight,bridgeStation,terrainTriangleHeight} from '@openlandcraft/landscape';
import type {Path,Project} from '@openlandcraft/core';
import {PATH_LIFT} from './path-geometry';

/** Closed underside and sides; the path layer supplies the deck's top face. */
export function bridgeShell(path:Path,site:Project['site']){
  const b=path.bridge!,{length,tx,tz}=bridgeStation(path,path.points[0]),stations=[0,b.approachLength,length-b.approachLength,length],vertices:number[]=[];
  const at=(s:number,c:number,down=0):[number,number,number]=>{const x=path.points[0][0]+tx*s-tz*c,z=path.points[0][1]+tz*s+tx*c;return [x,bridgeHeight(path,site,[x,z])+PATH_LIFT-down,z];};
  const quad=(a:number[],b:number[],c:number[],d:number[])=>vertices.push(...a,...b,...c,...a,...c,...d);
  for(let i=1;i<stations.length;i++){
    const s=stations[i-1],e=stations[i],w=path.width/2,t=b.thickness;
    quad(at(s,-w,t),at(e,-w,t),at(e,w,t),at(s,w,t));
    quad(at(s,-w),at(e,-w),at(e,-w,t),at(s,-w,t));
    quad(at(e,w),at(s,w),at(s,w,t),at(e,w,t));
  }
  for(const s of [0,length])quad(at(s,-path.width/2),at(s,path.width/2),at(s,path.width/2,b.thickness),at(s,-path.width/2,b.thickness));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}
export function BridgeStructure({path,site,onSelect}:{path:Path;site:Project['site'];onSelect:()=>void}){
  const shell=useMemo(()=>bridgeShell(path,site),[path,site]);useEffect(()=>()=>shell.dispose(),[shell]);
  const b=path.bridge!,{length,tx,tz}=bridgeStation(path,path.points[0]),angle=-Math.atan2(tz,tx),stations=[0,b.approachLength,length-b.approachLength,length];
  const at=(s:number,c:number):[number,number,number]=>{const x=path.points[0][0]+tx*s-tz*c,z=path.points[0][1]+tz*s+tx*c;return [x,bridgeHeight(path,site,[x,z])+PATH_LIFT,z];};
  return <group onClick={e=>{if(e.delta<=4){e.stopPropagation();onSelect();}}}>
    <mesh geometry={shell} castShadow receiveShadow><meshStandardMaterial color={path.surface==='timber'?'#796044':'#9b9d96'} roughness={.9} side={THREE.DoubleSide}/></mesh>
    {[b.approachLength,length-b.approachLength].map((s,i)=>{const p=at(s,0),base=Math.min(...[-path.width/2,path.width/2].map(c=>{const q=at(s,c);return terrainTriangleHeight(site,[q[0],q[2]]);} ))-.3,top=path.elevation!-b.thickness+PATH_LIFT;return <mesh key={i} position={[p[0],(base+top)/2,p[2]]} rotation={[0,angle,0]} castShadow receiveShadow><boxGeometry args={[b.abutmentLength,Math.max(.1,top-base),path.width+.4]}/><meshStandardMaterial color="#92988c" roughness={.95}/></mesh>;})}
    {b.railingHeight>0&&[-1,1].map(side=><group key={side}>
      {Array.from({length:Math.ceil(length/1.5)+1},(_,i)=>i*length/Math.ceil(length/1.5)).map((s,i)=>{const p=at(s,side*(path.width/2-.08));return <mesh key={i} position={[p[0],p[1]+b.railingHeight/2,p[2]]} castShadow><boxGeometry args={[.12,b.railingHeight,.12]}/><meshStandardMaterial color="#65533c"/></mesh>;})}
      {stations.slice(1).map((s,i)=>{const a=new THREE.Vector3(...at(stations[i],side*(path.width/2-.08))),end=new THREE.Vector3(...at(s,side*(path.width/2-.08)));a.y+=b.railingHeight;end.y+=b.railingHeight;const vector=end.clone().sub(a),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),vector.clone().normalize());return <mesh key={i} position={a.clone().add(end).multiplyScalar(.5)} quaternion={q} castShadow><boxGeometry args={[.14,.14,vector.length()]}/><meshStandardMaterial color="#65533c"/></mesh>;})}
    </group>)}
  </group>;
}
