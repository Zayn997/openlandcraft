import type {ViewportMetrics} from '@openlandcraft/viewport';

/** Optional local profiling sink. Normal editor sessions install no recorder. */
export type AppDiagnostics = {
  event:(name:string,data:Record<string,unknown>)=>void;
  metrics:(metrics:ViewportMetrics)=>void;
  stroke:(milliseconds:number)=>void;
  projectOpener?:(open:((file:File)=>Promise<void>)|null)=>void;
};
export async function measured<T>(sink:AppDiagnostics|undefined,name:string,operation:()=>Promise<T>|T):Promise<T> {
  if(!sink)return operation();
  const start=performance.now();
  try{return await operation();}
  finally{sink.event(name,{durationMs:performance.now()-start});}
}
