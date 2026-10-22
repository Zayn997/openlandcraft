import {describe,it,expect} from 'vitest';
import {coastalWave,trochoid} from './coastal-waves';
import {historyTrochoid,HistoryWaves} from './history-wave';

describe('bounded CPU history wave table',()=>{
  it('matches analytic heights/slopes across the chop range, wraps and negative/large phases',()=>{
    let heightError=0,slopeError=0;
    for(let c=0;c<=41;c++)for(let p=0;p<401;p++){
      const phase=(p-200)*.8173,chop=c/41*.32,a=trochoid(phase,chop),b=historyTrochoid(phase,chop);
      heightError=Math.max(heightError,Math.abs(a.height-b.height));slopeError=Math.max(slopeError,Math.abs(a.slope-b.slope));
      expect(historyTrochoid(phase+2*Math.PI,chop).height).toBeCloseTo(b.height,10);
    }
    expect(heightError).toBeLessThan(.00002);expect(slopeError).toBeLessThan(.00006);
    expect(historyTrochoid(.5,.5)).toEqual(trochoid(.5,.5));
  });
  it('keeps shore runup and foam sources close to analytic water without changing wave clocks',()=>{
    for(const depth of [-1,-.03,.01,.1,.4,1,4,20])for(const amplitude of [0,.08,.35,1.5])for(let t=0;t<8;t+=.137){
      const args=[3.1,-7.8,t,.7,depth,1.5,amplitude,1.25,2] as const;
      const a=coastalWave(...args),b=coastalWave(...args,historyTrochoid);
      const prepared=new HistoryWaves(1);prepared.set(0,3.1,-7.8,.7,depth,1.5,amplitude,1.25,2);
      const c=prepared.sample(0,t);
      for(const name of ['height','crest','breaking'] as const)expect(c[name]).toBeCloseTo(b[name],10);
      expect(Math.abs(a.height-b.height)).toBeLessThan(.0002);
      expect(Math.abs(a.breaking-b.breaking)).toBeLessThan(.0002);
      expect(Math.abs(a.crest-b.crest)).toBeLessThan(.00003);
    }
  });
});
