import { useEffect, useState } from 'react';
import { applyCommand, dragOutline, flatRoofOutline, footprint, insertOutlineCorner, removeOutlineCorner, unitForPart, type Editor, type Level, type OutlinePart } from '@openlandcraft/core';
import type { OutlineHandle } from '../../../packages/viewport/src/outline-edit';
import './openings.css';
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
  return <section className="opening-tools" aria-label={editing?'Edit '+title.toLowerCase()+' outline':'Selected '+title.toLowerCase()}>
    <div className="opening-tool-heading"><span>{editing?'EDIT OUTLINE':'SELECTED ELEMENT'}</span><h2>{editing?'Editing '+title.toLowerCase()+' outline':title+' selected'}</h2></div>
    <p className="field-hint">{part.name} · {level?.name}</p>
    <p className="opening-feedback" role="status">{editing?status:'Double-click to edit the outline. You can also press Enter.'}</p>
    <p className="field-hint">{gable?'Pitched gable · rectangular footprint':points.length+' corners · '+(part.kind==='slab'?'floor slab':'flat roof')}</p>
    <button className="text-button" onClick={onFrame}>Frame selected outline · F</button>
    {editing&&<>
      <p className="field-hint">Drag round corners or square edge handles. Drag the surface to move the whole outline. {part.kind==='slab'?'Walls and roofs are hidden while editing this floor.':'Only this floor is shown.'} Walls and other floors keep their geometry.</p>
      {gable&&<p className="field-hint">Corner and edge drags keep the roof rectangular and pitched. Convert explicitly for a custom flat outline.</p>}
      <label className="check-field"><input type="checkbox" checked={snapping} disabled={busy} onChange={e=>onSnapping(e.target.checked)}/>Snap outline edits to 0.25 m</label>
      <label className="name-field">Selected handle<select aria-label="Outline handle" disabled={busy} value={handle.mode+'-'+index} onChange={e=>{const [mode,i]=e.target.value.split('-');onHandle({mode:mode as OutlineHandle['mode'],index:Number(i)});}}>{points.flatMap((_,i)=>[<option key={'v'+i} value={'vertex-'+i}>Corner {i+1}</option>,<option key={'e'+i} value={'edge-'+i}>Edge {i+1} → {(i+1)%points.length+1}</option>])}</select></label>
      <form onSubmit={e=>{e.preventDefault();if(candidate&&!issue&&changed)commit(()=>candidate!,'Edit outline handle');}}><fieldset className="opening-edit-fields" disabled={busy}>
        <div className="construction-fields">{handle.mode==='vertex'?<><label className="number-field"><span>Corner X</span><input aria-label="Outline corner X" type="number" step="any" value={x} onChange={e=>setX(e.target.value)}/></label><label className="number-field"><span>Corner Z</span><input aria-label="Outline corner Z" type="number" step="any" value={z} onChange={e=>setZ(e.target.value)}/></label></>:<label className="number-field"><span>Edge offset · m</span><input aria-label="Outline edge offset" type="number" step="any" value={offset} onChange={e=>setOffset(e.target.value)}/></label>}</div>
        {issue&&<p role="alert" className="field-hint">{issue}</p>}<button className="primary-button" disabled={!changed||!!issue}>Apply handle position</button>
      </fieldset></form>
      {!gable&&<div className="part-buttons"><button disabled={busy||points.length>=16} onClick={()=>commit(()=>insertOutlineCorner(part,index),'Add outline corner')}>Add corner after {index+1}</button><button disabled={busy||handle.mode!=='vertex'||points.length<=3} onClick={()=>{commit(()=>removeOutlineCorner(part,index),'Remove outline corner');onHandle({mode:'vertex',index:0});}}>Remove corner {index+1}</button></div>}
      {gable&&<button className="text-button" disabled={busy} onClick={()=>commit(()=>flatRoofOutline(part),'Convert to flat roof')}>Convert to flat outline · 0.20 m thick</button>}
      <details><summary>Dimensions and appearance</summary><form onSubmit={e=>{e.preventDefault();if(!profileIssue)commit(profile,'Edit outline properties');}}><fieldset className="opening-edit-fields" disabled={busy}>
        <label className="name-field">Name<input aria-label="Outline name" value={values.name} required maxLength={80} onChange={e=>setValues(v=>({...v,name:e.target.value}))}/></label>
        <div className="construction-fields">{(['centerX','centerZ',...(!part.outline?['width','depth']:[]),'elevation','thickness'] as const).map(key=><label className="number-field" key={key}><span>{key==='thickness'?(gable?'Roof rise':'Thickness'):key}</span><input aria-label={'Outline '+key} type="number" step="any" value={values[key as keyof typeof values]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></label>)}</div>
        <label className="color-field"><input aria-label="Outline color" type="color" value={values.color} onChange={e=>setValues(v=>({...v,color:e.target.value}))}/><span>Color</span></label>
        {profileIssue&&<p role="alert" className="field-hint">{profileIssue}</p>}<button className="primary-button" disabled={!!profileIssue||JSON.stringify(values)===JSON.stringify(valueOf(part))}>Apply outline properties</button>
      </fieldset></form></details>
      {part.outline&&<button className="text-button" disabled={busy} onClick={()=>commit(()=>({...part,outline:undefined}),'Restore rectangular '+title.toLowerCase())}>Restore {part.kind==='roof'?'gable':'rectangle'} · {part.width} × {part.depth} m{part.kind==='roof'?' · '+part.rise+' m rise':''}</button>}
      <button className="text-button" disabled={busy} onClick={()=>{try{editor.execute({type:'remove',id:part.id},'Delete '+title.toLowerCase());onFinish();}catch(error){onStatus(error instanceof Error?error.message:'Cannot delete element.');}}}>Delete {title.toLowerCase()}</button>
      <button className="primary-button" onClick={onFinish}>Finish editing <span>Esc</span></button>
    </>}
    {level&&<button className="text-button" onClick={()=>onSelect(level.id)}>Select whole floor · {level.name}</button>}{unit&&<button className="text-button" onClick={()=>onSelect(unit.id)}>Select whole unit · {unit.name}</button>}
  </section>;
}
