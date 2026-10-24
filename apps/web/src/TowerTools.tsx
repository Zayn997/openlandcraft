import {useState} from 'react';
import {applyCommand,copySelection,DEFAULT_TOWER,groundHeight,newTower,pasteSelection,towerOwner,towerPart,towerParameters,towerParameterIssue,type Command,type Editor,type TowerParameters,type TowerType} from '@openlandcraft/core';
import {InspectorSection} from './InspectorSection';
import {Button,CheckboxInput,Field,FieldMessage,NumberField,Panel,PanelHeading,Row,SelectInput,SelectOption,TextInput} from './ui';

export function TowerFields({value,onChange}:{value:TowerParameters;onChange:(p:TowerParameters)=>void}){
 const patch=(v:Partial<TowerParameters>)=>onChange({...value,...v}),issue=towerParameterIssue(value);
 return <>
  <NumberField label="Tower radius" value={value.radius} min={1.5} max={30} onChange={radius=>patch({radius})}/>
  <NumberField label="Tower height" value={value.height} min={3} max={30} onChange={height=>patch({height})}/>
  <NumberField label="Tower wall thickness" value={value.thickness} min={.1} max={2} onChange={thickness=>patch({thickness})}/>
  <NumberField label="Tower floor count" value={value.floorCount} min={1} max={8} unit="floors" onChange={v=>patch({floorCount:Math.round(v)})}/>
  <Field>Tower top<SelectInput aria-label="Tower top" value={value.top} onValueChange={top=>patch({top:top as TowerParameters['top']})}><SelectOption value="battlements">Open battlements</SelectOption><SelectOption value="roof">Conical roof</SelectOption></SelectInput></Field>
  {value.top==='battlements'?<NumberField label="Tower battlement spacing" value={value.battlementSpacing} min={.1} max={10} onChange={battlementSpacing=>patch({battlementSpacing})}/>:<><NumberField label="Tower roof height" value={value.roofHeight} min={.1} max={15} onChange={roofHeight=>patch({roofHeight})}/><NumberField label="Tower roof overhang" value={value.overhang} min={0} max={5} onChange={overhang=>patch({overhang})}/></>}
  <FieldMessage>{value.floorCount} floors · {(value.height/value.floorCount).toFixed(2)} m floor spacing. Radius is measured to the wall centerline.</FieldMessage>
  {issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}
 </>;
}

