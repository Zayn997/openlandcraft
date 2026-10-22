import {useSyncExternalStore} from 'react';
import type {ViewportMetrics} from '@openlandcraft/viewport';

/** Only live diagnostic displays subscribe; a frame sample must not rerender the editor. */
export function createViewportMetricsSource(){
  let current:ViewportMetrics|null=null;
  const listeners=new Set<()=>void>();
  return {
    getSnapshot:()=>current,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    publish:(metrics:ViewportMetrics)=>{current=metrics;listeners.forEach(listener=>listener());},
  };
}
export type ViewportMetricsSource=ReturnType<typeof createViewportMetricsSource>;
export function FrameRate({source}:{source:ViewportMetricsSource}){
  const metrics=useSyncExternalStore(source.subscribe,source.getSnapshot);
  return <>{metrics?`${metrics.fps} FPS`:'Starting…'}</>;
}
export function RendererInfo({source}:{source:ViewportMetricsSource}){
  const metrics=useSyncExternalStore(source.subscribe,source.getSnapshot);
  return metrics?<p className="renderer-info">{metrics.renderer}<br/>{metrics.calls} draw calls · {metrics.triangles.toLocaleString()} triangles</p>:null;
}
