import {useCallback,useEffect,useMemo,useState} from 'react';
import {ZodError} from 'zod';
import {mirrorSources,mirrorOwner,mirrorMember,mirrorSourceIds,mirrorMemberId,mirrorSelection,mirrorReferenceLines,type Editor,type MirrorRule,type MirrorReferenceLine,type PlanPoint} from '@openlandcraft/core';
import type {MirrorAxisInput} from '@openlandcraft/viewport';
import {Button,Field,FieldMessage,NumberField,Panel,PanelHeading,Row,SelectInput,SelectOption,TextInput} from './ui';
import {InspectorSection} from './InspectorSection';

export type MirrorRequest={ruleId?:string;sourceIds?:string[];repeatId?:string};
export function MirrorPanel({editor,request,onClose,onSelect,onGuide,onInput,onReferenceGuide}:{editor:Editor;request:MirrorRequest;onClose:()=>void;onSelect:(id:string)=>void;onGuide:(rule:MirrorRule|null)=>void;onInput:(input:MirrorAxisInput|null)=>void;onReferenceGuide:(line:MirrorReferenceLine|null)=>void}){
 const state=editor.getSnapshot(),project=state.project,existing=project.mirrorRules?.find(rule=>rule.id===request.ruleId);
 const [draft,setDraft]=useState<MirrorRule>(()=>existing??{id:crypto.randomUUID(),name:'Garden symmetry',start:[0,0],end:[0,0],...(request.repeatId?{repeatId:request.repeatId}:mirrorSelection(project,request.sourceIds??[],state.isolatedLayerId)??{sourceIds:[]})});
 const [mode,setMode]=useState<'choose'|'draw'|'reference'|'ready'>(existing?'ready':'choose');
 const [points,setPoints]=useState<PlanPoint[]>([]),[referenceId,setReferenceId]=useState(''),[error,setError]=useState('');
 const references=useMemo(()=>mirrorReferenceLines(project,state.isolatedLayerId),[project,state.isolatedLayerId]);
 const preview=useCallback((next:MirrorRule)=>{
  setDraft(next);
  try{if(!editor.getSnapshot().gestureLabel)editor.begin('Mirror preview');editor.preview({type:'mirror',rule:next});onGuide(next);setError('');}
  catch(error){editor.cancel();onGuide(null);setError(error instanceof ZodError?error.issues[0]?.message??'Choose a valid mirror axis and source.':(error as Error).message);}
 },[editor,onGuide]);
 const point=useCallback((point:PlanPoint)=>{
  if(!points.length){setPoints([point]);setError('');return;}
  if(Math.hypot(point[0]-points[0][0],point[1]-points[0][1])<0.2){setError('Place the axis end at least 0.2 m from its start.');return;}
  preview({...draft,start:points[0],end:point});setMode('ready');
 },[points,draft,preview]);
 const reference=useCallback((line:MirrorReferenceLine)=>{
  setReferenceId(line.id);onReferenceGuide(line);preview({...draft,start:[...line.start],end:[...line.end]});setMode('ready');
 },[draft,onReferenceGuide,preview]);
 useEffect(()=>{onInput(mode==='draw'||mode==='reference'?{mode,points,onPoint:point,onReference:reference}:null);},[mode,points,point,reference,onInput]);
 useEffect(()=>{
  if(existing)onGuide(existing);
  return()=>{onInput(null);onGuide(null);onReferenceGuide(null);if(editor.getSnapshot().gestureLabel==='Mirror preview')editor.cancel();};
 },[]);
 const sourceIds=mirrorSourceIds(project,draft),hasSources=sourceIds.length>0;
 const copyCount=mode==='ready'?sourceIds.filter(id=>{const e=project.entities.find(e=>e.id===id);return e&&(e.kind==='block'||e.kind==='instance'||e.kind==='hedge')&&!draft.excluded?.includes(id)&&!!mirrorMember(e,draft);}).length:0;
 const choose=(next:'draw'|'reference')=>{if(editor.getSnapshot().gestureLabel==='Mirror preview')editor.cancel();onGuide(null);onReferenceGuide(null);setReferenceId('');setPoints([]);setError('');setMode(next);};
 const sourceNames=sourceIds.slice(0,3).map(id=>project.entities.find(entity=>entity.id===id)?.name).filter(Boolean).join(', ');
 const referenceName=references.find(line=>line.id===referenceId)?.name;
 return <Panel padding="body" aria-label="Mirror tool"><PanelHeading title={existing?'Edit symmetry':'Mirror / symmetry'} subtitle="SELECT ELEMENTS · CHOOSE AXIS · APPLY"/>
  <InspectorSection sectionId="mirror-sources" title={`Selected sources (${sourceIds.length})`}>
   <FieldMessage>{hasSources?`${sourceNames}${sourceIds.length>3?` and ${sourceIds.length-3} more`:''}${draft.repeatId?' · whole repeat':''}`:'Select at least one static model, massing block or clipped hedge before starting Mirror.'}</FieldMessage>
   <FieldMessage>These originals stay selected and in place while you choose the mirror axis.</FieldMessage>
  </InspectorSection>
  <InspectorSection sectionId="mirror-axis" title="Mirror axis">
   <Row className="flex-wrap"><Button variant={mode==='draw'?'secondary':'outline'} disabled={!hasSources} aria-pressed={mode==='draw'} onClick={()=>choose('draw')}>Draw mirror line</Button><Button variant={mode==='reference'?'secondary':'outline'} disabled={!hasSources||!references.length} aria-pressed={mode==='reference'} onClick={()=>choose('reference')}>Use scene line</Button></Row>
   <FieldMessage role="status">{mode==='choose'?'Draw a two-point line, or use a straight edge or line already in the scene.':mode==='draw'?points.length?'Click the axis end. Hold Shift to align with X or Z.':'Click the axis start in the scene.':mode==='reference'?'Hover a straight scene line to highlight it, then click to use it.':referenceName?`Reference: ${referenceName}`:'Mirror axis ready. Review the translucent copies, then apply.'}</FieldMessage>
   {mode==='reference'&&<Field>Reference line<SelectInput aria-label="Scene reference line" placeholder="Choose a scene line" value="" onValueChange={id=>{const line=references.find(line=>line.id===id);if(line)reference(line);}}>{references.map(line=><SelectOption key={line.id} value={line.id}>{line.name}</SelectOption>)}</SelectInput></Field>}
   {(mode==='reference'||referenceId)&&<FieldMessage><span className="text-[#76d6e5]">Cyan: reference line.</span> <span className="text-[#edc37e]">Amber dashes: mirror axis.</span></FieldMessage>}
   {mode==='ready'&&<InspectorSection sectionId="mirror-axis-coordinates" title="Axis coordinates" defaultOpen={false}>
    {(['start','end'] as const).map(key=><Row key={key}>{draft[key].map((value,i)=><NumberField key={i} label={`Mirror axis ${key} ${i===0?'X':'Z'}`} value={value} min={-500} max={500} onChange={n=>{setReferenceId('');onReferenceGuide(null);preview({...draft,[key]:draft[key].map((v,j)=>i===j?n:v)});}}/>)}</Row>)}
   </InspectorSection>}
  </InspectorSection>
  <Field>Symmetry name<TextInput aria-label="Symmetry name" value={draft.name} maxLength={80} onChange={e=>mode==='ready'?preview({...draft,name:e.target.value}):setDraft({...draft,name:e.target.value})}/></Field>
  {mode==='ready'&&<FieldMessage>{sourceIds.length} {sourceIds.length===1?'source':'sources'} · {copyCount} mirrored {copyCount===1?'copy':'copies'}. Translucent copies are a preview; Apply makes them solid. Objects on the axis remain single.</FieldMessage>}
  {error&&<FieldMessage tone="error" role="alert">{error}</FieldMessage>}
  <Row><Button disabled={mode!=='ready'||!!error||!copyCount||!state.preview} onClick={()=>{editor.commit();const id=sourceIds.find(id=>{const e=project.entities.find(e=>e.id===id);return e&&(e.kind==='block'||e.kind==='instance'||e.kind==='hedge')&&!draft.excluded?.includes(id)&&!!mirrorMember(e,draft);});onClose();if(id)onSelect(mirrorMemberId(draft,id));}}>Apply symmetry</Button><Button variant="ghost" onClick={()=>{editor.cancel();onClose();}}>Cancel</Button></Row>
 </Panel>;
}
export function MirrorSelection({editor,id,onEdit,onSelect,onError}:{editor:Editor;id:string;onEdit:(request:MirrorRequest)=>void;onSelect:(id:string)=>void;onError:(s:string)=>void}){
 const p=editor.getSnapshot().project,owner=mirrorOwner(p,id),rules=owner?[owner.rule]:(p.mirrorRules??[]).filter(r=>mirrorSourceIds(p,r).includes(id));
 const busy=!!editor.getSnapshot().gestureLabel,run=(f:()=>void)=>{try{f();}catch(e){onError((e as Error).message);}};
 if(!rules.length&&!mirrorSources(p).some(e=>e.id===id))return null;
 return <InspectorSection sectionId="mirror-selection" title={owner?'Mirrored object':'Symmetry'} className="mx-panel" defaultOpen={false}>
  {owner&&<><FieldMessage>Position, orientation and shape follow the source across the mirror axis. Detach this copy to edit them independently.</FieldMessage><Row><Button type="button" variant="ghost" disabled={busy} onClick={()=>onSelect(owner.sourceId)}>Edit source</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>run(()=>editor.execute({type:'detachMirrorMember',id},'Detach mirrored object'))}>Detach mirror copy</Button></Row></>}
  {!owner&&<Button type="button" variant="outline" disabled={busy} onClick={()=>onEdit({sourceIds:[id]})}>Mirror this object</Button>}
  {rules.map(r=><div key={r.id}><FieldMessage>{r.name}</FieldMessage><Row className="flex-wrap"><Button type="button" variant="outline" disabled={busy} onClick={()=>onEdit({ruleId:r.id})}>Edit mirror axis</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>run(()=>editor.execute({type:'removeMirror',id:r.id},'Make mirrors independent'))}>Make copies independent</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>run(()=>editor.execute({type:'removeMirror',id:r.id,deleteObjects:true},'Remove mirrored copies'))}>Remove mirrored copies</Button></Row></div>)}
 </InspectorSection>;
}
