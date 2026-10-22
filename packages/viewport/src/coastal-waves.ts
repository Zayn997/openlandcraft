/** Directional swell bank. Frequencies follow deep-water dispersion; the shared
 * travel field slows and turns each front over the authored seabed. */
export const SWELL_BANK = [
  { scale: 1, weight: 0.56, spread: 0.06, phase: 0.0 },
  { scale: 1.47, weight: 0.25, spread: -0.25, phase: 2.3 },
  { scale: 2.31, weight: 0.13, spread: 0.43, phase: 4.1 },
  { scale: 3.73, weight: 0.06, spread: -0.57, phase: 1.2 },
] as const;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};

/** Invert a non-folding trochoid into world coordinates, retaining its slope. */
export function trochoid(phase:number,chop:number) {
  let theta=phase;
  for(let i=0;i<3;i++)theta-=(theta-chop*Math.sin(theta)-phase)/(1-chop*Math.cos(theta));
  return {height:Math.cos(theta)+chop*0.5,slope:-Math.sin(theta)/(1-chop*Math.cos(theta))};
}

export function coastalWave(phase:number,along:number,clock:number,k:number,depth:number,boost:number,amplitude:number,breaker:number,swash:number,shape=trochoid) {
  const near=1-smooth(0.3,3.5,depth),chop=0.14+0.18*near*Math.min(1,breaker);
  const bend=0.24*Math.sin(along*0.075)+0.12*Math.sin(along*0.19);
  const bendSlope=0.018*Math.cos(along*0.075)+0.0228*Math.cos(along*0.19);
  const spreadFade=1-near*0.7;
  let height=0,slope=0,cross=0,totalWeight=0;
  for(const wave of SWELL_BANK){
    const weight=wave.weight*(1-near*Math.min(0.9,(wave.scale-1)*0.5));
    const p=(phase+bend)*wave.scale+along*k*wave.spread*spreadFade-clock*Math.sqrt(wave.scale)+wave.phase;
    const value=shape(p,chop/(1+(wave.scale-1)*0.25));
    height+=value.height*weight;
    slope+=value.slope*weight*wave.scale;
    cross+=value.slope*weight*(bendSlope*wave.scale+k*wave.spread*spreadFade);
    totalWeight+=weight;
  }
  height/=totalWeight;slope/=totalWeight;cross/=totalWeight;
  const breakerDepth=Math.max(0.18,amplitude*boost*2.6);
  const dissipate=1+(smooth(0.01,breakerDepth*1.25,Math.max(0,depth))-1)*Math.min(1,breaker);
  const swell=amplitude*boost*dissipate;
  const blend=smooth(-0.03,Math.max(0.35,breakerDepth),depth);
  const positive=Math.max(0,height),runup=amplitude*swash*Math.pow(positive,1.3);
  const runDerivative=positive>0?amplitude*swash*1.3*Math.pow(positive,0.3):0;
  const derivative=runDerivative*(1-blend)+swell*blend;
  const crestLip=smooth(0.5,0.9,height)*(1-smooth(0.25,0.85,Math.abs(slope)))*(0.45+0.55*smooth(-0.1,0.25,-slope));
  const breaking=smooth(0.05,0.18,depth)*(1-smooth(breakerDepth,breakerDepth*2.8,depth))*crestLip*breaker*Math.min(1,amplitude/0.15);
  return {height:runup*(1-blend)+swell*height*blend,slope:slope*derivative,cross:cross*derivative,breaking,crest:height};
}

const gl=(v:number)=>Number.isInteger(v)?`${v}.0`:String(v);
export const coastalWaveGLSL=/* glsl */`
  vec2 trochoid(float phase,float chop) {
    float theta=phase;
    for(int i=0;i<3;i++)theta-=(theta-chop*sin(theta)-phase)/(1.0-chop*cos(theta));
    return vec2(cos(theta)+chop*0.5,-sin(theta)/(1.0-chop*cos(theta)));
  }
  vec4 coastalWave(float phase,float along,float clock,float k,float depth,float boost,float amplitude,float breaker,float swash) {
    float near=1.0-smoothstep(0.3,3.5,depth),chop=0.14+0.18*near*min(1.0,breaker);
    float bend=0.24*sin(along*0.075)+0.12*sin(along*0.19);
    float bendSlope=0.018*cos(along*0.075)+0.0228*cos(along*0.19),spreadFade=1.0-near*0.7;
    float height=0.0,slope=0.0,cross=0.0,totalWeight=0.0;
    ${SWELL_BANK.map(w=>`{
      float weight=${gl(w.weight)}*(1.0-near*${gl(Math.min(.9,(w.scale-1)*.5))});
      float p=(phase+bend)*${gl(w.scale)}+along*k*${gl(w.spread)}*spreadFade-clock*${gl(Math.sqrt(w.scale))}+${gl(w.phase)};
      vec2 value=trochoid(p,chop/${gl(1+(w.scale-1)*.25)});
      height+=value.x*weight;slope+=value.y*weight*${gl(w.scale)};
      cross+=value.y*weight*(bendSlope*${gl(w.scale)}+k*${gl(w.spread)}*spreadFade);totalWeight+=weight;
    }`).join('\n')}
    height/=totalWeight;slope/=totalWeight;cross/=totalWeight;
    float bd=max(0.18,amplitude*boost*2.6);
    float dissipate=mix(1.0,smoothstep(0.01,bd*1.25,max(0.0,depth)),min(1.0,breaker));
    float swell=amplitude*boost*dissipate,blend=smoothstep(-0.03,max(0.35,bd),depth);
    float positive=max(0.0,height),runup=amplitude*swash*pow(positive,1.3);
    float derivative=mix(positive>0.0?amplitude*swash*1.3*pow(positive,0.3):0.0,swell,blend);
    float crestLip=smoothstep(0.5,0.9,height)*(1.0-smoothstep(0.25,0.85,abs(slope)))*(0.45+0.55*smoothstep(-0.1,0.25,-slope));
    float breaking=smoothstep(0.05,0.18,depth)*(1.0-smoothstep(bd,bd*2.8,depth))*crestLip*breaker*min(1.0,amplitude/0.15);
    return vec4(mix(runup,swell*height,blend),slope*derivative,cross*derivative,breaking);
  }
`;
