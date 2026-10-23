import {architecturalMaterials,defaultOpeningJoinery,type OpeningJoinery,type Project} from '@openlandcraft/core';
import {CheckboxInput,ColorInput,Field,FieldMessage,NumericInput,SelectInput,SelectOption} from './ui';

/** Shared fields for tool defaults and existing hosted openings. Number text stays editable until Apply. */
export type JoineryDraft={frame:boolean;infill:boolean;width:string;depth:string;thickness:string;opacity:string;frameColor:string;infillColor:string;frameMaterial:string;panelMaterial:string};
export function joineryDraft(kind:'door'|'window',joinery?:OpeningJoinery):JoineryDraft{
 const d=defaultOpeningJoinery(kind),f=joinery?.frame??d.frame!,infill=kind==='door'?joinery?.panel??d.panel!:joinery?.glass??d.glass!;
 return {frame:!!joinery?.frame,infill:!!(joinery?.panel||joinery?.glass),width:String(f.width),depth:String(f.depth),thickness:String(infill.thickness),opacity:String(joinery?.glass?.opacity??.3),frameColor:f.color,infillColor:infill.color,frameMaterial:f.materialId??'local',panelMaterial:joinery?.panel?.materialId??'local'};
}
export function joineryValue(kind:'door'|'window',v:JoineryDraft):OpeningJoinery|undefined{
 const n=(value:string)=>value.trim()?Number(value):NaN;
 if(!v.frame&&!v.infill)return undefined;
 return {...(v.frame?{frame:{width:n(v.width),depth:n(v.depth),color:v.frameColor,...(v.frameMaterial==='local'?{}:{materialId:v.frameMaterial})}}:{}),...(v.infill?kind==='door'?{panel:{thickness:n(v.thickness),color:v.infillColor,...(v.panelMaterial==='local'?{}:{materialId:v.panelMaterial})}}:{glass:{thickness:n(v.thickness),color:v.infillColor,opacity:n(v.opacity)}}:{})};
}
export function OpeningJoineryFields({kind,value,onChange,project,disabled=false}:{kind:'door'|'window';value:JoineryDraft;onChange:(value:JoineryDraft)=>void;project:Project;disabled?:boolean}){
 const change=(patch:Partial<JoineryDraft>)=>onChange({...value,...patch}),library=architecturalMaterials(project);
 const material=(component:'frame'|'panel')=><Field>{component==='frame'?'Frame material':'Panel material'}<SelectInput aria-label={component==='frame'?'Frame material':'Panel material'} value={component==='frame'?value.frameMaterial:value.panelMaterial} disabled={disabled} onValueChange={id=>change(component==='frame'?{frameMaterial:id}:{panelMaterial:id})}><SelectOption value="local">Timber · local color</SelectOption>{library.map(m=><SelectOption key={m.id} value={m.id}>{m.name} · shared</SelectOption>)}</SelectInput></Field>;
 return <fieldset disabled={disabled} className="opening-edit-fields">
  <Field variant="checkbox"><CheckboxInput checked={value.frame} onChange={e=>change({frame:e.target.checked})}/>Frame</Field>
  {value.frame&&<>
   <Field>Frame width · m<NumericInput aria-label="Frame width" min={.02} max={.5} step="any" required value={value.width} onChange={e=>change({width:e.target.value})}/></Field>
   <Field>Frame depth · m<NumericInput aria-label="Frame depth" min={.02} max={.5} step="any" required value={value.depth} onChange={e=>change({depth:e.target.value})}/></Field>
   {material('frame')}
   {value.frameMaterial==='local'&&<Field variant="color"><ColorInput aria-label="Frame color" value={value.frameColor} onChange={e=>change({frameColor:e.target.value})}/><span>Frame color</span></Field>}
  </>}
  <Field>Infill<SelectInput aria-label="Opening infill" value={value.infill?'filled':'transparent'} disabled={disabled} onValueChange={mode=>change({infill:mode==='filled'})}><SelectOption value="transparent">Transparent / open</SelectOption><SelectOption value="filled">{kind==='door'?'Door panel · material':'Window glass · tinted'}</SelectOption></SelectInput></Field>
  {value.infill&&<>
   <Field>{kind==='door'?'Panel':'Glass'} thickness · m<NumericInput aria-label={kind==='door'?'Panel thickness':'Glass thickness'} min={kind==='door'?.02:.005} max={kind==='door'?.2:.05} step="any" required value={value.thickness} onChange={e=>change({thickness:e.target.value})}/></Field>
   {kind==='door'&&material('panel')}
   {(kind==='window'||value.panelMaterial==='local')&&<Field variant="color"><ColorInput aria-label={kind==='door'?'Panel color':'Glass tint'} value={value.infillColor} onChange={e=>change({infillColor:e.target.value})}/><span>{kind==='door'?'Panel color':'Glass tint'}</span></Field>}
   {kind==='window'&&<Field>Glass opacity<NumericInput aria-label="Glass opacity" min={.05} max={.8} step="any" required value={value.opacity} onChange={e=>change({opacity:e.target.value})}/></Field>}
  </>}
  <FieldMessage>Transparent / open leaves the opening clear. Frames, material panels and tinted glass are optional and follow the wall curve and arch. Frame width reduces clear space; depth and thickness are capped at wall thickness.</FieldMessage>
 </fieldset>;
}
