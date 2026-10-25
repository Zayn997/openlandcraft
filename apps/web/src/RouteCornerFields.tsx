import {useEffect,useRef} from 'react';
import {routeCorner,type RoundedRoute} from '@openlandcraft/landscape';
import {Card,CardContent,FieldMessage,RangeInput,Row} from './ui';

export function RouteCornerFields({route,index,onChange,onClose,onStart,onCommit,onCancel,error}:{
  route:RoundedRoute;index:number;onChange:(amount:number)=>void;onClose:()=>void;
  onStart?:()=>void;onCommit?:()=>void;onCancel?:()=>void;error?:string;
}){
  const corner=routeCorner(route,index),amount=route.cornerRounding?.[index]??0;
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!panel.current?.contains(event.target))onClose();};
    document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);
  },[onClose]);
  return <Card ref={panel} size="compact" className="shadow-lg" data-route-corner-controls role="group" aria-label={`Route corner ${index+1}`}>
    <CardContent>{corner ? <>
      <Row><RangeInput className="flex-1 min-w-0" aria-label="Corner rounding" aria-valuetext={`${Math.round(amount*100)}% rounding at point ${index+1}`} title={`Point ${index+1} · Corner rounding · 0% keeps the corner sharp`} min={0} max={100} step={1} value={Math.round(amount*100)} disabled={!corner.canRound}
        onPointerDown={onStart} onChange={event=>onChange(Number(event.target.value)/100)} onPointerUp={onCommit} onPointerCancel={onCancel} onBlur={onCommit}
        onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))onCommit?.();}}/>
        <output aria-hidden="true" className="w-9 shrink-0 text-right text-label tabular-nums text-accent">{Math.round(amount*100)}%</output></Row>
      {!corner.canRound&&<FieldMessage>Spread the anchors or narrow the run to round this bend.</FieldMessage>}
    </> : <FieldMessage>No bend at this point.</FieldMessage>}
    {error&&<FieldMessage tone="error" role="alert">{error}</FieldMessage>}</CardContent>
  </Card>;
}
