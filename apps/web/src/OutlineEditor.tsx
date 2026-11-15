import { OutlinePropertiesPanel } from './OutlinePropertiesPanel';
import { Button, ColorInput, Field, FieldControl, FieldGrid, FieldMessage, NumericInput, Row, SelectInput, SelectOption, TextInput } from './ui';
import { useEffect, useState } from 'react';
import { InspectorSection } from './InspectorSection';
import { applyCommand, dragOutline, flatRoofOutline, footprint, insertOutlineCorner, removeOutlineCorner, unitForPart, type Editor, type Level, type OutlinePart } from '@openlandcraft/core';
import type { OutlineHandle } from '../../../packages/viewport/src/outline-edit';
import { ConicalRoofEditor } from './ConicalRoofEditor';
import { StairEditor } from './StairEditor';
import { CircularFloorEditor } from './CircularFloorEditor';
export function OutlineEditor(props:Parameters<typeof PolygonOutlineEditor>[0]){return props.part.kind==='slab'&&props.part.disk?<CircularFloorEditor {...props}/>:props.part.kind==='slab'&&props.part.stairs?<StairEditor {...props}/>:props.part.kind==='roof'&&props.part.cone?<ConicalRoofEditor {...props}/>:<PolygonOutlineEditor {...props}/>;}
function PolygonOutlineEditor(props: {
  onEdit?:()=>void;onAttachStair?:(end:import('@openlandcraft/core').StairEnd)=>void;part:OutlinePart;level?:Level;editing:boolean;editor:Editor;handle:OutlineHandle;onHandle:(handle:OutlineHandle)=>void;snapping:boolean;onSnapping:(value:boolean)=>void;onFrame:()=>void;onFinish:()=>void;onSelect:(id:string)=>void;status:string;onStatus:(message:string)=>void;
}) {
  const {part,level,editing,editor,handle,onHandle,snapping,onSnapping,onFrame,onFinish,onSelect,status,onStatus}=props;
  const points=footprint(part), index=Math.min(handle.index,points.length-1), point=points[index], gable=part.kind==='roof'&&!part.outline, title=part.kind==='slab'?'Floor':'Roof';
  const [x,setX]=useState(String(point[0])),[z,setZ]=useState(String(point[1])),[offset,setOffset]=useState('0');
  useEffect(()=>{setX(String(Number(point[0].toFixed(8))));setZ(String(Number(point[1].toFixed(8))));setOffset('0');},[part,handle.mode,handle.index]);
  const state=editor.getSnapshot(),busy=!!state.gestureLabel,unit=unitForPart(state.project,part.id);
  const commit=(next:()=>OutlinePart,label:string)=>{try{editor.execute({type:'replace',entity:next()},label);onStatus(label+' applied.');}catch(error){onStatus(error instanceof Error?error.message:'Invalid outline.');}};
  let candidate:OutlinePart|undefined,issue='';
  const number=(value:string)=>value.trim()===''?NaN:Number(value);
  const handleChanged=handle.mode==='vertex'?x.trim()===''||z.trim()===''||Math.abs(number(x)-point[0])>1e-8||Math.abs(number(z)-point[1])>1e-8:offset.trim()===''||Math.abs(number(offset))>1e-8;
  if(editing&&handleChanged&&!busy)try{
    const q=points[(index+1)%points.length],dx=q[0]-point[0],dz=q[1]-point[1],length=Math.hypot(dx,dz);
    const delta:[number,number]=handle.mode==='vertex'?[number(x)-point[0],number(z)-point[1]]:[-dz/length*number(offset),dx/length*number(offset)];
    candidate=dragOutline(part,handle.mode,index,delta,false);applyCommand(state.project,{type:'replace',entity:candidate});
  }catch(error){issue=error instanceof Error?error.message:'Invalid outline.';}
  const changed=candidate&&JSON.stringify(candidate)!==JSON.stringify(part);
  const valueOf=(p:OutlinePart)=>({name:p.name,color:p.color,centerX:String(p.center[0]),centerZ:String(p.center[1]),width:String(p.width),depth:String(p.depth),elevation:String(p.elevation),thickness:String(p.kind==='slab'?p.thickness:p.rise)});
  const [values,setValues]=useState(()=>valueOf(part));useEffect(()=>setValues(valueOf(part)),[part]);
  const profile=():OutlinePart=>({...part,name:values.name,color:values.color,center:[number(values.centerX),number(values.centerZ)],width:number(values.width),depth:number(values.depth),elevation:number(values.elevation),...(part.kind==='slab'?{thickness:number(values.thickness)}:{rise:number(values.thickness)})});
  const profileChanged=JSON.stringify(values)!==JSON.stringify(valueOf(part));
  let profileIssue='';if(profileChanged&&!busy)try{applyCommand(state.project,{type:'replace',entity:profile()});}catch(error){profileIssue=error instanceof Error?error.message:'Invalid dimensions.';}
  return <OutlinePropertiesPanel {...props} title={title}>
<form onSubmit={e=>{e.preventDefault();if(profileChanged&&!busy&&!profileIssue)commit(profile,'Edit outline properties');}}><fieldset className="opening-edit-fields" disabled={busy}>
        <Field>Name<TextInput aria-label="Outline name" value={values.name} required maxLength={80} onChange={e=>setValues(v=>({...v,name:e.target.value}))}/></Field>
        <FieldGrid columns={2}>{([...(!part.outline?['width','depth']:[]),'elevation','thickness','centerX','centerZ'] as const).map(key=><Field variant="number" key={key}><span>{key==='thickness'?(gable?'Roof rise':'Thickness'):{centerX:'Center X',centerZ:'Center Z',width:'Width',depth:'Depth',elevation:'Base elevation'}[key]}</span><FieldControl><NumericInput aria-label={'Outline '+key} step="any" value={values[key as keyof typeof values]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/><small>m</small></FieldControl></Field>)}</FieldGrid>
        <Field variant="color"><ColorInput aria-label="Outline color" disabled={!!part.materialId} title={part.materialId?'Color comes from the shared Material section':undefined} value={values.color} onChange={e=>setValues(v=>({...v,color:e.target.value}))}/><span>Color</span></Field>
        {profileIssue&&<FieldMessage tone="error" role="alert">{profileIssue}</FieldMessage>}<Button type="submit" variant="default" className="primary-button" disabled={!!profileIssue||JSON.stringify(values)===JSON.stringify(valueOf(part))}>Apply outline properties</Button>
      </fieldset></form>
{editing&&<InspectorSection sectionId="outline-handles" title="Outline handles">      <Field>Selected handle<SelectInput aria-label="Outline handle" disabled={busy} value={handle.mode+'-'+index} onValueChange={(value) =>{const [mode,i]=value.split('-');onHandle({mode:mode as OutlineHandle['mode'],index:Number(i)});}}>{points.flatMap((_,i)=>[<SelectOption key={'v'+i} value={'vertex-'+i}>Corner {i+1}</SelectOption>,<SelectOption key={'e'+i} value={'edge-'+i}>Edge {i+1} → {(i+1)%points.length+1}</SelectOption>])}</SelectInput></Field>
      <form onSubmit={e=>{e.preventDefault();if(candidate&&!issue&&changed)commit(()=>candidate!,'Edit outline handle');}}><fieldset className="opening-edit-fields" disabled={busy}>
        <FieldGrid columns={2}>{handle.mode==='vertex'?<><Field variant="number"><span>Corner X</span><NumericInput aria-label="Outline corner X" step="any" value={x} onChange={e=>setX(e.target.value)}/></Field><Field variant="number"><span>Corner Z</span><NumericInput aria-label="Outline corner Z" step="any" value={z} onChange={e=>setZ(e.target.value)}/></Field></>:<Field variant="number"><span>Edge offset · m</span><NumericInput aria-label="Outline edge offset" step="any" value={offset} onChange={e=>setOffset(e.target.value)}/></Field>}</FieldGrid>
        {issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}<Button type="submit" variant="default" className="primary-button" disabled={!changed||!!issue}>Apply handle position</Button>
      </fieldset></form>
      {!gable&&<Row className="part-buttons"><button disabled={busy||points.length>=16} onClick={()=>commit(()=>insertOutlineCorner(part,index),'Add outline corner')}>Add corner after {index+1}</button><button disabled={busy||handle.mode!=='vertex'||points.length<=3} onClick={()=>{commit(()=>removeOutlineCorner(part,index),'Remove outline corner');onHandle({mode:'vertex',index:0});}}>Remove corner {index+1}</button></Row>}
      {gable&&<Button variant="ghost" className="text-button" disabled={busy} onClick={()=>commit(()=>flatRoofOutline(part),'Convert to flat roof')}>Convert to flat outline · 0.20 m thick</Button>}
</InspectorSection>}
<InspectorSection sectionId="outline-shape" title="Shape options" defaultOpen={false}>      {part.outline&&<Button variant="ghost" className="text-button" disabled={busy} onClick={()=>commit(()=>({...part,outline:undefined}),'Restore rectangular '+title.toLowerCase())}>Restore {part.kind==='roof'?'gable':'rectangle'} · {part.width} × {part.depth} m{part.kind==='roof'?' · '+part.rise+' m rise':''}</Button>}
{part.kind==='slab'&&part.stairOpenings?.map(cut=><Button key={cut.stairId} variant="ghost" onClick={()=>onSelect(cut.stairId)}>Select attached stairs</Button>)}</InspectorSection>
</OutlinePropertiesPanel>;
}
