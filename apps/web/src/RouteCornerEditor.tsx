import {useRef,useState} from 'react';
import {ROUND_ROUTE_GESTURE,ROUND_PATH_GESTURE,ROUND_HEDGE_GESTURE,type Editor,type Instance,type Path,type Hedge} from '@openlandcraft/core';
import {hedgeCornerAmounts} from '@openlandcraft/landscape';
import {RouteCornerFields} from './RouteCornerFields';

/** Shared path/character/hedge corner editor: one slider drag is one undo step. */
export function RouteCornerEditor({entity,index,editor,onClose}:{entity:Instance|Path|Hedge;index:number;editor:Editor;onClose:()=>void}){
  const baseline=useRef<Instance|Path|Hedge|null>(null),valid=useRef(true),[error,setError]=useState('');
  const label=entity.kind==='hedge'?ROUND_HEDGE_GESTURE:entity.kind==='path'?ROUND_PATH_GESTURE:ROUND_ROUTE_GESTURE;
  const routeOf=(value:Instance|Path|Hedge)=>value.kind==='hedge'?{...value,cornerRounding:hedgeCornerAmounts(value)}:value.kind==='path'?value:value.walkingRoute;
  const begin=()=>{
    const snapshot=editor.getSnapshot();
    if(snapshot.gestureLabel&&snapshot.gestureLabel!==label){setError('Apply or cancel the current edit before rounding this corner.');return false;}
    if(!snapshot.gestureLabel){baseline.current=snapshot.project.entities.find(e=>e.id===entity.id) as Instance|Path|Hedge;valid.current=true;editor.begin(label);}
    return !!baseline.current&&!!routeOf(baseline.current);
  };
  const change=(amount:number)=>{
    if(!begin())return;const original=baseline.current!,route=routeOf(original)!;
    const cornerRounding=route.cornerRounding ? [...route.cornerRounding] : route.points.map(()=>0);cornerRounding[index]=amount;
    try{editor.preview({type:'replace',entity:original.kind==='instance'?{...original,walkingRoute:{...route,cornerRounding}}:{...original,cornerRounding}});valid.current=true;setError('');}
    catch(error){valid.current=false;setError(error instanceof Error?error.message:'This corner could not be rounded.');}
  };
  const commit=()=>{if(editor.getSnapshot().gestureLabel===label){if(valid.current)editor.commit();else editor.cancel();}baseline.current=null;};
  const cancel=()=>{if(editor.getSnapshot().gestureLabel===label)editor.cancel();baseline.current=null;setError('');};
  const route=routeOf(entity);
  return route ? <RouteCornerFields route={route} index={index} onStart={begin} onChange={change} onCommit={commit} onCancel={cancel} onClose={onClose} error={error}/> : null;
}
