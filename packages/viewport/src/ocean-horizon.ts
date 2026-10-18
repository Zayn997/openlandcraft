import * as THREE from 'three';

/** Dense next to the site, sparse at the horizon. Rendering only; never authored terrain. */
export function oceanHorizonGeometry(width: number, depth: number): THREE.BufferGeometry {
  const axis = (extent: number) => {
    const outer = Array.from({length:32},(_,i)=>0.6*(Math.pow(1.28,i+1)-1)/0.28);
    return [...[...outer].reverse().map((d)=>-extent/2-d),...Array.from({length:65},(_,i)=>(i/64-0.5)*extent),...outer.map((d)=>extent/2+d)];
  };
  const xs=axis(width),zs=axis(depth),positions:number[]=[],indices:number[]=[];
  zs.forEach((z)=>xs.forEach((x)=>positions.push(x,0,z)));
  for(let z=0;z<zs.length-1;z++) for(let x=0;x<xs.length-1;x++) {
    // The existing water mesh owns the complete authored site rectangle.
    if(x>=32 && x<96 && z>=32 && z<96) continue;
    const a=z*xs.length+x,b=a+1,c=a+xs.length,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}
