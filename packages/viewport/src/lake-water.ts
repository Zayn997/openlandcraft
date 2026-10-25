import { lakeBounds, lakeWaterDistance, sampleHeight } from '@openlandcraft/landscape';
import type { Lake, Project } from '@openlandcraft/core';
import { coastalWave } from './coastal-waves';
import {HistoryWaves,historyWaveReference} from './history-wave';

const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function lakeWave(lake:Lake,x:number,z:number,ground:number,distance:number,time:number) {
  const angle=lake.direction*Math.PI/180,dx=Math.cos(angle),dz=Math.sin(angle),k=2*Math.PI/lake.wavelength;
  const fade=smooth(-Math.min(lake.bank,0.8),0,distance);
  const wave=coastalWave((x*dx+z*dz)*k,-x*dz+z*dx,time*Math.sqrt(9.81*k),k,lake.level-ground,1,lake.amplitude,0.45,0.4);
  return {...wave,height:wave.height*fade,breaking:wave.breaking*fade};
}
export class LakeHistory {
  readonly bounds:ReturnType<typeof lakeBounds>; readonly columns:number; readonly rows:number; readonly distances:Float32Array; readonly heights:Float32Array;
  readonly foam:Float32Array;readonly wet:Float32Array;readonly pixels:Uint8Array;
  clock=0; private remainder=0;
  private waves:HistoryWaves;private waveKey='';
  constructor(site:Project['site'],public lake:Lake){
    this.bounds=lakeBounds(lake);this.columns=Math.min(129,Math.max(17,Math.ceil(this.bounds.width/0.4)+1));this.rows=Math.min(129,Math.max(17,Math.ceil(this.bounds.depth/0.4)+1));
    const n=this.columns*this.rows;this.distances=new Float32Array(n);this.heights=new Float32Array(n);this.foam=new Float32Array(n);this.wet=new Float32Array(n);this.pixels=new Uint8Array(n*4);
    this.waves=new HistoryWaves(n);
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.columns;c++){
      const i=r*this.columns+c,x=this.bounds.minX+c/(this.columns-1)*this.bounds.width,z=this.bounds.minZ+r/(this.rows-1)*this.bounds.depth;
      this.distances[i]=lakeWaterDistance(lake,x,z);this.heights[i]=sampleHeight(site.terrain,site,x,z);
    }
  }
  clearHistory(){this.foam.fill(0);this.wet.fill(0);this.pixels.fill(0);this.remainder=0;}
  advanceClock(delta:number){this.clock+=Math.min(0.25,Math.max(0,delta))*this.lake.speed;}
  advance(delta:number){
    this.remainder+=Math.min(0.25,Math.max(0,delta))*this.lake.speed;let changed=false;
    while(this.remainder>=0.05){this.remainder-=0.05;this.clock+=0.05;this.step(0.05);changed=true;}return changed;
  }
  private step(dt:number){
    const lake=this.lake,decay=Math.exp(-dt/lake.foamPersistence),dry=Math.exp(-dt/lake.dryingTime);
    const reference=historyWaveReference();
    const angle=lake.direction*Math.PI/180,dx=Math.cos(angle),dz=Math.sin(angle),k=2*Math.PI/lake.wavelength;
    const key=[lake.direction,lake.wavelength,lake.level,lake.amplitude].join(':');
    if(key!==this.waveKey){
      for(let r=0;r<this.rows;r++)for(let c=0;c<this.columns;c++){
        const i=r*this.columns+c,x=this.bounds.minX+c/(this.columns-1)*this.bounds.width,z=this.bounds.minZ+r/(this.rows-1)*this.bounds.depth;
        this.waves.set(i,(x*dx+z*dz)*k,-x*dz+z*dx,k,lake.level-this.heights[i],1,lake.amplitude,.45,.4);
      }
      this.waveKey=key;
    }
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.columns;c++){
      const i=r*this.columns+c,d=this.distances[i];if(d<-Math.min(lake.bank,0.8))continue;
      const fade=smooth(-Math.min(lake.bank,.8),0,d);
      const raw=reference?lakeWave(lake,this.bounds.minX+c/(this.columns-1)*this.bounds.width,this.bounds.minZ+r/(this.rows-1)*this.bounds.depth,this.heights[i],d,this.clock):this.waves.sample(i,this.clock*Math.sqrt(9.81*k));
      const wave=reference?raw:{...raw,height:raw.height*fade,breaking:raw.breaking*fade},thickness=lake.level+wave.height-this.heights[i],covered=thickness>0.008;
      const edge=covered?(1-smooth(0.02,0.25,thickness))*Math.min(1,lake.amplitude/0.08)*Math.max(0,wave.crest):0;
      this.foam[i]=Math.min(1,this.foam[i]*decay+(wave.breaking+edge*0.4)*lake.foam*dt*2);
      this.wet[i]=covered?1:this.wet[i]*dry;
      this.pixels[i*4]=Math.round(this.foam[i]*255);this.pixels[i*4+1]=Math.round(this.wet[i]*255);this.pixels[i*4+3]=255;
    }
  }
}
