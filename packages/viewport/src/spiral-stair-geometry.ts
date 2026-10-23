import * as THREE from 'three';
import {spiralPoint,spiralSweep,type Slab} from '@openlandcraft/core';

/** One closed stepped annular solid with a continuous helical underside and an open center. */
export function buildSpiralStairGeometry(part:Slab):THREE.BufferGeometry{
  const stairs=part.stairs!,spiral=stairs.spiral!,outer=spiral.radius,inner=outer-part.width,vertices:number[]=[],reverse=spiral.clockwise;
  type Point=[number,number,number];
  const p=(r:number,t:number,y:number):Point=>{const [x,z]=spiralPoint(part,t,r);return [x,part.elevation+y,z];};
  const quad=(a:Point,b:Point,c:Point,d:Point)=>{for(const q of reverse?[a,c,b,a,d,c]:[a,b,c,a,c,d])vertices.push(...q);};
  const stepRise=stairs.rise/stairs.steps,segments=Math.max(1,Math.ceil(Math.abs(spiralSweep(part))*180/Math.PI/stairs.steps/3));
  for(let i=0;i<stairs.steps;i++){
    const top=(i+1)*stepRise;
    for(let j=0;j<segments;j++){
      const a=(i+j/segments)/stairs.steps,b=(i+(j+1)/segments)/stairs.steps,ya=stairs.rise*a-part.thickness,yb=stairs.rise*b-part.thickness;
      quad(p(inner,a,top),p(inner,b,top),p(outer,b,top),p(outer,a,top));
      quad(p(inner,a,ya),p(outer,a,ya),p(outer,b,yb),p(inner,b,yb));
      quad(p(outer,a,ya),p(outer,a,top),p(outer,b,top),p(outer,b,yb));
      quad(p(inner,a,ya),p(inner,b,yb),p(inner,b,top),p(inner,a,top));
    }
    const t=i/stairs.steps,bottom=i===0?-part.thickness:i*stepRise;
    quad(p(inner,t,bottom),p(inner,t,top),p(outer,t,top),p(outer,t,bottom));
  }
  quad(p(inner,1,stairs.rise-part.thickness),p(outer,1,stairs.rise-part.thickness),p(outer,1,stairs.rise),p(inner,1,stairs.rise));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
