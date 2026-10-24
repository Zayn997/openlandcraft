import {useState} from 'react';
import {groundHeight,repeatLayout,type RepeatPattern,type RepeatPath} from '@openlandcraft/core';
import {applyCommand,repeatOwner,repeatSources,repeatPathFromPoints,type Editor,type RepeatSource} from '@openlandcraft/core';
import {InspectorSection} from './InspectorSection';
import {Button,CheckboxInput,Field,FieldMessage,NumberField,Panel,PanelHeading,Row,SelectInput,SelectOption,TextInput} from './ui';

export function RepeatFields({value,onChange,geometry=true}:{value:RepeatPattern;onChange:(p:RepeatPattern)=>void;geometry?:boolean}){
 const change=(patch:Partial<RepeatPattern>)=>onChange({...value,...patch}),path=value.path;
 const editPath=(patch:object)=>change({path:{...path,...patch} as RepeatPath});
 let summary='',issue='';try{const l=repeatLayout(value);summary=`${l.count-(value.excluded??[]).filter(i=>i<l.count).length} linked copies · ${l.spacing.toFixed(2)} m spacing · ${l.length.toFixed(2)} m path`;}catch(error){issue=(error as Error).message;}
 return <>
  <Field>Repeat name<TextInput aria-label="Repeat name" maxLength={80} required value={value.name} onChange={e=>change({name:e.target.value})}/></Field>
  <Field>Distribution<SelectInput aria-label="Repeat distribution" value={value.mode} onValueChange={mode=>change({mode:mode as RepeatPattern['mode']})}><SelectOption value="count">Fit count to path</SelectOption><SelectOption value="spacing">Set spacing</SelectOption></SelectInput></Field>
  {value.mode==='count'?<NumberField label="Repeat count" min={2} max={128} unit="copies" value={value.count} onChange={count=>change({count:Math.round(count)})}/>:<NumberField label="Repeat spacing" min={.2} max={100} value={value.spacing} onChange={spacing=>change({spacing})}/>}
  <Field>Orientation<SelectInput aria-label="Repeat orientation" value={value.orientation} onValueChange={orientation=>change({orientation:orientation as RepeatPattern['orientation']})}><SelectOption value="fixed">Keep source direction</SelectOption><SelectOption value="tangent">Along path</SelectOption>{path.kind==='arc'&&<SelectOption value="radial">Face outward from center</SelectOption>}</SelectInput></Field>
  <NumberField label="Rotation offset" min={-360} max={360} unit="°" value={value.rotation} onChange={rotation=>change({rotation})}/>
  <NumberField label="End clearance" min={0} max={50} value={value.clearance} onChange={clearance=>change({clearance})}/>
  {geometry&&<details><summary>Path geometry · {path.kind}</summary>
   {path.kind==='line'?(['start','end'] as const).map(key=><div key={key}>{path[key].map((v,i)=><NumberField key={i} label={`${key==='start'?'Start':'End'} ${i===0?'X':'Z'}`} min={-500} max={500} value={v} onChange={n=>editPath({[key]:path[key].map((old,j)=>j===i?n:old)})}/>)}</div>):<>
    {path.center.map((v,i)=><NumberField key={i} label={`Arc center ${i===0?'X':'Z'}`} min={-500} max={500} value={v} onChange={n=>editPath({center:path.center.map((old,j)=>j===i?n:old)})}/>)}
    <NumberField label="Repeat radius" min={.25} max={100} value={path.radius} onChange={radius=>editPath({radius})}/>
    <NumberField label="Repeat start angle" min={-360} max={360} unit="°" value={path.startAngle} onChange={startAngle=>editPath({startAngle})}/>
    <NumberField label="Repeat sweep angle" min={-360} max={360} unit="°" value={path.sweepAngle} onChange={sweepAngle=>editPath({sweepAngle})}/>
   </>}
  </details>}
  {issue?<FieldMessage tone="error" role="alert">{issue}</FieldMessage>:<FieldMessage role="status">{summary}</FieldMessage>}
  {value.path.kind==='arc'&&Math.abs(value.path.sweepAngle)===360&&<FieldMessage>A full circle has no duplicate endpoint. Spacing is distributed evenly around the ring.</FieldMessage>}
 </>;
}