export function useTowerTool(editor:Editor,snapping:boolean,onSnapping:(v:boolean)=>void,onFinish:()=>void,onError:(message:string)=>void){
 const [definition,setDefinition]=useState<TowerType>({...DEFAULT_TOWER,id:'tower-draft',name:'Round tower'}),[typeId,setTypeId]=useState('new'),[assemblyId,setAssemblyId]=useState('tower-draft');
 const [name,setName]=useState('Tower'),[center,setCenter]=useState<[number,number]|null>(null),[ready,setReady]=useState(false);
 const project=editor.getSnapshot().project;
 const start=()=>{const type=project.towerTypes?.[0];setTypeId(type?.id??'new');setDefinition(type??{...DEFAULT_TOWER,id:crypto.randomUUID(),name:'Round tower'});setName('Tower');setAssemblyId(crypto.randomUUID());setCenter(null);setReady(false);};
 const commandAt=(at:[number,number],params:TowerParameters=definition):Command=>{
  const {tower,level}=newTower(typeId==='new'?definition.id:typeId,[at[0],groundHeight(...at,project.site)+.2,at[1]],assemblyId),type=project.towerTypes?.find(t=>t.id===typeId);
  const parameters=type?Object.fromEntries((Object.keys(DEFAULT_TOWER) as (keyof TowerParameters)[]).filter(k=>params[k]!==type[k]).map(k=>[k,params[k]])):undefined;
  return {type:'batch',commands:[...(typeId==='new'?[{type:'towerType' as const,definition:{...definition,...params}}]:[]),{type:'tower',tower:{...tower,...(parameters?{parameters}:{})},level:{...level,name}}]};
 };
 let error='';if(center)try{applyCommand(project,commandAt(center));}catch(e){error=(e as Error).message;}
 const point=(x:number,z:number)=>{const p:[number,number]=snapping?[Math.round(x*4)/4,Math.round(z*4)/4]:[x,z];if(!center){setCenter(p);setReady(false);}else{const radius=Math.hypot(p[0]-center[0],p[1]-center[1]);setDefinition(d=>({...d,radius:snapping?Math.round(radius*4)/4:radius}));setReady(true);}};
 const panel=<Panel padding="body" aria-label="Tower assembly placement"><PanelHeading title="Tower assembly" subtitle="REUSABLE ARCHITECTURE"/><form onSubmit={e=>{e.preventDefault();if(!center||error)return;try{editor.execute(commandAt(center),'Create tower assembly');onFinish();editor.select(assemblyId+'-level');}catch(e){onError((e as Error).message);}}}>
  <Field>Tower name<TextInput aria-label="Tower name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></Field>
  <Field>Reusable type<SelectInput aria-label="Tower type" value={typeId} onValueChange={id=>{setTypeId(id);setDefinition(id==='new'?{...DEFAULT_TOWER,id:crypto.randomUUID(),name:'Round tower'}:project.towerTypes!.find(t=>t.id===id)!);}}><SelectOption value="new">New tower type</SelectOption>{project.towerTypes?.map(t=><SelectOption key={t.id} value={t.id}>{t.name}</SelectOption>)}</SelectInput></Field>
  {typeId==='new'&&<Field>Type name<TextInput aria-label="Tower type name" required maxLength={80} value={definition.name} onChange={e=>setDefinition(d=>({...d,name:e.target.value}))}/></Field>}
  <TowerFields value={definition} onChange={p=>setDefinition(d=>({...d,...p}))}/>
  <Field variant="checkbox"><CheckboxInput checked={snapping} onChange={e=>onSnapping(e.target.checked)}/>Snap center and radius to 0.25 m</Field>
  <FieldMessage>{center?ready?'Review the preview, then Create tower.':'Click a radius point, or keep the radius above and Create tower.':'Click the tower center, then a radius point.'} Walls, floors, roofs and hosted details remain separate editable objects.</FieldMessage>
  {typeId!=='new'&&<FieldMessage>Changes here apply to this tower only. Edit its shared type later to update linked towers together.</FieldMessage>}
  {error&&<FieldMessage tone="error" role="alert">{error}</FieldMessage>}
  <Button type="submit" disabled={!center||!!error} onClick={()=>setReady(true)}>Create tower</Button><Row className="flex-wrap"><Button type="button" variant="ghost" disabled={!center} onClick={()=>{setCenter(null);setReady(false);}}>Redraw center</Button><Button type="button" variant="ghost" onClick={onFinish}>Cancel</Button></Row>
 </form></Panel>;
 return {start,reset:()=>{setCenter(null);setReady(false);},point,panel,drawing:{definition,center,ready,snapping,assemblyId,commandAt}};
}

