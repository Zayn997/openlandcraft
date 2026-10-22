import {trochoid,SWELL_BANK} from './coastal-waves';

// CPU foam/wetness grids repeatedly invert the same bounded trochoid. A shared
// periodic table avoids four Newton solves per cell per 20 Hz history step.
// The visible displacement/normal shaders still evaluate the analytic wave.
const PHASES=1024,CHOPS=64,MAX_CHOP=.32,TAU=2*Math.PI,STRIDE=(PHASES+1)*2;
let table:Float32Array|undefined;
// Harness-only A/B switch. Normal sessions always use the optimized evaluator.
let reference=false;
export const historyWaveReference=()=>reference;
export function profileHistoryWaveReference(enabled:boolean){reference=enabled;}
function values(){
  if(table)return table;
  table=new Float32Array((CHOPS+1)*STRIDE);
  for(let c=0;c<=CHOPS;c++)for(let p=0;p<=PHASES;p++){
    const wave=trochoid(p/PHASES*TAU,c/CHOPS*MAX_CHOP),i=c*STRIDE+p*2;
    table[i]=wave.height;table[i+1]=wave.slope;
  }
  return table;
}
export function historyTrochoid(phase:number,chop:number){
  if(chop<0||chop>MAX_CHOP||!Number.isFinite(phase))return trochoid(phase,chop);
  const data=values(),p=((phase%TAU+TAU)%TAU)/TAU*PHASES,c=chop/MAX_CHOP*CHOPS;
  const ip=Math.min(PHASES-1,Math.floor(p)),ic=Math.min(CHOPS-1,Math.floor(c)),u=p-ip,v=c-ic,i=ic*STRIDE+ip*2;
  const height=(data[i]*(1-u)+data[i+2]*u)*(1-v)+(data[i+STRIDE]*(1-u)+data[i+STRIDE+2]*u)*v;
  const slope=(data[i+1]*(1-u)+data[i+3]*u)*(1-v)+(data[i+STRIDE+1]*(1-u)+data[i+STRIDE+3]*u)*v;
  return {height,slope};
}

const smooth=(a:number,b:number,value:number)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
const CELL=16;
/** Static bathymetry/shore coefficients are prepared once, not at every time step.
 * Packed storage is bounded by the existing history grids (128 bytes per cell). */
export class HistoryWaves {
  private readonly data:Float64Array;
  constructor(count:number){this.data=new Float64Array(count*CELL);}
  set(index:number,phase:number,along:number,k:number,depth:number,boost:number,amplitude:number,breaker:number,swash:number){
    const d=this.data,base=index*CELL,near=1-smooth(.3,3.5,depth),chop=.14+.18*near*Math.min(1,breaker);
    const bend=.24*Math.sin(along*.075)+.12*Math.sin(along*.19),spreadFade=1-near*.7;
    let total=0;
    SWELL_BANK.forEach((wave,j)=>{
      const i=base+j*3,weight=wave.weight*(1-near*Math.min(.9,(wave.scale-1)*.5));
      d[i]=(phase+bend)*wave.scale+along*k*wave.spread*spreadFade+wave.phase;
      d[i+1]=chop/(1+(wave.scale-1)*.25);d[i+2]=weight;total+=weight;
    });
    const bd=Math.max(.18,amplitude*boost*2.6),blend=smooth(-.03,Math.max(.35,bd),depth);
    const dissipate=1+(smooth(.01,bd*1.25,Math.max(0,depth))-1)*Math.min(1,breaker);
    d[base+12]=1/total;d[base+13]=amplitude*swash*(1-blend);d[base+14]=amplitude*boost*dissipate*blend;
    d[base+15]=smooth(.05,.18,depth)*(1-smooth(bd,bd*2.8,depth))*breaker*Math.min(1,amplitude/.15);
  }
  sample(index:number,clock:number){
    const d=this.data,base=index*CELL;let height=0,slope=0;
    for(let j=0;j<SWELL_BANK.length;j++){
      const i=base+j*3,wave=SWELL_BANK[j],v=historyTrochoid(d[i]-clock*Math.sqrt(wave.scale),d[i+1]);
      height+=v.height*d[i+2];slope+=v.slope*d[i+2]*wave.scale;
    }
    height*=d[base+12];slope*=d[base+12];
    const crestLip=smooth(.5,.9,height)*(1-smooth(.25,.85,Math.abs(slope)))*(.45+.55*smooth(-.1,.25,-slope));
    return {height:d[base+13]*Math.pow(Math.max(0,height),1.3)+d[base+14]*height,crest:height,breaking:d[base+15]*crestLip};
  }
}
