import { OutlinePropertiesPanel } from './OutlinePropertiesPanel';
import { FieldGrid, FieldControl } from './ui';
import { useEffect, useMemo, useState } from 'react';
import { applyCommand, updateCircularFloor, type Slab } from '@openlandcraft/core';
import type { OutlineEditor } from './OutlineEditor';
import { Button, Field, FieldMessage, NumericInput, TextInput } from './ui';
export function CircularFloorEditor(props:Parameters<typeof OutlineEditor>[0]){
 const {part,editing,editor,onStatus}=props;
 const floor=part as Slab,valuesFor=()=>({radius:String(floor.disk!.radius),centerX:String(floor.center[0]),centerZ:String(floor.center[1]),elevation:String(floor.elevation),thickness:String(floor.thickness)});
 const [values,setValues]=useState(valuesFor),[name,setName]=useState(part.name);useEffect(()=>{setValues(valuesFor());setName(part.name);},[part]);
 const state=editor.getSnapshot(),n=(key:keyof typeof values)=>values[key].trim()?Number(values[key]):NaN;
 const changed=name!==floor.name||(Object.keys(values) as (keyof typeof values)[]).some(key=>!values[key].trim()||Math.abs(n(key)-Number(valuesFor()[key]))>1e-8);
 const {candidate,error}=useMemo(()=>{
  if(!changed||state.gestureLabel)return {candidate:undefined,error:''};
  try{const candidate={...updateCircularFloor(floor,{radius:n('radius'),center:[n('centerX'),n('centerZ')],elevation:n('elevation'),thickness:n('thickness')}),name};applyCommand(state.project,{type:'replace',entity:candidate});return {candidate,error:''};}
  catch(e){return {candidate:undefined,error:(e as Error).message};}
 },[floor,values,name,editing,changed,state.project,state.gestureLabel]);
 return <OutlinePropertiesPanel {...props} title="Circular floor"><form onSubmit={e=>{e.preventDefault();if(candidate&&!error)try{editor.execute({type:'replace',entity:candidate},'Edit circular floor');onStatus('Circular floor updated.');}catch(e){onStatus((e as Error).message);}}}><fieldset className="opening-edit-fields" disabled={!!state.gestureLabel}><Field>Name<TextInput aria-label="Circular floor name" value={name} required maxLength={80} onChange={e=>setName(e.target.value)}/></Field><FieldGrid columns={2}>{(Object.keys(values) as (keyof typeof values)[]).map(key=><Field key={key}>{({radius:'Floor radius',centerX:'Center X',centerZ:'Center Z',elevation:'Floor base elevation',thickness:'Floor thickness'})[key]}<FieldControl><NumericInput aria-label={key==='radius'?'Floor radius':key==='thickness'?'Floor thickness':`Floor ${key}`} required step="any" value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/><small>m</small></FieldControl></Field>)}</FieldGrid>{error&&<FieldMessage tone="error" role="alert">{error}</FieldMessage>}<Button type="submit" disabled={!changed||!!state.gestureLabel||!!error}>Apply floor dimensions</Button></fieldset></form></OutlinePropertiesPanel>;
}
