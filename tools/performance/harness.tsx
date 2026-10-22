import React,{useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {Editor,parseProject,type Project} from '../../packages/core/src/index';
import {DEFAULT_BRUSH} from '../../packages/landscape/src/index';
import {Viewport,type ViewportMetrics,type CameraProjection,type CameraView} from '../../packages/viewport/src/index';

type Scenario={id:string;name:string;entities:number;fileBytes:number;sourceBytes:number};
type Result={scenario:string;quality:string;projection:string;playing:boolean;viewport:number[];devicePixelRatio:number;browser:string;observedAfterMountMs:number;metrics:ViewportMetrics[];strokeMs:number[]};

function Benchmark({base}:{base:string}) {
  const [scenarios,setScenarios]=useState<Scenario[]>([]),[id,setId]=useState('plants-100'),[editor,setEditor]=useState<Editor|null>(null);
  const [quality,setQuality]=useState<'high'|'low'>('high'),[projection,setProjection]=useState<CameraProjection>('perspective'),[view,setView]=useState<CameraView>('perspective');
  const [playing,setPlaying]=useState(true),[tool,setTool]=useState<'select'|'terrain'>('select'),[error,setError]=useState('');
  const [latest,setLatest]=useState<ViewportMetrics|null>(null),[results,setResults]=useState<Result[]>([]),[progress,setProgress]=useState('Choose a workload; wait for models to appear, then record.');
  const recording=useRef<Result|null>(null),started=useRef(0),container=useRef<HTMLDivElement>(null);
  useEffect(()=>{fetch(base+'manifest.json').then(r=>r.json()).then(r=>setScenarios(r.scenarios)).catch(e=>setError(String(e)));},[base]);
  useEffect(()=>{
    let active=true;setEditor(null);recording.current=null;setError('');setLatest(null);setProgress('Loading workload…');
    fetch(base+id+'.olc.json').then(r=>r.json()).then(raw=>{if(active){setEditor(new Editor(parseProject(raw)));started.current=performance.now();setProgress('Wait for models to appear, then record.');}}).catch(e=>{if(active)setError(String(e));});
    return()=>{active=false;};
  },[base,id]);
  const onMetrics=useCallback((metrics:ViewportMetrics)=>{
    setLatest(metrics);
    const sample=recording.current;if(!sample)return;
    sample.metrics.push(metrics);setProgress(`Recording ${sample.metrics.length}/6 render windows`);
    if(sample.metrics.length===6){setResults(old=>[...old,sample]);recording.current=null;setProgress('Recorded 6 windows. Change workload or quality for comparison.');}
  },[]);
  const onStrokeTime=useCallback((ms:number)=>{if(recording.current)recording.current.strokeMs.push(ms);},[]);
  const stop=()=>{recording.current=null;setProgress('Recording cleared; select Record to start a new sample.');};
  return <main style={{width:1280,minWidth:1280,minHeight:720,display:'flex',flexDirection:'column',background:'#202820',color:'#edf0e6'}}>
    <div style={{display:'flex',gap:10,padding:10,alignItems:'center',flexWrap:'wrap'}}>
      <strong>M8 baseline · production Viewport</strong>
      <label>Workload <select value={id} onChange={e=>{stop();setId(e.target.value);}}>{scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Quality <select value={quality} onChange={e=>{stop();setQuality(e.target.value as 'high'|'low');}}><option value="high">High</option><option value="low">Low</option></select></label>
      <button onClick={()=>{stop();setProjection('perspective');setView('perspective');}}>3D</button><button onClick={()=>{stop();setProjection('orthographic');setView('axonometric');}}>Axo</button>
      <label><input type="checkbox" checked={playing} onChange={e=>{stop();setPlaying(e.target.checked);}}/>Animation</label>
      <label><input type="checkbox" checked={tool==='terrain'} onChange={e=>{stop();setTool(e.target.checked?'terrain':'select');}}/>Sculpt</label>
      <button disabled={!latest} onClick={()=>{
        const rect=container.current!.getBoundingClientRect();
        recording.current={scenario:id,quality,projection,playing,viewport:[rect.width,rect.height],devicePixelRatio:window.devicePixelRatio,browser:navigator.userAgent,observedAfterMountMs:Math.round(performance.now()-started.current),metrics:[],strokeMs:[]};
        setProgress('Recording 0/6 render windows · orbit or sculpt now');
      }}>Record 6 windows</button>
    </div>
    <div role="status" style={{padding:'4px 10px'}}>{progress} · {latest?`${latest.fps} FPS · ${latest.calls} calls · ${latest.triangles} triangles`:''}</div>
    {error&&<div role="alert">{error}</div>}
    <div ref={container} style={{width:1280,height:478,flexShrink:0,position:'relative'}}>{editor&&<Scene key={id} editor={editor} quality={quality} projection={projection} view={view} onView={setView} playing={playing} tool={tool} onMetrics={onMetrics} onStrokeTime={onStrokeTime} onError={setError}/>}</div>
    <details style={{height:176,flexShrink:0,overflow:'auto',padding:8}} open><summary>Recorded results ({results.length}) · render windows include all production water/shadow passes</summary><pre aria-label="Benchmark results" style={{whiteSpace:'pre-wrap',fontSize:11}}>{JSON.stringify(results,null,2)}</pre></details>
  </main>;
}
function Scene({editor,quality,projection,view,onView,playing,tool,onMetrics,onStrokeTime,onError}:{editor:Editor;quality:'high'|'low';projection:CameraProjection;view:CameraView;onView:(v:CameraView)=>void;playing:boolean;tool:'select'|'terrain';onMetrics:(m:ViewportMetrics)=>void;onStrokeTime:(n:number)=>void;onError:(s:string)=>void}) {
  const state=useSyncExternalStore(editor.subscribe,editor.getSnapshot);
  const project:Project=state.preview??state.project;
  return <Viewport project={project} editor={editor} selectedId={null} onSelect={()=>{}} view={view} projection={projection} onNavigationView={onView}
    frameToken={1} frameCancelToken={0} grid tool={tool} brush={DEFAULT_BRUSH} playing={playing} quality={quality} transformMode="translate" snapping={false} plantWind
    onCopyPlaced={()=>{}} onCopyStatus={()=>{}} onMetrics={onMetrics} onStrokeTime={onStrokeTime} onGroundPoint={()=>{}} onError={onError}
    wallDraft={[]} regionDraft={[]} riverDraft={[]} pathDraft={[]} lakeDraft={[]} lakeDraftLevel={0}
    waterPreview={{reset:0,step:0,riverReset:0,riverStep:0,lakeReset:0,lakeStep:0}}/>;
}
export function mountBenchmark(base:string){createRoot(document.getElementById('root')!).render(<Benchmark base={base}/>);}