export function useRepeatTool(editor:Editor,snapping:boolean,onSnapping:(value:boolean)=>void,onFinish:()=>void,onError:(error:string)=>void){
 const [points,setPoints]=useState<[number,number][]>([]),[shape,setShape]=useState<'line'|'arc'>('line'),[clockwise,setClockwise]=useState(false);
 const [settings,setSettings]=useState<RepeatPattern>({id:'repeat-draft',name:'Repeat',sourceId:'',path:{kind:'line',start:[0,0],end:[10,0]},mode:'count',count:8,spacing:2,orientation:'fixed',rotation:0,clearance:0});
 const start=(sourceId?:string)=>{setPoints([]);setSettings(old=>({...old,id:crypto.randomUUID(),sourceId:sourceId??repeatSources(editor.getSnapshot().project)[0]?.id??'',overrides:undefined,excluded:undefined}));};
 const update=(value:RepeatPattern)=>setSettings(value);
 const point=(x:number,z:number)=>{const p:[number,number]=snapping?[Math.round(x*4)/4,Math.round(z*4)/4]:[x,z];setPoints(old=>old.length<(shape==='line'?2:3)?[...old,p]:[...old.slice(0,-1),p]);};
 const snapshot=editor.getSnapshot(),project=snapshot.project,sources=repeatSources(project),ready=points.length===(shape==='line'?2:3);
 let pattern:RepeatPattern|undefined,error='';
 try{if(ready){pattern={...settings,path:repeatPathFromPoints(shape,points,clockwise)};applyCommand(project,{type:'repeat',pattern});}}catch(e){error=(e as Error).message;}
 const addSource=(kind:'column'|'post')=>{try{const x=-project.site.width/4,z=-project.site.depth/4,source:RepeatSource={id:crypto.randomUUID(),kind:'block',parentId:'site',name:kind==='column'?'Column source':'Fence post source',visible:true,position:[x,groundHeight(x,z,project.site),z],rotation:0,size:kind==='column'?[.5,3,.5]:[.2,1.2,.2],color:kind==='column'?'#b6b0a4':'#85613f'};editor.execute({type:'add',entity:source},'Add repeat source');editor.select(source.id);setSettings(old=>({...old,sourceId:source.id}));}catch(e){onError((e as Error).message);}};
 const panel=<Panel padding="body" aria-label="Repeat along path">
  <PanelHeading title="Repeat along path" subtitle="COLUMNS · POSTS · SHRUBS"/>
  <form onSubmit={e=>{e.preventDefault();if(!pattern||error)return;try{editor.execute({type:'repeat',pattern},'Create repeat');onFinish();editor.select(`${pattern.id}:0`);}catch(e){onError((e as Error).message);}}}>
   <Field>Shared source<SelectInput aria-label="Repeat source" value={settings.sourceId} placeholder="Choose a block or placed model" onValueChange={sourceId=>update({...settings,sourceId})}>{sources.map(e=><SelectOption key={e.id} value={e.id}>{e.name} · {e.kind==='block'?'block':'model'}</SelectOption>)}</SelectInput></Field>
   <Row className="flex-wrap"><Button type="button" variant="ghost" onClick={()=>addSource('column')}>New column source</Button><Button type="button" variant="ghost" onClick={()=>addSource('post')}>New post source</Button></Row>
   <FieldMessage>For shrubs, place a plant from the Library first, then choose it here. Copies share this source; the original stays in place.</FieldMessage>
   <FieldMessage>Blocks keep the source base elevation. Models keep their terrain or fixed elevation setting.</FieldMessage>
   <Field>Path<SelectInput aria-label="Repeat path" value={shape} onValueChange={v=>{const s=v as typeof shape;setShape(s);setPoints([]);update({...settings,path:s==='line'?{kind:'line',start:[0,0],end:[10,0]}:{kind:'arc',center:[0,0],radius:5,startAngle:0,sweepAngle:180},orientation:settings.orientation==='radial'&&s==='line'?'fixed':settings.orientation});}}><SelectOption value="line">Line · start → end</SelectOption><SelectOption value="arc">Arc · center → start → end</SelectOption></SelectInput></Field>
   {shape==='arc'&&<Field variant="checkbox"><CheckboxInput checked={clockwise} onChange={e=>setClockwise(e.target.checked)}/>Clockwise arc</Field>}
   <RepeatFields value={{...settings,path:pattern?.path??settings.path}} onChange={update} geometry={false}/>
   <Field variant="checkbox"><CheckboxInput checked={snapping} onChange={e=>onSnapping(e.target.checked)}/>Snap points to 0.25 m</Field>
   <FieldMessage>{ready?'Review the preview, then Create repeat.':shape==='line'?points.length?'Click the path end.':'Click the path start.':points.length===0?'Click the arc center.':points.length===1?'Click the radius and start direction.':'Click the end direction; click the start again for a full circle.'}</FieldMessage>
   {error&&<FieldMessage role="alert" tone="error">{error}</FieldMessage>}
   <Button type="submit" disabled={!ready||!!error}>Create repeat</Button>
   <Row className="flex-wrap"><Button type="button" variant="ghost" disabled={!points.length} onClick={()=>setPoints(p=>p.slice(0,-1))}>Back</Button><Button type="button" variant="ghost" onClick={onFinish}>Cancel</Button></Row>
  </form>
 </Panel>;
 return {start,point,panel,drawing:{settings,shape,points,clockwise,snapping},reset:()=>setPoints([])};
}

