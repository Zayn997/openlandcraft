import { Button, PanelHeading, CheckboxInput, ColorInput, Field, FieldGrid, FieldMessage, NumericInput, Panel, Row, SelectInput, SelectOption, TextInput } from './ui';
import { useEffect, useState } from 'react';
import { InspectorSection } from './InspectorSection';
import { applyCommand, dragOutline, flatRoofOutline, footprint, insertOutlineCorner, removeOutlineCorner, unitForPart, type Editor, type Level, type OutlinePart } from '@openlandcraft/core';
import type { OutlineHandle } from '../../../packages/viewport/src/outline-edit';
export function OutlineEditor({ part, level, editing, editor, handle, onHandle, snapping, onSnapping, onFrame, onFinish, onSelect, status, onStatus }: {
  part:OutlinePart;level?:Level;editing:boolean;editor:Editor;handle:OutlineHandle;onHandle:(handle:OutlineHandle)=>void;snapping:boolean;onSnapping:(value:boolean)=>void;onFrame:()=>void;onFinish:()=>void;onSelect:(id:string)=>void;status:string;onStatus:(message:string)=>void;
}) {
  const points=footprint(part), index=Math.min(handle.index,points.length-1), point=points[index], gable=part.kind==='roof'&&!part.outline, title=part.kind==='slab'?'Floor':'Roof';
  const [x,setX]=useState(''),[z,setZ]=useState(''),[offset,setOffset]=useState('0');
  useEffect(()=>{setX(String(Number(point[0].toFixed(8))));setZ(String(Number(point[1].toFixed(8))));setOffset('0');},[part,handle.mode,handle.index]);
  const state=editor.getSnapshot(),busy=!!state.gestureLabel,unit=unitForPart(state.project,part.id);
  const commit=(next:()=>OutlinePart,label:string)=>{try{editor.execute({type:'replace',entity:next()},label);onStatus(label+' applied.');}catch(error){onStatus(error instanceof Error?error.message:'Invalid outline.');}};
  let candidate:OutlinePart|undefined,issue='';
  const number=(value:string)=>value.trim()===''?NaN:Number(value);
  if(editing&&!busy)try{
    const q=points[(index+1)%points.length],dx=q[0]-point[0],dz=q[1]-point[1],length=Math.hypot(dx,dz);
    const delta:[number,number]=handle.mode==='vertex'?[number(x)-point[0],number(z)-point[1]]:[-dz/length*number(offset),dx/length*number(offset)];
    candidate=dragOutline(part,handle.mode,index,delta,false);applyCommand(state.project,{type:'replace',entity:candidate});
  }catch(error){issue=error instanceof Error?error.message:'Invalid outline.';}
  const changed=candidate&&JSON.stringify(candidate)!==JSON.stringify(part);
  const valueOf=(p:OutlinePart)=>({name:p.name,color:p.color,centerX:String(p.center[0]),centerZ:String(p.center[1]),width:String(p.width),depth:String(p.depth),elevation:String(p.elevation),thickness:String(p.kind==='slab'?p.thickness:p.rise)});
  const [values,setValues]=useState(()=>valueOf(part));useEffect(()=>setValues(valueOf(part)),[part]);
  const profile=():OutlinePart=>({...part,name:values.name,color:values.color,center:[number(values.centerX),number(values.centerZ)],width:number(values.width),depth:number(values.depth),elevation:number(values.elevation),...(part.kind==='slab'?{thickness:number(values.thickness)}:{rise:number(values.thickness)})});
  let profileIssue='';if(editing&&!busy)try{applyCommand(state.project,{type:'replace',entity:profile()});}catch(error){profileIssue=error instanceof Error?error.message:'Invalid dimensions.';}
  return <Panel padding="body" className="opening-tools" aria-label={editing?'Edit '+title.toLowerCase()+' outline':'Selected '+title.toLowerCase()}>
    <PanelHeading title={<>{editing?'Editing '+title.toLowerCase()+' outline':title+' selected'}</>} subtitle={<>{editing?'EDIT OUTLINE':'SELECTED ELEMENT'}</>} />
    <FieldMessage>{part.name} · {level?.name}</FieldMessage>
    <p className="opening-feedback" role="status">{editing?status:'Double-click to edit the outline. You can also press Enter.'}</p>
    <FieldMessage>{gable?'Pitched gable · rectangular footprint':points.length+' corners · '+(part.kind==='slab'?'floor slab':'flat roof')}</FieldMessage>
    <Button variant="ghost" className="text-button" onClick={onFrame}>Frame selected outline · F</Button>
    {editing&&<>
      <FieldMessage>Drag round corners or square edge handles. Drag the surface to move the whole outline. {part.kind==='slab'?'Walls and roofs are hidden while editing this floor.':'Only this floor is shown.'} Walls and other floors keep their geometry.</FieldMessage>
      {gable&&<FieldMessage>Corner and edge drags keep the roof rectangular and pitched. Convert explicitly for a custom flat outline.</FieldMessage>}
      <Field variant="checkbox"><CheckboxInput checked={snapping} disabled={busy} onChange={e=>onSnapping(e.target.checked)}/>Snap outline edits to 0.25 m</Field>
      <Field>Selected handle<SelectInput aria-label="Outline handle" disabled={busy} value={handle.mode+'-'+index} onValueChange={(value) =>{const [mode,i]=value.split('-');onHandle({mode:mode as OutlineHandle['mode'],index:Number(i)});}}>{points.flatMap((_,i)=>[<SelectOption key={'v'+i} value={'vertex-'+i}>Corner {i+1}</SelectOption>,<SelectOption key={'e'+i} value={'edge-'+i}>Edge {i+1} → {(i+1)%points.length+1}</SelectOption>])}</SelectInput></Field>
      <form onSubmit={e=>{e.preventDefault();if(candidate&&!issue&&changed)commit(()=>candidate!,'Edit outline handle');}}><fieldset className="opening-edit-fields" disabled={busy}>
        <FieldGrid columns={2}>{handle.mode==='vertex'?<><Field variant="number"><span>Corner X</span><NumericInput aria-label="Outline corner X" step="any" value={x} onChange={e=>setX(e.target.value)}/></Field><Field variant="number"><span>Corner Z</span><NumericInput aria-label="Outline corner Z" step="any" value={z} onChange={e=>setZ(e.target.value)}/></Field></>:<Field variant="number"><span>Edge offset · m</span><NumericInput aria-label="Outline edge offset" step="any" value={offset} onChange={e=>setOffset(e.target.value)}/></Field>}</FieldGrid>
        {issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}<Button variant="default" className="primary-button" disabled={!changed||!!issue}>Apply handle position</Button>
      </fieldset></form>
      {!gable&&<Row className="part-buttons"><button disabled={busy||points.length>=16} onClick={()=>commit(()=>insertOutlineCorner(part,index),'Add outline corner')}>Add corner after {index+1}</button><button disabled={busy||handle.mode!=='vertex'||points.length<=3} onClick={()=>{commit(()=>removeOutlineCorner(part,index),'Remove outline corner');onHandle({mode:'vertex',index:0});}}>Remove corner {index+1}</button></Row>}
      {gable&&<Button variant="ghost" className="text-button" disabled={busy} onClick={()=>commit(()=>flatRoofOutline(part),'Convert to flat roof')}>Convert to flat outline · 0.20 m thick</Button>}
      <InspectorSection sectionId="outline-dimensions" title="Dimensions & appearance" defaultOpen={false}><form onSubmit={e=>{e.preventDefault();if(!profileIssue)commit(profile,'Edit outline properties');}}><fieldset className="opening-edit-fields" disabled={busy}>
        <Field>Name<TextInput aria-label="Outline name" value={values.name} required maxLength={80} onChange={e=>setValues(v=>({...v,name:e.target.value}))}/></Field>
        <FieldGrid columns={2}>{(['centerX','centerZ',...(!part.outline?['width','depth']:[]),'elevation','thickness'] as const).map(key=><Field variant="number" key={key}><span>{key==='thickness'?(gable?'Roof rise':'Thickness'):key}</span><NumericInput aria-label={'Outline '+key} step="any" value={values[key as keyof typeof values]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></Field>)}</FieldGrid>
        <Field variant="color"><ColorInput aria-label="Outline color" value={values.color} onChange={e=>setValues(v=>({...v,color:e.target.value}))}/><span>Color</span></Field>
        {profileIssue&&<FieldMessage tone="error" role="alert">{profileIssue}</FieldMessage>}<Button variant="default" className="primary-button" disabled={!!profileIssue||JSON.stringify(values)===JSON.stringify(valueOf(part))}>Apply outline properties</Button>
      </fieldset></form></InspectorSection>
      {part.outline&&<Button variant="ghost" className="text-button" disabled={busy} onClick={()=>commit(()=>({...part,outline:undefined}),'Restore rectangular '+title.toLowerCase())}>Restore {part.kind==='roof'?'gable':'rectangle'} · {part.width} × {part.depth} m{part.kind==='roof'?' · '+part.rise+' m rise':''}</Button>}
      <Button variant="ghost" className="text-button" disabled={busy} onClick={()=>{try{editor.execute({type:'remove',id:part.id},'Delete '+title.toLowerCase());onFinish();}catch(error){onStatus(error instanceof Error?error.message:'Cannot delete element.');}}}>Delete {title.toLowerCase()}</Button>
      <Button variant="default" className="primary-button" onClick={onFinish}>Finish editing <span>Esc</span></Button>
    </>}
    {level&&<Button variant="ghost" className="text-button" onClick={()=>onSelect(level.id)}>Select whole floor · {level.name}</Button>}{unit&&<Button variant="ghost" className="text-button" onClick={()=>onSelect(unit.id)}>Select whole unit · {unit.name}</Button>}
  </Panel>;
}
