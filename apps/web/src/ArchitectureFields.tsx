import { Button, FieldGrid, FieldMessage, NumberField, Row } from './ui';
import { InspectorSection } from './InspectorSection';
import { useState } from 'react';
import { footprint, wallLength, type Opening, type PlanPoint, type Roof, type Slab, type Wall } from '@openlandcraft/core';

function PointList({points,onChange}:{points:PlanPoint[];onChange:(points:PlanPoint[])=>void}) {
  return <>{points.map((p,i)=><div className="architecture-point" key={i}><span>{i+1}</span>{p.map((v,k)=><NumberField key={k} label={`Corner ${i+1} ${k===0?'X':'Z'}`} value={v} min={-100} max={100} onChange={next=>onChange(points.map((q,j)=>j===i?q.map((n,l)=>l===k?next:n) as PlanPoint:q))}/>)}<button type="button" aria-label={`Remove corner ${i+1}`} disabled={points.length<=2} onClick={()=>onChange(points.filter((_,j)=>i!==j))}>×</button></div>)}<button type="button" className="add-object" disabled={points.length>=16} onClick={()=>{const p=points.at(-1)??[0,0];onChange([...points,[Math.min(100,p[0]+2),p[1]]]);}}>Add corner</button></>;
}

export function OpeningFields({wall,change}:{wall:Wall;change:(patch:object)=>void}) {
  const openings=wall.openings??[];
  const edit=(id:string,patch:Partial<Opening>)=>change({openings:openings.map(o=>o.id===id?{...o,...patch}:o)});
  const add=(kind:Opening['kind'])=>{
    const margin=Math.max(0.1,wall.thickness*2),width=kind==='door'?0.9:1.4;
    let offset=margin;
    for(const o of [...openings].sort((a,b)=>a.offset-b.offset))if(offset+width+0.1>o.offset)offset=Math.max(offset,o.offset+o.width+0.1);
    change({openings:[...openings,{id:crypto.randomUUID(),kind,offset,width,height:kind==='door'?2.1:1.2,sill:kind==='door'?0:0.9}]});
  };
  return <InspectorSection sectionId="architecturefields-openings" title={<>Doors & windows <span>{openings.length}/8</span></>} defaultOpen={false}>
    <Row className="part-buttons"><button type="button" disabled={openings.length>=8} onClick={()=>add('door')}>+ Door</button><button type="button" disabled={openings.length>=8} onClick={()=>add('window')}>+ Window</button></Row>
    {openings.map((o,i)=><details className="architecture-opening" key={o.id} open><summary>{o.kind==='door'?'Door':'Window'} {i+1} · {o.width.toFixed(2)} × {o.height.toFixed(2)} m</summary>
      <NumberField label={`${o.kind} ${i+1} offset`} value={o.offset} min={0} max={wallLength(wall)} onChange={v=>edit(o.id,{offset:v})}/>
      <FieldGrid columns={'auto'}><NumberField label={`${o.kind} ${i+1} width`} value={o.width} min={0.3} max={20} onChange={v=>edit(o.id,{width:v})}/><NumberField label={`${o.kind} ${i+1} height`} value={o.height} min={0.3} max={20} onChange={v=>edit(o.id,{height:v})}/></FieldGrid>
      {o.kind==='window'&&<NumberField label={`Window ${i+1} sill`} value={o.sill} min={0} max={20} onChange={v=>edit(o.id,{sill:v})}/>}
      <Button variant="ghost" type="button" className="cancel-button" onClick={()=>change({openings:openings.filter(p=>p.id!==o.id)})}>Remove {o.kind} {i+1}</Button>
    </details>)}
    <FieldMessage>Offset is measured from the wall start to the opening’s left edge. Openings follow their wall and are removed with it. Invalid cuts keep the last valid preview.</FieldMessage>
  </InspectorSection>;
}

export function OutlineFields({part,change}:{part:Slab|Roof;change:(patch:object)=>void}) {
  const [points,setPoints]=useState<PlanPoint[]>(part.outline??footprint({...part,center:[0,0]}));
  return <InspectorSection sectionId="architecturefields-outline" title={<>Outline · offsets from center</>} defaultOpen={false}>
    <FieldMessage>{part.kind==='roof'?'A custom outline makes a flat roof; its rise becomes roof thickness. Rectangular roofs retain their gable.':'Edit a simple polygon, including concave floor plans.'} Changes appear after Preview outline.</FieldMessage>
    <details><summary>Edit outline corners</summary><PointList points={points} onChange={setPoints}/><button type="button" className="add-object" onClick={()=>change({outline:points})}>Preview outline</button></details>
    {part.outline&&<Button variant="ghost" type="button" className="cancel-button" onClick={()=>change({outline:undefined})}>Restore rectangle</Button>}
  </InspectorSection>;
}
