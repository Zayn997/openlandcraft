import React,{Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '../../apps/web/src/App';
import {observeModelLoads} from '../../packages/viewport/src/models';
import {observeFrameWork} from '../../packages/viewport/src/frame-profile';
import {profileHistoryWaveReference} from '../../packages/viewport/src/history-wave';
import type {AppDiagnostics} from '../../apps/web/src/app-diagnostics';
import type {ViewportMetrics} from '../../packages/viewport/src/index';
import '../../apps/web/src/app.css';

// Full editor, same StrictMode as main.tsx; no fixture injection or storage bypass.
const limit=800,started=performance.now();
const report:{started:number;browser:string;events:unknown[];commits:unknown[];longTasks:unknown[];frames:unknown[];snapshots:unknown[]}={started,browser:navigator.userAgent,events:[],commits:[],longTasks:[],frames:[],snapshots:[]};
const append=(target:unknown[],value:unknown)=>{target.push(value);if(target.length>limit)target.shift();};
let openProject:((file:File)=>Promise<void>)|null=null;
async function openFixture(name:string){
  if(!['mixed-100.olc.json','mixed-500.olc.json','small.olc.json','horse-walk.olc.json'].includes(name)||!openProject)return;
  const response=await fetch(new URL(name,location.href));if(!response.ok)throw new Error('Fixture could not load');
  const file=new File([await response.blob()],name,{type:'application/json'});await openProject(file);
}
const heap=()=>{
  const memory=(performance as Performance & {memory?:{usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number}}).memory;
  return memory?{used:memory.usedJSHeapSize,total:memory.totalJSHeapSize,limit:memory.jsHeapSizeLimit}:null;
};
const standalone=parent===window;
let output:HTMLPreElement|undefined,summary:HTMLParagraphElement|undefined;
if(standalone){
  const style=document.createElement('style');style.textContent='.app{width:1440px;height:900px!important}body{overflow:auto!important}';document.head.append(style);
  const controls=document.createElement('div'),label=document.createElement('label'),input=document.createElement('input'),mark=document.createElement('button'),clear=document.createElement('button');
  label.textContent='Snapshot label ';input.value='initial';label.append(input);mark.textContent='Capture memory snapshot';clear.textContent='Clear recording';
  mark.onclick=()=>{append(report.snapshots,{at:performance.now(),label:input.value,heap:heap()});publish();};
  clear.onclick=()=>{for(const list of [report.events,report.commits,report.longTasks,report.frames,report.snapshots])list.length=0;publish();};
  summary=document.createElement('p');summary.setAttribute('role','status');output=document.createElement('pre');output.setAttribute('aria-label','App profile results');output.style.cssText='height:180px;overflow:auto;white-space:pre-wrap';
  controls.append(label,mark,clear);
  for(const name of ['mixed-100.olc.json','mixed-500.olc.json','small.olc.json']){const button=document.createElement('button');button.textContent=`Open ${name}`;button.onclick=()=>void openFixture(name);controls.append(button);}
  controls.append(summary,output);document.body.append(controls);
}
const publish=()=>{
  if(output){output.textContent=JSON.stringify(report,null,2);summary!.textContent=`${report.events.length} events · ${report.commits.length} commits · ${report.frames.length} render windows`;}
  else parent.postMessage({type:'olc-m8-report',report},location.origin);
};
const diagnostics:AppDiagnostics={
  projectOpener:open=>{openProject=open;},
  event:(name,data)=>{append(report.events,{at:performance.now(),name,...data});publish();},
  metrics:(value:ViewportMetrics)=>{append(report.frames,{at:performance.now(),heap:heap(),...value});publish();},
  stroke:milliseconds=>{append(report.events,{at:performance.now(),name:'brush-feedback',durationMs:milliseconds});},
};
observeModelLoads(sample=>diagnostics.event('model-load',sample));
observeFrameWork(sample=>diagnostics.event('frame-work',sample));
try {
  new PerformanceObserver(list=>{for(const entry of list.getEntries())append(report.longTasks,{at:entry.startTime,durationMs:entry.duration});}).observe({type:'longtask',buffered:true});
} catch {diagnostics.event('long-task-observer-unavailable',{});}
window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='olc-m8-command')return;
  if(event.data.command==='mark')append(report.snapshots,{at:performance.now(),label:String(event.data.label),heap:heap()});
  if(event.data.command==='clear')for(const list of [report.events,report.commits,report.longTasks,report.frames,report.snapshots])list.length=0;
  if(event.data.command==='open')void openFixture(String(event.data.name));
  if(event.data.command==='water-reference'){
    const enabled=event.data.enabled===true;profileHistoryWaveReference(enabled);diagnostics.event('water-reference',{enabled});
  }
  publish();
});
window.addEventListener('load',()=>{
  const nav=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
  diagnostics.event('navigation',{entryModuleReadyMs:started,domContentLoadedMs:nav?.domContentLoadedEventEnd,transferBytes:nav?.transferSize});
});
createRoot(document.getElementById('root')!).render(<React.StrictMode><Profiler id="actual-app" onRender={(_id,phase,actualDuration,baseDuration,startTime,commitTime)=>{
  append(report.commits,{phase,actualDuration,baseDuration,startTime,commitTime});
}}><App diagnostics={diagnostics}/></Profiler></React.StrictMode>);
