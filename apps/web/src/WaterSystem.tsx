import { Button, Panel, PanelHeading, FieldMessage } from './ui';
import type {ReactNode} from 'react';
import {Droplets,MousePointer2,Plus} from 'lucide-react';

export type InlandWaterType='river'|'lake';
export function WaterSystem({type,onType,children,onDraw,onAdd,drawing,existing,onSelectExisting,canDive,diving,onDive,onExitDive}:{type:InlandWaterType;onType:(type:InlandWaterType)=>void;children?:ReactNode;onDraw:()=>void;onAdd:()=>void;drawing:boolean;existing?:{id:string;name:string};onSelectExisting:(id:string)=>void;canDive:boolean;diving:boolean;onDive:()=>void;onExitDive:()=>void}){
  return <Panel className="water-system">
    <PanelHeading icon={<Droplets size={18}/>} title={<>Water System</>} subtitle={<>Shape inland water</>} />
    <div className="water-type-tabs" role="tablist" aria-label="Water type">{(['river','lake'] as const).map(value=><button key={value} id={`water-type-${value}`} type="button" role="tab" tabIndex={type===value?0:-1} aria-selected={type===value} aria-controls="water-type-panel" onClick={()=>onType(value)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'river':event.key==='End'?'lake':type==='river'?'lake':'river';onType(next);(event.currentTarget.parentElement?.querySelector(`#water-type-${next}`) as HTMLButtonElement|null)?.focus();}}>{value==='river'?'River':'Lake'}</button>)}</div>
    <div id="water-type-panel" role="tabpanel" aria-labelledby={`water-type-${type}`}>
      {existing&&<div className="water-dive">
        <Button variant="default" type="button" className="primary-button" disabled={!canDive||drawing} onClick={onDive}>Dive into {type}</Button>
        {diving&&<Button variant="ghost" type="button" className="text-button" onClick={onExitDive}>Return to 3D</Button>}
        <FieldMessage>{canDive?'Explore beneath the surface. Drag to orbit, right-drag to pan, and scroll to zoom.':'Show this water body and give it enough depth to view underwater.'}</FieldMessage>
      </div>}
      {children??(existing?<div className="water-create"><h3>{existing.name}</h3><p>This scene already has a {type}. Select it to continue editing.</p><Button variant="default" type="button" className="primary-button" onClick={()=>onSelectExisting(existing.id)}>Edit {type}</Button></div>:<div className="water-create"><h3>{type==='river'?'A flowing channel':'A still-water basin'}</h3><p>{type==='river'?'Draw a centerline from upstream to downstream, then shape its width, depth, and flow.':'Draw a closed shoreline, then adjust its water level, depth, banks, and wind waves.'}</p>
        <Button variant="default" type="button" className="primary-button" disabled={drawing} onClick={onDraw}><MousePointer2 size={16}/>{drawing?'Drawing in viewport…':`Draw ${type}`}</Button>
        <button type="button" className="water-starter" disabled={drawing} onClick={onAdd}><Plus size={15}/>Add starter {type}</button>
        <FieldMessage>{drawing?'Click on the terrain. Finish applies the shape; Cancel returns here.':'Your terrain stays editable. Preview changes before applying them.'}</FieldMessage>
      </div>)}
    </div>
  </Panel>;
}
