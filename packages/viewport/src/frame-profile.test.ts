import {afterEach,describe,expect,it,vi} from 'vitest';
import {observeFrameWork,startWork,endWork,finishFrameWork,type FrameWork} from './frame-profile';
afterEach(()=>vi.restoreAllMocks());
describe('opt-in frame work profiler',()=>{
  it('sums all actors in a frame and includes zero-work frames in means/percentiles',()=>{
    let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);
    const reports:FrameWork[]=[];const stop=observeFrameWork(sample=>reports.push(sample));
    for(let i=0;i<10;i++){
      if(i===0){const a=startWork();now+=2;endWork('actors',a);const b=startWork();now+=3;endWork('actors',b);}
      now=(i+1)*150;finishFrameWork();
    }
    expect(reports).toHaveLength(1);expect(reports[0].frames).toBe(10);
    expect(reports[0].stages.actors).toEqual({meanMs:.5,p95Ms:5,maxMs:5});
    stop();expect(Number.isNaN(startWork())).toBe(true);
  });
  it('bounds a window even when the clock does not advance and resets on unsubscribe',()=>{
    vi.spyOn(performance,'now').mockReturnValue(0);
    const reports:FrameWork[]=[];const stop=observeFrameWork(sample=>reports.push(sample));
    for(let i=0;i<480;i++)finishFrameWork();
    expect(reports.map(report=>report.frames)).toEqual([240,240]);stop();
    const next=vi.fn(),unsub=observeFrameWork(next);finishFrameWork();expect(next).not.toHaveBeenCalled();unsub();
  });
});
