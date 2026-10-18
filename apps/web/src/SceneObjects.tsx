import { memo, useState } from 'react';
import { Box, Leaf, Eye, EyeOff, Layers, Route, Waves } from 'lucide-react';
import type { Editor, Entity } from '@openlandcraft/core';

const SceneRow = memo(function SceneRow({ entity, selected, editor, onSelect, guard }: {
  entity: Entity; selected: boolean; editor: Editor; onSelect: (id: string, additive?:boolean) => void; guard: (run: () => void) => void;
}) {
  return <div className={`tree-row ${selected ? 'selected' : ''}`} role="listitem"><button className={`tree-select ${entity.parentId !== 'site' ? 'child-row' : ''}`} aria-pressed={selected} onClick={(event) => onSelect(entity.id,event.shiftKey)}><span className="tree-guide" />{entity.kind === 'ocean' || entity.kind === 'river' || entity.kind === 'lake' ? <Waves size={16} /> : entity.kind === 'materialRegion'||entity.kind === 'plantingRegion' ? <Leaf size={15}/> : entity.kind === 'path' ? <Route size={15} /> : entity.kind === 'level' ? <Layers size={15} /> : <Box size={15} />}<span>{entity.name}</span></button>
    <button className="icon-button" type="button" aria-label={`${entity.visible ? 'Hide' : 'Show'} ${entity.name}`} title={`${entity.visible ? 'Hide' : 'Show'} ${entity.name}`} onClick={() => guard(() => { editor.cancel(); const current = editor.getSnapshot().project.entities.find((value) => value.id === entity.id)!; editor.execute({ type: 'replace', entity: { ...current, visible: !current.visible } }, `Toggle ${current.name}`); })}>{entity.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button></div>;
});
export const SceneObjects = memo(function SceneObjects({ entities, selectedId, selectedIds=[], editor, onSelect, guard }: {
  entities: Entity[]; selectedId: string | null; selectedIds?:string[]; editor: Editor; onSelect: (id: string, additive?:boolean) => void; guard: (run: () => void) => void;
}) {
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set());
  const row=(entity:Entity)=><SceneRow key={entity.id} entity={entity} selected={selectedIds.length?selectedIds.includes(entity.id):entity.id===selectedId} editor={editor} onSelect={onSelect} guard={guard}/>;
  const memberIds=new Set(entities.flatMap(e=>e.kind==='unit'?e.memberIds:[]));
  const children=(entity:Entity):Entity[]=>entity.kind==='building'
    ?entities.filter(e=>e.kind==='level'&&e.buildingId===entity.id).sort((a,b)=>a.kind==='level'&&b.kind==='level'?a.position[1]-b.position[1]:0)
    :entity.kind==='level'?entities.filter(e=>e.parentId===entity.id&&!memberIds.has(e.id))
    :entity.kind==='unit'?entities.filter(e=>entity.memberIds.includes(e.id)):[];
  const hasSelection=(entity:Entity):boolean=>children(entity).some(e=>e.id===selectedId||hasSelection(e));
  const branch=(entity:Entity):React.ReactNode=>{
    const owned=children(entity),open=expanded.has(entity.id)||hasSelection(entity);
    return <div key={entity.id}>{row(entity)}{!!owned.length&&<><button className="region-tree-toggle" aria-label={`${open?'Collapse':'Expand'} ${entity.name}`} aria-expanded={open} onClick={()=>{if(open&&hasSelection(entity))onSelect(entity.id);setExpanded(before=>{const next=new Set(before);if(open)next.delete(entity.id);else next.add(entity.id);return next;});}}>{open?'−':'+'} {owned.length} {entity.kind==='building'?'floors':entity.kind==='unit'?'unit elements':'floor items'}</button>{open&&<div className="floor-tree-children">{owned.map(branch)}</div>}</>}</div>;
  };
  return <>{entities.filter(e=>!(e.kind==='instance'&&e.regionId)&&e.parentId==='site'&&!(e.kind==='level'&&e.buildingId)).map(entity=>{
    if(entity.kind==='building'||entity.kind==='level')return branch(entity);
    if(entity.kind!=='plantingRegion')return row(entity);
    const plants=entities.filter(e=>e.kind==='instance'&&e.regionId===entity.id),open=expanded.has(entity.id)||plants.some(e=>e.id===selectedId);
    return <div key={entity.id}>{row(entity)}<button className="region-tree-toggle" aria-label={`${open?'Hide':'Show'} plants in ${entity.name}`} aria-expanded={open} onClick={()=>{if(open&&plants.some(e=>e.id===selectedId))onSelect(entity.id);setExpanded(before=>{const next=new Set(before);if(open)next.delete(entity.id);else next.add(entity.id);return next;});}}>{open?'−':'+'} {plants.length} generated plants</button>{open&&<div className="region-tree-children">{plants.map(row)}</div>}</div>;
  })}</>;
});
