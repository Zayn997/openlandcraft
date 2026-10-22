/** Opt-in CPU wall timings. No samples or clock reads are retained without an observer.
 * Rendering includes driver submission/waits; these are not GPU timer queries. */
export type FrameWork = {frames:number;intervalMs:number;stages:Record<string,{meanMs:number;p95Ms:number;maxMs:number}>};
const observers=new Set<(sample:FrameWork)=>void>();
let started=0,frames=0;
const current=new Map<string,number>(), samples=new Map<string,number[]>();
export function observeFrameWork(observer:(sample:FrameWork)=>void) {
  observers.add(observer);
  if(observers.size===1){started=performance.now();frames=0;current.clear();samples.clear();}
  return ()=>{observers.delete(observer);if(!observers.size){current.clear();samples.clear();}};
}
export const startWork=()=>observers.size?performance.now():NaN;
export function endWork(name:string,start:number){
  if(Number.isNaN(start)||!observers.size)return;
  current.set(name,(current.get(name)??0)+performance.now()-start);
}
export function finishFrameWork(){
  if(!observers.size)return;
  frames++;
  for(const name of current.keys())if(!samples.has(name))samples.set(name,Array(frames-1).fill(0));
  for(const [name,values] of samples)values.push(current.get(name)??0);
  current.clear();
  const intervalMs=performance.now()-started;
  // Bound storage even with a paused/debugger clock or a very fast display.
  if(intervalMs<1500&&frames<240)return;
  const stages:FrameWork['stages']={};
  for(const [name,values] of samples){
    values.sort((a,b)=>a-b);
    stages[name]={meanMs:values.reduce((sum,value)=>sum+value,0)/frames,p95Ms:values[Math.ceil(frames*.95)-1],maxMs:values[frames-1]};
  }
  const sample={frames,intervalMs,stages};
  started=performance.now();frames=0;samples.clear();
  for(const observer of observers)observer(sample);
}
