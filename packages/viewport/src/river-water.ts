import { groundHeight, type Project, type River } from '@openlandcraft/core';
import { sampleRiver } from '@openlandcraft/landscape';
import { coastalWave } from './coastal-waves';
import { smooth } from './coast';

const clamp = (x:number,a=0,b=1) => Math.max(a,Math.min(b,x));
export type RiverField = ReturnType<typeof buildRiverField>;

/** Channel coordinates turn the shared wave engine around bends. All depths use evaluated ground. */
export function buildRiverField(site:Project['site'],river:River) {
  const path=sampleRiver(river.points), length=path.at(-1)!.along;
  const reach=river.width/2+Math.min(river.bank,0.75+river.water.amplitude*1.5);
  const rows=Math.min(385,Math.max(17,Math.ceil(length/0.5)+1));
  const columns=Math.min(25,Math.max(17,Math.ceil(reach/0.25)*2+1));
  const ds=length/(rows-1),dc=reach*2/(columns-1),n=rows*columns;
  const positions=new Float32Array(n*3),flow=new Float32Array(rows*2),profile=new Float32Array(rows*4);
  const depths=new Float32Array(n),velocity=new Float32Array(n),lateral=new Float32Array(n),shear=new Float32Array(n);
  const k=2*Math.PI/river.water.wavelength,omega=Math.sqrt(9.81*k),deepSpeed=omega/k;
  let segment=0,phase=0,previousK=k;
  for(let r=0;r<rows;r++) {
    const along=r*ds;
    while(segment<path.length-2&&path[segment+1].along<along)segment++;
    const a=path[segment],b=path[segment+1],span=b.along-a.along,t=(along-a.along)/span;
    const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+(b.y-a.y)*t;
    const dx=(b.x-a.x)/span,dz=(b.z-a.z)/span,slope=(b.y-a.y)/span;
    flow.set([dx,dz],r*2);
    const centerDepth=Math.max(0.04,y-groundHeight(x,z,site));
    const waveSpeed=Math.max(deepSpeed*0.48,Math.sqrt(9.81/k*Math.tanh(k*centerDepth))),localK=omega/waveSpeed;
    if(r)phase+=(localK+previousK)*0.5*ds;previousK=localK;
    const boost=Math.min(1.35,Math.pow(deepSpeed/waveSpeed,0.4));
    profile.set([phase,boost,slope,localK],r*4);
    const turn=r?(flow[(r-1)*2]*dz-flow[(r-1)*2+1]*dx)/ds:0;
    for(let c=0;c<columns;c++) {
      const i=r*columns+c,across=c*dc-reach,px=x+dz*across,pz=z-dx*across;
      positions.set([px,y,pz],i*3);depths[i]=y-groundHeight(px,pz,site);
      velocity[i]=(1.0+Math.min(1.3,-slope*10))*Math.sqrt(clamp(depths[i]/river.depth,0.025,1.5));
      lateral[i]=clamp(turn*velocity[i]*river.width,-0.2,0.2)*smooth(0,0.2,depths[i]);
      shear[i]=Math.min(1,-slope*8+Math.abs(turn)*river.width*0.6);
    }
  }
  // World lookup used only by terrain wetness. Build once, never scan the site per frame.
  const mapColumns=site.terrain.columns,mapRows=site.terrain.rows,map=new Float32Array(mapColumns*mapRows*4);
  const closest=new Float32Array(mapColumns*mapRows).fill(Infinity),gx=site.width/(mapColumns-1),gz=site.depth/(mapRows-1);
  for(let r=0;r<rows-1;r++) {
    const i=(r*columns+Math.floor(columns/2))*3,j=((r+1)*columns+Math.floor(columns/2))*3;
    const ax=positions[i],az=positions[i+2],bx=positions[j],bz=positions[j+2],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;
    const left=Math.max(0,Math.floor((Math.min(ax,bx)-reach+site.width/2)/gx)),right=Math.min(mapColumns-1,Math.ceil((Math.max(ax,bx)+reach+site.width/2)/gx));
    const top=Math.max(0,Math.floor((Math.min(az,bz)-reach+site.depth/2)/gz)),bottom=Math.min(mapRows-1,Math.ceil((Math.max(az,bz)+reach+site.depth/2)/gz));
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++) {
      const x=col*gx-site.width/2,z=row*gz-site.depth/2,projection=((x-ax)*dx+(z-az)*dz)/l2;
      if((r===0&&projection<0)||(r===rows-2&&projection>1))continue;
      const t=clamp(projection),distance=Math.hypot(x-ax-t*dx,z-az-t*dz);
      const across=Math.sign((x-ax)*dz-(z-az)*dx)*distance,index=row*mapColumns+col;
      if(distance>reach||distance>=closest[index])continue;
      closest[index]=distance;
      map.set([(across+reach)/(2*reach),(r+t)/(rows-1),positions[i+1]+(positions[j+1]-positions[i+1])*t,1],index*4);
    }
  }
  return {rows,columns,ds,dc,length,reach,k,omega,positions,flow,profile,depths,velocity,lateral,shear,map,mapColumns,mapRows};
}

