import {useEffect,useState} from 'react';
import {connectStairBottom,connectStairFloor,connectStairTop,floorAttachmentPoint,levelToWorld,stairFloorTargets,stairWalkTargets,wallPathPoint,wallWalkProfile,type Editor,type Level,type PlanPoint,type Slab,type StairEnd,type Wall} from '@openlandcraft/core';
import {Button,Field,FieldMessage,NumericInput,Panel,PanelHeading,SelectInput,SelectOption} from './ui';
type Surface='terrain'|'floor'|'walk';
type Draft={id:string;end:StairEnd;surface:Surface;depth:string;point?:PlanPoint;targetId?:string;edge?:'inner'|'outer';ready:boolean;issue:string};
export function useStairAttachment(editor:Editor){
 const [draft,setDraft]=useState<Draft|null>(null),project=editor.getSnapshot().project;
 const cancel=()=>{editor.cancel();setDraft(null);};
 const update=(next:Draft)=>{
  const p=editor.getSnapshot().project,part=p.entities.find((e):e is Slab=>e.kind==='slab'&&e.id===next.id),target=p.entities.find(e=>e.id===next.targetId);
  try{
   if(!part?.stairs)throw new Error('Choose stairs first.');
   const depth=next.depth.trim()?Number(next.depth):NaN;if(!Number.isFinite(depth)||depth<.5||depth>4)throw new Error('Use landing depth 0.5–4 m.');
   if(next.surface!=='terrain'&&!target){setDraft({...next,ready:false,issue:''});return;}
   const entity=next.surface==='terrain'?connectStairBottom(p,part,next.point,depth):target?.kind==='slab'?connectStairFloor(p,part,target,next.end,next.point,depth):connectStairTop(p,part,target as Wall,next.point!,depth);
   if(next.edge&&entity.stairs?.connections?.top?.wallId)entity.stairs.connections.top.edge=next.edge;
   editor.preview({type:'replace',entity});setDraft({...next,edge:entity.stairs?.connections?.top?.edge,ready:true,issue:''});
  }catch(error){editor.cancel();editor.begin('Attach stair '+next.end);setDraft({...next,ready:false,issue:error instanceof Error?error.message:'Choose another surface.'});}
 };
 const start=(id:string,end:StairEnd)=>{
  editor.cancel();editor.begin('Attach stair '+end);const p=editor.getSnapshot().project,s=p.entities.find((e):e is Slab=>e.kind==='slab'&&e.id===id),c=s?.stairs?.connections?.[end],top=end==='top'?s?.stairs?.connections?.top:undefined;
  const next:Draft={id,end,surface:c?.floorId?'floor':end==='bottom'?'terrain':'walk',depth:String(c?.depth??1.2),ready:false,issue:''};
  if(c?.floorId){const floor=p.entities.find((e):e is Slab=>e.kind==='slab'&&e.id===c.floorId),level=p.entities.find((e):e is Level=>e.kind==='level'&&e.id===floor?.parentId);if(floor&&level){next.targetId=floor.id;next.point=levelToWorld(level,[floor.center[0]+c.point![0],floor.center[1]+c.point![1]]);}}
  else if(top?.wallId){const w=p.entities.find((e):e is Wall=>e.kind==='wall'&&e.id===top.wallId),l=p.entities.find((e):e is Level=>e.kind==='level'&&e.id===w?.parentId);if(w&&l){const profile=wallWalkProfile(w);next.targetId=w.id;next.edge=top.edge;next.point=levelToWorld(l,wallPathPoint(w,top.position!,profile.side*(top.edge==='inner'?profile.inner:profile.outer)));}}
  if(c)update(next);else setDraft(next);
 };
 useEffect(()=>{if(draft&&(editor.getSnapshot().selectedId!==draft.id||!editor.getSnapshot().gestureLabel))setDraft(null);},[draft,editor.getSnapshot().selectedId,editor.getSnapshot().gestureLabel]);
 const pick=(point:PlanPoint,targetId?:string)=>{if(draft){const target=project.entities.find(e=>e.id===targetId);update({...draft,point,targetId,surface:target?.kind==='slab'?'floor':target?.kind==='wall'?'walk':'terrain',edge:undefined});}};
 const floors=stairFloorTargets(project,editor.getSnapshot().isolatedLayerId),walls=draft?.end==='top'?stairWalkTargets(project,draft.id,editor.getSnapshot().isolatedLayerId):[],targets=[...floors,...walls];
 const chooseTarget=(id:string)=>{if(!draft)return;const target=targets.find(e=>e.id===id),own=project.entities.find((e):e is Level=>e.kind==='level'&&e.id===target?.parentId),s=project.entities.find((e):e is Slab=>e.kind==='slab'&&e.id===draft.id);if(!target||!own||!s)return;const point=target.kind==='slab'?floorAttachmentPoint(project,s,target,draft.end,Number(draft.depth)||1.2):levelToWorld(own,wallPathPoint(target,.5,wallWalkProfile(target).side*(wallWalkProfile(target).inner+wallWalkProfile(target).outer)/2));update({...draft,targetId:id,point,edge:undefined,surface:target.kind==='slab'?'floor':'walk'});};
 const spiral=project.entities.some(e=>e.id===draft?.id&&e.kind==='slab'&&!!e.stairs?.spiral);
 const panel=draft&&<Panel padding="body" aria-label={'Attach stair '+draft.end}>
  <PanelHeading title={'Attach '+draft.end} subtitle="Stairs · surface connection"/>
  <FieldMessage>{draft.end==='bottom'?draft.surface==='floor'?'Click a highlighted floor where the stairs begin. The lower landing stays supported by that floor.':spiral?'Use ground below the spiral start, or click around the tower to choose its start direction.':'Click dry ground where the flight begins, or use ground below its current start.':'Click a highlighted floor or wall walk where the landing should arrive. Floors get an automatic stair opening with clearance above the treads.'}</FieldMessage>
  {draft.end==='bottom'&&<Field>Bottom surface<SelectInput aria-label="Bottom attachment surface" value={draft.surface} onValueChange={surface=>{editor.cancel();editor.begin('Attach stair bottom');setDraft({...draft,surface:surface as Surface,targetId:undefined,point:undefined,edge:undefined,ready:false,issue:''});}}><SelectOption value="terrain">Terrain</SelectOption><SelectOption value="floor">Floor</SelectOption></SelectInput></Field>}
  {draft.end==='bottom'&&draft.surface==='terrain'?<Button variant="ghost" onClick={()=>update({...draft,point:undefined})}>Use ground below start</Button>:<><Field>{draft.end==='top'?'Floor or wall walk':'Floor'}<SelectInput aria-label="Attachment target" value={draft.targetId??''} onValueChange={chooseTarget}>{targets.map(target=><SelectOption key={target.id} value={target.id}>{target.kind==='slab'?'Floor':'Walk'} · {target.name} · {project.entities.find(e=>e.id===target.parentId)?.name}</SelectOption>)}</SelectInput></Field>{!targets.length&&<FieldMessage>No editable target surfaces. Create a floor{draft.end==='top'?' or wall walk':''} first.</FieldMessage>}</>}
  <Field>Landing depth · m<NumericInput aria-label="Landing depth" min={.5} max={4} step={.1} value={draft.depth} onChange={e=>update({...draft,depth:e.target.value})}/></Field>
  {draft.end==='top'&&draft.surface==='walk'&&draft.targetId&&<Field>Walk edge<SelectInput aria-label="Landing walk edge" value={draft.edge??'inner'} onValueChange={edge=>update({...draft,edge:edge as 'inner'|'outer'})}><SelectOption value="inner">Inner · railing access</SelectOption>{!spiral&&<SelectOption value="outer">Outer · parapet access</SelectOption>}</SelectInput></Field>}
  <p role="status">{draft.issue||(draft.ready?'Preview ready. Check the landing and opening, then apply.':'Choose a surface in the scene. Orbit and zoom remain available.')}</p>
  <Button disabled={!draft.ready||!!draft.issue} onClick={()=>{editor.commit();setDraft(null);}}>Apply attachment</Button>
  <Button variant="ghost" onClick={cancel}>Cancel attachment · Esc</Button>
 </Panel>;
 return {draft,start,cancel,pick,panel};
}