export function RepeatSelection({editor,id,onSelect,onError}:{editor:Editor;id:string;onSelect:(id:string)=>void;onError:(message:string)=>void}){
 const project=editor.getSnapshot().project,owner=repeatOwner(project,id),patterns=owner?[owner]:(project.repeatPatterns??[]).filter(p=>p.sourceId===id);
 const [choice,setChoice]=useState(patterns[0]?.id??''),p=patterns.find(p=>p.id===choice)??patterns[0];
 const [draft,setDraft]=useState(p);
 if(!p||!draft)return null;
 const action=(run:()=>void)=>{try{run();}catch(e){onError((e as Error).message);}};
 const source=project.entities.find(e=>e.id===p.sourceId)!;
 return <InspectorSection sectionId="repeat-selection" title={owner?'Repeated object':'Shared repeat source'} className="mx-panel">
  {patterns.length>1&&<Field>Repeat<SelectInput aria-label="Selected repeat" value={p.id} onValueChange={id=>{setChoice(id);setDraft(patterns.find(p=>p.id===id)!);}}>{patterns.map(p=><SelectOption key={p.id} value={p.id}>{p.name}</SelectOption>)}</SelectInput></Field>}
  <FieldMessage>{owner?`Linked to ${source.name}. Edit this object below to keep a local override. Other fields follow the source.`:'Edits to this source update its linked copies. Individual overrides are preserved.'}</FieldMessage>
  {owner&&<Row className="flex-wrap"><Button type="button" variant="ghost" onClick={()=>onSelect(p.sourceId)}>Edit shared source</Button><Button type="button" variant="ghost" disabled={!!editor.getSnapshot().gestureLabel} onClick={()=>action(()=>editor.execute({type:'resetRepeatMember',id},'Reset repeat override'))}>Reset overrides</Button><Button type="button" variant="ghost" disabled={!!editor.getSnapshot().gestureLabel} onClick={()=>action(()=>editor.execute({type:'detachRepeatMember',id},'Detach repeated object'))}>Detach object</Button></Row>}
  <details><summary>Edit repeat · {p.name}</summary><form onSubmit={e=>{e.preventDefault();action(()=>editor.execute({type:'repeat',pattern:draft},'Edit repeat'));}}><fieldset className="m-0 min-w-0 border-0 p-0" disabled={!!editor.getSnapshot().gestureLabel}><RepeatFields value={draft} onChange={setDraft}/><Button type="submit">Apply repeat changes</Button></fieldset></form></details>
  <Row className="flex-wrap"><Button type="button" variant="ghost" disabled={!!editor.getSnapshot().gestureLabel} onClick={()=>action(()=>editor.execute({type:'removeRepeat',id:p.id},'Explode repeat'))}>Make all independent</Button><Button type="button" variant="ghost" disabled={!!editor.getSnapshot().gestureLabel} onClick={()=>action(()=>editor.execute({type:'removeRepeat',id:p.id,deleteObjects:true},'Remove repeat'))}>Remove copies</Button></Row>
 </InspectorSection>;
}
