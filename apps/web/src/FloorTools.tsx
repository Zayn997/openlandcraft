import { Button, ActionRow, CheckboxInput, Field, FieldMessage, Panel, PanelBody, PanelHeading, Row, SelectInput, SelectOption, TextInput } from './ui';
import { ArrowUp, Layers, Package, X } from 'lucide-react';
import { InspectorSection } from './InspectorSection';
import { createUnit, floorHeight, isBuildingPart, ownerLevel, scopeParts, unitForPart, type Editor, type Project } from '@openlandcraft/core';
import { useState } from 'react';

type Props = {project:Project; editor:Editor; selectedId:string|null; selectedIds:string[]; select:(id:string|null)=>void; guard:(run:()=>void)=>unknown; isolate:boolean; onIsolate:(next:boolean)=>void; onClear:()=>void};
export function FloorTools({project,editor,selectedId,selectedIds,select,guard,isolate,onIsolate,onClear}:Props){
  const level=ownerLevel(project,selectedId), selected=project.entities.find(e=>e.id===selectedId);
  const [name,setName]=useState('Unit 1');
  if(!level)return null;
  const levels=project.entities.filter(e=>e.kind==='level'&&(level.buildingId?e.buildingId===level.buildingId:e.id===level.id)).sort((a,b)=>a.kind==='level'&&b.kind==='level'?a.position[1]-b.position[1]:0);
  const parts=scopeParts(project,level.id), unit=selected?.kind==='unit'?selected:selectedId?unitForPart(project,selectedId):undefined;
  const ids=selectedIds.length?selectedIds:selected&&isBuildingPart(selected)?[selected.id]:[];
  const busy=!!editor.getSnapshot().gestureLabel;
  return <Panel className="floor-tools" aria-label="Floor and unit tools">
    <Field>Active floor<SelectInput aria-label="Active floor" value={level.id} disabled={busy} onValueChange={(value) =>select(value)}>{levels.map(e=><SelectOption key={e.id} value={e.id}>{e.name}{e.kind==='level'?` · ${e.position[1].toFixed(2)} m`:''}</SelectOption>)}</SelectInput></Field>
    <Row wrap className="floor-options"><Field variant="checkbox"><CheckboxInput checked={isolate} onChange={e=>onIsolate(e.target.checked)}/>Isolate floor</Field><button disabled={busy} onClick={()=>select(level.id)}>Select whole floor</button></Row>
    {selected&&selected.kind!=='level'&&unit&&selected.kind!=='unit'&&<button className="floor-wide-button" disabled={busy} onClick={()=>select(unit.id)}><Package size={14}/>Select {unit.name}</button>}
    <details><summary>Group elements into a unit</summary><p>Shift-click walls, slabs and a roof in the view or scene list. Doors and windows stay with their walls.</p><Field>Unit name<TextInput aria-label="Unit name" value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></Field>
      <Row wrap className="floor-options"><span>{ids.length} selected</span><button disabled={busy||!ids.length||!name.trim()} onClick={()=>guard(()=>{const u=createUnit(editor.getSnapshot().project,ids,name.trim());editor.execute({type:'add',entity:u},'Group architectural unit');select(u.id);})}>Make unit</button><button aria-label="Clear element selection" onClick={onClear}><X size={14}/></button></Row>
      <button className="floor-wide-button" disabled={busy||!parts.length||parts.some(p=>unitForPart(project,p.id))||!name.trim()} onClick={()=>guard(()=>{const u=createUnit(project,parts.map(p=>p.id),name.trim());editor.execute({type:'add',entity:u},'Group floor as unit');select(u.id);})}>Group this floor as a unit</button>
    </details>
    <FieldMessage>Select a unit or whole floor to use <ArrowUp size={12}/> Duplicate above in Properties. Floor spacing starts at {floorHeight(project,level).toFixed(2)} m.</FieldMessage>
  </Panel>;
}

export function ArchitectureGroupInspector({project,editor,id,select,guard}:Pick<Props,'project'|'editor'|'select'|'guard'>&{id:string}){
  const entity=project.entities.find(e=>e.id===id);
  if(!entity||(entity.kind!=='unit'&&entity.kind!=='building'))return null;
  const children=entity.kind==='unit'?project.entities.filter(e=>entity.memberIds.includes(e.id)):project.entities.filter(e=>e.kind==='level'&&e.buildingId===entity.id).sort((a,b)=>a.kind==='level'&&b.kind==='level'?a.position[1]-b.position[1]:0);
  return <PanelBody><PanelHeading title={<>{entity.name}</>} icon={<>{entity.kind==='unit'?<Package size={18}/>:<Layers size={18}/>}</>} subtitle={<>{entity.kind==='unit'?'Architectural unit':'Building'}</>} />
    <InspectorSection sectionId="group-object" title="Object"><Field>Name<TextInput aria-label="Group name" defaultValue={entity.name} maxLength={80} onBlur={e=>{const name=e.target.value.trim();if(name&&name!==entity.name)guard(()=>editor.execute({type:'replace',entity:{...entity,name}},'Rename '+entity.kind));}}/></Field></InspectorSection>
    <InspectorSection sectionId="group-contents" title={<>{entity.kind==='unit'?'Elements':'Floors'}<span>{children.length}</span></>}>
    {children.map(e=><button key={e.id} className="part-link" onClick={()=>select(e.id)}>{e.name}<span>{e.kind}</span></button>)}
    {!children.length&&<FieldMessage>No {entity.kind==='unit'?'elements':'floors'} yet.</FieldMessage>}
    </InspectorSection>
    {entity.kind==='unit'&&<button className="add-object" disabled={!!editor.getSnapshot().gestureLabel} onClick={()=>guard(()=>{editor.execute({type:'ungroup',id},'Ungroup unit');select(entity.parentId);})}>Ungroup · keep elements</button>}
    <ActionRow><Button variant="destructive" size="sm" className="delete-button" disabled={!!editor.getSnapshot().gestureLabel} onClick={()=>guard(()=>editor.execute({type:'remove',id},`Delete ${entity.kind} and contents`))}>Delete {entity.kind} and its contents</Button></ActionRow>
    <InspectorSection sectionId="group-notes" title="About this group" defaultOpen={false}><FieldMessage>{entity.kind==='unit'?'This unit repeats as editable walls, floors and openings. Its copies are independent.':'Select a floor to edit or duplicate it above.'}</FieldMessage></InspectorSection>
  </PanelBody>;
}
