import { useState } from 'react';
import { createWallChain, footprint, wallLength, type Editor, type Level, type Opening, type PlanPoint, type Roof, type Slab, type Wall } from '@openlandcraft/core';
import { NumberField } from './NumberField';

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
  return <section className="property-section"><h3>Doors & windows <span>{openings.length}/8</span></h3>
    <div className="part-buttons"><button type="button" disabled={openings.length>=8} onClick={()=>add('door')}>+ Door</button><button type="button" disabled={openings.length>=8} onClick={()=>add('window')}>+ Window</button></div>
    {openings.map((o,i)=><details className="architecture-opening" key={o.id} open><summary>{o.kind==='door'?'Door':'Window'} {i+1} · {o.width.toFixed(2)} × {o.height.toFixed(2)} m</summary>
      <NumberField label={`${o.kind} ${i+1} offset`} value={o.offset} min={0} max={wallLength(wall)} onChange={v=>edit(o.id,{offset:v})}/>
      <div className="construction-fields"><NumberField label={`${o.kind} ${i+1} width`} value={o.width} min={0.3} max={20} onChange={v=>edit(o.id,{width:v})}/><NumberField label={`${o.kind} ${i+1} height`} value={o.height} min={0.3} max={20} onChange={v=>edit(o.id,{height:v})}/></div>
      {o.kind==='window'&&<NumberField label={`Window ${i+1} sill`} value={o.sill} min={0} max={20} onChange={v=>edit(o.id,{sill:v})}/>}
      <button type="button" className="cancel-button" onClick={()=>change({openings:openings.filter(p=>p.id!==o.id)})}>Remove {o.kind} {i+1}</button>
    </details>)}
    <p className="field-hint">Offset is measured from the wall start to the opening’s left edge. Openings follow their wall and are removed with it. Invalid cuts keep the last valid preview.</p>
  </section>;
}

export function OutlineFields({part,change}:{part:Slab|Roof;change:(patch:object)=>void}) {
  const [points,setPoints]=useState<PlanPoint[]>(part.outline??footprint({...part,center:[0,0]}));
  return <section className="property-section"><h3>Outline · offsets from center</h3>
    <p className="field-hint">{part.kind==='roof'?'A custom outline makes a flat roof; its rise becomes roof thickness. Rectangular roofs retain their gable.':'Edit a simple polygon, including concave floor plans.'} Changes appear after Preview outline.</p>
    <details><summary>Edit outline corners</summary><PointList points={points} onChange={setPoints}/><button type="button" className="add-object" onClick={()=>change({outline:points})}>Preview outline</button></details>
    {part.outline&&<button type="button" className="cancel-button" onClick={()=>change({outline:undefined})}>Restore rectangle</button>}
  </section>;
}

export function WallChainFields({level,editor,guard}:{level:Level;editor:Editor;guard:(run:()=>void)=>void}) {
  const [points,setPoints]=useState<PlanPoint[]>([[-3,-2],[3,-2],[3,2],[-3,2]]),[closed,setClosed]=useState(true);
  const [chainId]=useState(()=>crypto.randomUUID());
  const preview=()=>guard(()=>{
    const state=editor.getSnapshot();
    const walls=createWallChain(state.project,level.id,points,closed,chainId);
    if(!state.gestureLabel)editor.begin('Create wall chain');
    editor.preview({type:'insert',entities:walls});
  });
  const active=editor.getSnapshot().gestureLabel;
  return <section className="property-section"><h3>Wall chain</h3><details><summary>Draw with level coordinates</summary>
    <p className="field-hint">2–16 corners. Points snap to wall endpoints within 0.4 m, then a 0.25 m grid and nearby X/Z alignment. Existing corner profiles are inherited.</p>
    <PointList points={points} onChange={setPoints}/><label className="check-field"><input type="checkbox" checked={closed} onChange={e=>setClosed(e.target.checked)}/>Close room</label>
    <button type="button" className="add-object" disabled={!!active&&active!=='Create wall chain'} onClick={preview}>Preview wall chain</button>
    <p className="field-hint">Use Apply changes above to keep the chain, or Cancel preview. Joined endpoints move together. T junctions are deferred.</p>
  </details></section>;
}
