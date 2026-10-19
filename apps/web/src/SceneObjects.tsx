import { useMemo, useState } from 'react';
import { Box, ChevronDown, ChevronRight, Eye, EyeOff, Layers, Leaf, LockKeyhole, Mountain, Route, Search, Waves } from 'lucide-react';
import { canEditObject, objectLayerState, type Editor, type Entity, type Project } from '@openlandcraft/core';

export function SceneObjects({ project, selectedId, selectedIds=[], editor, onSelect, guard, isolatedId }: {
  project:Project; selectedId:string|null; selectedIds?:string[]; editor:Editor; onSelect:(id:string,additive?:boolean)=>void; guard:(run:()=>void)=>unknown; isolatedId:string|null;
}) {
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set(['site']));
  const [query,setQuery]=useState('');
  const entities=project.entities;
  const children=useMemo(()=>{
    const map=new Map<string,Entity[]>(),members=new Map(entities.flatMap(e=>e.kind==='unit'?e.memberIds.map(id=>[id,e.id] as const):[]));
    for(const e of entities){const parent=members.get(e.id)??(e.kind==='level'&&e.buildingId?e.buildingId:e.kind==='instance'&&e.regionId?e.regionId:e.parentId);map.set(parent,[...(map.get(parent)??[]),e]);}
    return map;
  },[entities]);
  const toggle=(id:string)=>setExpanded(before=>{const next=new Set(before);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const matches=(e:Entity):boolean=>e.name.toLowerCase().includes(query.toLowerCase())||(children.get(e.id)??[]).some(matches);
  const row=(e:Entity,depth:number):React.ReactNode=>{
    if(query&&!matches(e))return null;
    const owned=children.get(e.id)??[],open=!!query||expanded.has(e.id),status=objectLayerState(project,e.id,isolatedId),selectable=canEditObject(project,e.id,isolatedId);
    const Icon=e.kind==='ocean'||e.kind==='river'||e.kind==='lake'?Waves:e.kind==='plantingRegion'||e.kind==='materialRegion'?Leaf:e.kind==='path'?Route:e.kind==='level'?Layers:Box;
    return <div key={e.id} role="treeitem" aria-level={depth+2} aria-expanded={owned.length?open:undefined} aria-selected={selectedIds.includes(e.id)||selectedId===e.id}>
      <div className={'object-row '+(selectedIds.includes(e.id)||selectedId===e.id?'chosen':'')} style={{paddingLeft:depth*14+6}}>
        <button className="layer-chevron" disabled={!owned.length} aria-label={(open?'Collapse ':'Expand ')+e.name} onClick={()=>toggle(e.id)}>{owned.length>0&&(open?<ChevronDown size={13}/>:<ChevronRight size={13}/>)}</button>
        <button className="object-select" disabled={!selectable} title={status.locked?'Locked by layer':!status.visible?'Hidden by layer':e.name} onClick={event=>onSelect(e.id,event.shiftKey)}><Icon size={14}/><span>{e.name}</span>{status.locked&&<LockKeyhole size={12}/>}</button>
        <button disabled={!selectable} aria-label={(e.visible?'Hide ':'Show ')+e.name} title={(e.visible?'Hide ':'Show ')+e.name} onClick={()=>guard(()=>{editor.cancel();editor.execute({type:'replace',entity:{...e,visible:!e.visible}},'Toggle '+e.name);})}>{e.visible&&status.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button>
      </div>
      {open&&owned.length>0&&<div role="group">{owned.map(child=>row(child,depth+1))}</div>}
    </div>;
  };
  return <section className="objects-panel" aria-label="Objects"><div className="organizer-search"><Search size={14}/><input aria-label="Search objects" placeholder="Search objects…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="organizer-scroll" role="tree" aria-label="Scene objects"><div role="treeitem" aria-expanded={!!query||expanded.has('site')} aria-level={1}><button className="object-site" onClick={()=>toggle('site')}>{query||expanded.has('site')?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<Mountain size={14}/><span>Site</span><small>{project.site.width} × {project.site.depth} m</small></button>{(query||expanded.has('site'))&&<div role="group">{(!query||'site terrain'.includes(query.toLowerCase()))&&<div className={'object-row '+(selectedId==='terrain'?'chosen':'')}><button className="object-select terrain-select" disabled={!canEditObject(project,'terrain',isolatedId)} onClick={()=>onSelect('terrain')}><Mountain size={14}/><span>Site terrain</span></button></div>}{(children.get('site')??[]).map(e=>row(e,0))}</div>}</div></div><div className="object-count">{entities.length+1} objects · {project.layers.length} layers</div></section>;
}
