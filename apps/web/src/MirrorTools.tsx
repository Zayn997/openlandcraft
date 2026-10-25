import {useEffect,useState} from 'react';
import {ZodError} from 'zod';
import {mirrorSources,mirrorOwner,mirrorMember,mirrorSourceIds,mirrorMemberId,type Editor,type MirrorRule} from '@openlandcraft/core';
import {Button,Field,FieldMessage,NumberField,Panel,PanelHeading,Row,SelectInput,SelectOption,TextInput} from './ui';
import {InspectorSection} from './InspectorSection';

export type MirrorRequest={ruleId?:string;sourceIds?:string[];repeatId?:string};
export function MirrorPanel({editor,request,onClose,onSelect,onGuide}:{editor:Editor;request:MirrorRequest;onClose:()=>void;onSelect:(id:string)=>void;onGuide:(rule:MirrorRule|null)=>void}){
 const project=editor.getSnapshot().project,existing=project.mirrorRules?.find(r=>r.id===request.ruleId),sources=mirrorSources(project);
 const [draft,setDraft]=useState<MirrorRule>(()=>existing??{id:crypto.randomUUID(),name:'Garden symmetry',start:[0,-10],end:[0,10],...(request.repeatId?{repeatId:request.repeatId}:{sourceIds:request.sourceIds?.length?request.sourceIds:sources[0]?[sources[0].id]:[]})});
 const [error,setError]=useState('');
 const preview=(next:MirrorRule)=>{setDraft(next);onGuide(next);try{if(!editor.getSnapshot().gestureLabel)editor.begin('Mirror preview');editor.preview({type:'mirror',rule:next});setError('');}catch(e){setError(e instanceof ZodError?e.issues[0]?.message??'Choose a valid mirror axis and source.':(e as Error).message);}};
 useEffect(()=>{preview(draft);return()=>{onGuide(null);if(editor.getSnapshot().gestureLabel==='Mirror preview')editor.cancel();};},[]);
 const sourceIds=mirrorSourceIds(project,draft),copyCount=sourceIds.filter(id=>{const e=project.entities.find(e=>e.id===id);return e&&(e.kind==='block'||e.kind==='instance'||e.kind==='hedge')&&!draft.excluded?.includes(id)&&!!mirrorMember(e,draft);}).length;
 const change=(patch:Partial<MirrorRule>)=>preview({...draft,...patch});
 return <Panel padding="body"><PanelHeading title={existing?'Edit symmetry':'Mirror / symmetry'} subtitle="PLANTS · BLOCKS · HEDGES · REPEATS"/>
  <Field>Symmetry name<TextInput aria-label="Symmetry name" value={draft.name} maxLength={80} onChange={e=>change({name:e.target.value})}/></Field>
  <Field>Source<SelectInput aria-label="Mirror source" disabled={!!existing} value={draft.repeatId?`repeat:${draft.repeatId}`:draft.sourceIds?.length===1?`object:${draft.sourceIds[0]}`:'selection'} onValueChange={value=>value.startsWith('repeat:')?change({repeatId:value.slice(7),sourceIds:undefined}):value==='selection'?change({repeatId:undefined,sourceIds:request.sourceIds}):change({repeatId:undefined,sourceIds:[value.slice(7)]})}>
   {(request.sourceIds?.length??0)>1&&<SelectOption value="selection">Selected objects ({request.sourceIds!.length})</SelectOption>}
   {sources.map(e=><SelectOption key={e.id} value={`object:${e.id}`}>{e.name}</SelectOption>)}
   {(project.repeatPatterns??[]).map(p=><SelectOption key={p.id} value={`repeat:${p.id}`}>Whole repeat · {p.name}</SelectOption>)}
  </SelectInput></Field>
  <Row className="flex-wrap"><Button type="button" variant="outline" onClick={()=>change({start:[0,-project.site.depth/2],end:[0,project.site.depth/2]})}>Axis X = 0</Button><Button type="button" variant="outline" onClick={()=>change({start:[-project.site.width/2,0],end:[project.site.width/2,0]})}>Axis Z = 0</Button></Row>
  <FieldMessage>The dashed line is the vertical mirror plane. Move its two plan points for an offset or diagonal axis. Objects on the axis remain single.</FieldMessage>
  {(['start','end'] as const).map(key=><Row key={key}>{draft[key].map((value,i)=><NumberField key={i} label={`Mirror axis ${key} ${i===0?'X':'Z'}`} value={value} min={-500} max={500} onChange={n=>change({[key]:draft[key].map((v,j)=>i===j?n:v)})}/>)}</Row>)}
  <FieldMessage>{sourceIds.length} sources · {copyCount} mirrored copies. Originals stay in place; shared source edits and repeat count/path changes follow automatically. Copies share embedded assets.</FieldMessage>
  <FieldMessage>Mirrored transforms follow their source. Detach a copy before moving or resizing it independently. Names and visibility remain locally editable.</FieldMessage>
  {error&&<FieldMessage tone="error" role="alert">{error}</FieldMessage>}
  <Row><Button type="button" disabled={!!error||!copyCount||!editor.getSnapshot().preview} onClick={()=>{editor.commit();const id=sourceIds.find(id=>{const e=project.entities.find(e=>e.id===id);return e&&(e.kind==='block'||e.kind==='instance'||e.kind==='hedge')&&!!mirrorMember(e,draft);});onClose();if(id)onSelect(mirrorMemberId(draft,id));}}>Apply symmetry</Button><Button type="button" variant="ghost" onClick={()=>{editor.cancel();onClose();}}>Cancel</Button></Row>
 </Panel>;
}
export function MirrorSelection({editor,id,onEdit,onSelect,onError}:{editor:Editor;id:string;onEdit:(request:MirrorRequest)=>void;onSelect:(id:string)=>void;onError:(s:string)=>void}){
 const p=editor.getSnapshot().project,owner=mirrorOwner(p,id),rules=owner?[owner.rule]:(p.mirrorRules??[]).filter(r=>mirrorSourceIds(p,r).includes(id));
 const busy=!!editor.getSnapshot().gestureLabel,run=(f:()=>void)=>{try{f();}catch(e){onError((e as Error).message);}};
 if(!rules.length&&!mirrorSources(p).some(e=>e.id===id))return null;
 return <InspectorSection sectionId="mirror-selection" title={owner?'Mirrored object':'Symmetry'} className="mx-panel">
  {owner&&<><FieldMessage>Position, orientation and shape follow the source across the mirror axis. Detach this copy to edit them independently.</FieldMessage><Row><Button type="button" variant="ghost" disabled={busy} onClick={()=>onSelect(owner.sourceId)}>Edit source</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>run(()=>editor.execute({type:'detachMirrorMember',id},'Detach mirrored object'))}>Detach mirror copy</Button></Row></>}
  {!owner&&<Button type="button" variant="outline" disabled={busy} onClick={()=>onEdit({sourceIds:[id]})}>Mirror this object</Button>}
  {rules.map(r=><div key={r.id}><FieldMessage>{r.name}</FieldMessage><Row className="flex-wrap"><Button type="button" variant="outline" disabled={busy} onClick={()=>onEdit({ruleId:r.id})}>Edit mirror axis</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>run(()=>editor.execute({type:'removeMirror',id:r.id},'Make mirrors independent'))}>Make copies independent</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>run(()=>editor.execute({type:'removeMirror',id:r.id,deleteObjects:true},'Remove mirrored copies'))}>Remove mirrored copies</Button></Row></div>)}
 </InspectorSection>;
}