/** CPU source/history and GPU displacement both call the ocean's directional wave bank. */
export function riverWave(field:RiverField,river:River,index:number,time:number) {
  const row=Math.floor(index/field.columns),across=(index%field.columns)*field.dc-field.reach;
  return coastalWave(field.profile[row*4],across,time*field.omega,field.k,field.depths[index],field.profile[row*4+1],river.water.amplitude,1.25,0.6);
}

function sample(data:Float32Array,columns:number,rows:number,c:number,r:number) {
  if(c<0||r<0||c>columns-1||r>rows-1)return 0;
  const x=Math.min(columns-2,Math.floor(c)),y=Math.min(rows-2,Math.floor(r)),u=c-x,v=r-y,i=y*columns+x;
  return (data[i]*(1-u)+data[i+1]*u)*(1-v)+(data[i+columns]*(1-u)+data[i+columns+1]*u)*v;
}

export class RiverHistory {
  readonly field:RiverField;
  readonly foam:Float32Array;readonly wet:Float32Array;readonly pixels:Uint8Array;
  private next:Float32Array;private accumulator=0;
  time=0;clock=0;
  constructor(site:Project['site'],public river:River) {
    this.field=buildRiverField(site,river);const n=this.field.depths.length;
    this.foam=new Float32Array(n);this.next=new Float32Array(n);this.wet=new Float32Array(n);this.pixels=new Uint8Array(n*4);
  }
  clearHistory(){this.foam.fill(0);this.next.fill(0);this.wet.fill(0);this.pixels.fill(0);}
  advanceClock(delta:number){
    if(!Number.isFinite(delta)||delta<=0)return;
    this.time+=this.accumulator+Math.min(delta,0.25)*this.river.speed;this.accumulator=0;this.clock=this.time;
  }
  advance(delta:number) {
    if(!Number.isFinite(delta)||delta<=0||!this.river.visible||this.river.speed===0)return false;
    this.accumulator+=Math.min(delta,0.25)*this.river.speed;let changed=false;
    while(this.accumulator>=0.05-1e-9){this.step(0.05);this.accumulator=Math.max(0,this.accumulator-0.05);changed=true;}
    this.clock=this.time+this.accumulator;return changed;
  }
  private step(dt:number) {
    this.time+=dt;const f=this.field,w=this.river.water,decay=Math.exp(-dt/w.foamPersistence),dry=Math.exp(-dt/w.dryingTime);
    for(let i=0;i<f.depths.length;i++) {
      const row=Math.floor(i/f.columns),col=i%f.columns,depth=f.depths[i];
      const wave=depth < -w.amplitude*0.9 ? null : riverWave(f,this.river,i,this.time);
      const thickness=depth+(wave?.height??0);
      const old=sample(this.foam,f.columns,f.rows,col-f.lateral[i]*dt/f.dc,row-f.velocity[i]*dt/f.ds);
      const covered=thickness>0.008;
      const shallows=(1-smooth(0.15,0.8,depth))*smooth(0.015,0.1,thickness);
      const crest=wave?smooth(0.25,0.85,wave.crest):0;
      const source=covered&&wave?(wave.breaking*0.9+crest*(shallows*0.32+f.shear[i]*0.25))*w.foam*Math.min(1,w.amplitude/0.12):0;
      this.next[i]=clamp(old*decay+source*dt*(1-old),0,0.9);
      const deposit=Math.abs(depth)<0.8?smooth(-0.015,0.035,thickness):0;
      this.wet[i]=Math.max(this.wet[i]*dry,deposit);
      this.pixels[i*4]=Math.round(this.next[i]*255);this.pixels[i*4+1]=Math.round(this.wet[i]*255);
      this.pixels[i*4+2]=Number(covered)*255;this.pixels[i*4+3]=255;
    }
    this.foam.set(this.next);
  }
}
