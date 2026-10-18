import { sampleHeight } from '@openlandcraft/landscape';
import type { Ocean, Project } from '@openlandcraft/core';

/** Locate a real sea-level contour; prefer an open coast over a narrow river channel. */
export function shoreCamera(site: Project['site'], ocean: Ocean): { position: [number, number, number]; target: [number, number, number] } {
  const { columns, rows, heights } = site.terrain;
  const dx = site.width/(columns-1), dz = site.depth/(rows-1);
  let best = Infinity, shore: [number, number] = [0,0], normal: [number, number] = [-Math.cos(ocean.direction*Math.PI/180),-Math.sin(ocean.direction*Math.PI/180)];
  const height = (x: number,z: number) => sampleHeight(site.terrain,site,x,z);
  for (let row=2;row<rows-3;row++) for (let col=2;col<columns-3;col++) {
    const index = row*columns+col, a=heights[index]-ocean.level;
    for (const [offset,ox,oz] of [[1,dx,0],[columns,0,dz]]) {
      const b=heights[index+offset]-ocean.level;
      if (a*b>0 || Math.abs(a-b)<0.0001) continue;
      const t=a/(a-b), x=col*dx-site.width/2+ox*t, z=row*dz-site.depth/2+oz*t;
      const gx=height(x+0.4,z)-height(x-0.4,z), gz=height(x,z+0.4)-height(x,z-0.4), length=Math.hypot(gx,gz);
      if (length<0.001) continue;
      const nx=-gx/length,nz=-gz/length;
      const score=x*x+(z+site.depth*0.12)**2 + Math.max(0,height(x+nx*8,z+nz*8)-ocean.level+0.5)*site.width*site.width;
      if (score<best) { best=score;shore=[x,z];normal=[nx,nz]; }
    }
  }
  const span=Math.min(1,site.width/60,site.depth/45), [x,z]=shore,[nx,nz]=normal;
  const px=Math.max(-site.width*0.46,Math.min(site.width*0.46,x-nx*2+nz*-8*span));
  const pz=Math.max(-site.depth*0.46,Math.min(site.depth*0.46,z-nz*2+nx*8*span));
  return { position:[px,Math.max(ocean.level+1.7,ocean.level+ocean.amplitude*1.8+0.3,height(px,pz)+1.6),pz],target:[x+nx*12*span+nz*24*span,ocean.level+0.3,z+nz*12*span-nx*24*span] };
}
