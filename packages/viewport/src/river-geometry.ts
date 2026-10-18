import * as THREE from 'three';
import type { RiverField } from './river-water';

export function riverGeometry(field:RiverField,wavelength:number,quality:'high'|'low') {
  const f=field,subdivisions=Math.min(8,Math.max(1,Math.ceil(f.ds/(wavelength/(quality==='high'?16:6)))));
  const rows=(f.rows-1)*subdivisions+1,across=quality==='high'?f.columns-1:(f.columns-1)/2;
  const positions:number[]=[],uv:number[]=[],flow:number[]=[],profile:number[]=[],indices:number[]=[];
  for(let r=0;r<rows;r++) {
    const row=r/subdivisions,a=Math.min(f.rows-2,Math.floor(row)),b=a+1,t=row-a;
    for(let c=0;c<=across;c++) {
      const column=c*(f.columns-1)/across,i=a*f.columns+column,j=b*f.columns+column;
      for(let k=0;k<3;k++)positions.push(f.positions[i*3+k]*(1-t)+f.positions[j*3+k]*t);
      for(let k=0;k<2;k++)flow.push(f.flow[a*2+k]*(1-t)+f.flow[b*2+k]*t);
      for(let k=0;k<4;k++)profile.push(f.profile[a*4+k]*(1-t)+f.profile[b*4+k]*t);
      uv.push(c/across,r/(rows-1));
      if(r<rows-1&&c<across){const v=r*(across+1)+c,n=v+across+1;indices.push(v,n,v+1,v+1,n,n+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('flow',new THREE.Float32BufferAttribute(flow,2));geometry.setAttribute('riverProfile',new THREE.Float32BufferAttribute(profile,4));
  geometry.setIndex(indices);geometry.computeBoundingSphere();if(geometry.boundingSphere)geometry.boundingSphere.radius+=2;
  geometry.userData.riverRows=rows;geometry.userData.riverAcross=across;geometry.userData.riverSubdivisions=subdivisions;
  return geometry;
}

export function riverPickGeometry(field:RiverField) {
  const positions:number[]=[],indices:number[]=[];
  for(let r=0;r<field.rows;r++) {
    for(const c of [0,field.columns-1]){const i=(r*field.columns+c)*3;positions.push(field.positions[i],field.positions[i+1],field.positions[i+2]);}
    if(r<field.rows-1){const i=r*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}

/** Bed edits alter phase/boost, but not the channel's authored surface mesh. */
export function updateRiverProfile(geometry:THREE.BufferGeometry,field:RiverField) {
  const rows=geometry.userData.riverRows as number,across=geometry.userData.riverAcross as number,subdivisions=geometry.userData.riverSubdivisions as number;
  const profile=geometry.getAttribute('riverProfile') as THREE.BufferAttribute;
  for(let r=0;r<rows;r++) {
    const row=r/subdivisions,a=Math.min(field.rows-2,Math.floor(row)),b=a+1,t=row-a;
    const values=[0,1,2,3].map(k=>field.profile[a*4+k]*(1-t)+field.profile[b*4+k]*t);
    for(let c=0;c<=across;c++)profile.setXYZW(r*(across+1)+c,values[0],values[1],values[2],values[3]);
  }
  profile.needsUpdate=true;
}