export function TowerSelection({editor,id,onSelect,onError}:{editor:Editor;id:string;onSelect:(id:string)=>void;onError:(error:string)=>void}){
 const project=editor.getSnapshot().project,tower=towerOwner(project,id),type=tower&&project.towerTypes?.find(t=>t.id===tower.typeId),params=tower?towerParameters(project,tower):DEFAULT_TOWER;
 const [mode,setMode]=useState<'instance'|'shared'>('instance'),[draft,setDraft]=useState(params),[typeName,setTypeName]=useState(type?.name??'');
 if(!tower||!type)return null;
 const part=towerPart(tower,id),level=project.entities.find(e=>e.id===tower.levelId)!,busy=!!editor.getSnapshot().gestureLabel,users=project.towerAssemblies!.filter(t=>t.typeId===type.id).length;
 const action=(fn:()=>void)=>{try{fn();}catch(e){onError((e as Error).message);}};
 const chooseMode=(m:typeof mode)=>{setMode(m);setDraft(m==='instance'?params:towerParameters({towerTypes:[type]},{...tower,parameters:undefined}));setTypeName(type.name);};
 const command:Command=mode==='shared'?{type:'towerType',definition:{...type,...draft,name:typeName}}:{type:'tower',tower:{...tower,parameters:Object.fromEntries((Object.keys(DEFAULT_TOWER) as (keyof TowerParameters)[]).filter(k=>draft[k]!==type[k]).map(k=>[k,draft[k]]))}};
 let issue='';try{applyCommand(project,command);}catch(e){issue=(e as Error).message;}
 const duplicate=()=>action(()=>{
  const clip=copySelection(project,tower.levelId),span=2*(params.radius+params.thickness/2+params.overhang)+2,prefix=crypto.randomUUID();let last:unknown;
  for(const worldDelta of [[span,0],[-span,0],[0,span],[0,-span]] as [number,number][])try{const plan=pasteSelection(project,clip,null,prefix,1,{worldDelta,snapping:true});editor.execute(plan.command,'Duplicate tower assembly');onSelect(plan.selectedIds[0]);return;}catch(e){last=e;}
  throw last;
 });
 return <InspectorSection sectionId="tower-selection" title="Tower assembly" className="mx-panel">
  <FieldMessage>{level.name} · {params.radius.toFixed(2)} m radius · {params.height.toFixed(2)} m high · {params.floorCount} floors. {type.name} is shared by {users} {users===1?'tower':'towers'}.</FieldMessage>
  {part&&<><FieldMessage>Component edits stay local. Its unedited dimensions continue following the tower.</FieldMessage><Row className="flex-wrap"><Button variant="ghost" onClick={()=>onSelect(tower.levelId)}>Select tower</Button><Button variant="ghost" disabled={busy} onClick={()=>action(()=>editor.execute({type:'resetTowerPart',id},'Reset tower component dimensions'))}>Reset linked dimensions</Button>{part!=='wall'&&<Button variant="ghost" disabled={busy} onClick={()=>action(()=>editor.execute({type:'detachTowerPart',id},'Detach tower component'))}>Detach component</Button>}</Row></>}
  <details><summary>Tower dimensions & type</summary><Row className="flex-wrap"><Button variant={mode==='instance'?'outline':'ghost'} disabled={busy} onClick={()=>chooseMode('instance')}>This tower</Button><Button variant={mode==='shared'?'outline':'ghost'} disabled={busy} onClick={()=>chooseMode('shared')}>Shared type · {users}</Button></Row><form onSubmit={e=>{e.preventDefault();if(!issue)action(()=>editor.execute(command,mode==='shared'?'Edit shared tower type':'Edit tower dimensions'));}}><fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0">{mode==='shared'&&<Field>Type name<TextInput aria-label="Shared tower type name" required value={typeName} maxLength={80} onChange={e=>setTypeName(e.target.value)}/></Field>}<TowerFields value={draft} onChange={setDraft}/>{mode==='shared'&&<FieldMessage>Updates all {users} linked towers. Local tower parameters and component edits are preserved.</FieldMessage>}{issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}<Button type="submit" disabled={!!issue}>{mode==='shared'?'Apply shared tower type':'Apply tower dimensions'}</Button></fieldset></form>
   <Row className="flex-wrap"><Button variant="ghost" disabled={busy} onClick={()=>action(()=>editor.execute({type:'tower',tower:{...tower,parameters:undefined}},'Use shared tower dimensions'))}>Use shared dimensions</Button><Button variant="ghost" disabled={busy} onClick={()=>action(()=>{const definition={...type,...params,id:crypto.randomUUID(),name:(type.name.slice(0,68)+' unique')};editor.execute({type:'batch',commands:[{type:'towerType',definition},{type:'tower',tower:{...tower,typeId:definition.id,parameters:undefined}}]},'Make tower type unique');})}>Make type unique</Button></Row>
  </details>
  <Row className="flex-wrap"><Button variant="ghost" disabled={busy} onClick={duplicate}>Duplicate tower</Button><Button variant="ghost" disabled={busy} onClick={()=>action(()=>editor.execute({type:'detachTower',id:tower.id},'Make tower components independent'))}>Make all independent</Button></Row>
  <details><summary>Components</summary>{project.entities.filter(e=>e.parentId===tower.levelId).map(e=><Button key={e.id} variant="ghost" onClick={()=>onSelect(e.id)}>{e.name}</Button>)}</details>
 </InspectorSection>;
}
