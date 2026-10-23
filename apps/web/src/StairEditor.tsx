import {useEffect,useState} from 'react';
import {detachStairEnd,applyCommand,stairEndpoints,updateStairs,unitForPart,updateSpiralStairs,spiralRun,remapSpiralTower,type Slab} from '@openlandcraft/core';
import type {OutlineEditor} from './OutlineEditor';
import {RailingEditor} from './RailingEditor';
import {Button,CheckboxInput,ColorInput,Field,FieldControl,FieldGrid,FieldMessage,NumericInput,Panel,PanelHeading,TextInput} from './ui';

export function StairEditor({part,level,editing,editor,snapping,onSnapping,onFrame,onFinish,onSelect,status,onStatus,onAttachStair}:Parameters<typeof OutlineEditor>[0]){
  const stair=part as Slab,s=stair.stairs!,state=editor.getSnapshot(),busy=!!state.gestureLabel,unit=unitForPart(state.project,stair.id),ends=stairEndpoints(stair),spiral=s.spiral,tower=state.project.entities.find(e=>e.kind==='wall'&&e.id===spiral?.towerId);
  const valuesFor=()=>({width:stair.width,rise:s.rise,run:stair.depth,steps:s.steps,direction:s.direction,elevation:stair.elevation,thickness:stair.thickness,startX:spiral?stair.center[0]:ends.start[0],startZ:spiral?stair.center[1]:ends.start[1],radius:spiral?.radius??2,turns:spiral?.turns??1});
  type Key=keyof ReturnType<typeof valuesFor>;
  const textValues=()=>Object.fromEntries(Object.entries(valuesFor()).map(([k,v])=>[k,String(Number(v.toFixed(8)))])) as Record<Key,string>;
  const [values,setValues]=useState(textValues),[name,setName]=useState(stair.name),[color,setColor]=useState(stair.color),[clockwise,setClockwise]=useState(spiral?.clockwise??false);
  useEffect(()=>{setValues(textValues());setName(stair.name);setColor(stair.color);setClockwise(spiral?.clockwise??false);},[stair,editing]);
  const changed=clockwise!==(spiral?.clockwise??false)||name!==stair.name||color!==stair.color||(Object.keys(values) as Key[]).some(k=>!values[k].trim()||Math.abs(Number(values[k])-valuesFor()[k])>1e-8);
  const controlled=(key:Key)=>!!(s.connections?.top&&['rise','run','direction','startX','startZ','turns'].includes(key)||s.connections?.bottom&&['elevation','startX','startZ'].includes(key));
  let candidate:Slab|undefined,issue='';
  if(editing&&changed&&!busy)try{const n=(k:Key)=>controlled(k)?valuesFor()[k]:values[k].trim()?Number(values[k]):NaN;const patch={width:n('width'),rise:n('rise'),steps:n('steps'),direction:n('direction'),elevation:n('elevation'),thickness:n('thickness')};candidate={...(spiral?updateSpiralStairs(stair,{...patch,radius:n('radius'),turns:n('turns'),clockwise,center:[n('startX'),n('startZ')]}):updateStairs(stair,{width:n('width'),rise:n('rise'),run:n('run'),steps:n('steps'),direction:n('direction'),elevation:n('elevation'),thickness:n('thickness'),start:[n('startX'),n('startZ')]})),name,color};applyCommand(state.project,{type:'replace',entity:candidate});}catch(error){issue=error instanceof Error?error.message:'Invalid stairs.';}
  const labels:Partial<Record<Key,string>>=spiral?{radius:'Stair radius',width:'Stair width',rise:'Total height',steps:'Step count',turns:'Turns',direction:'Start angle',elevation:'Base elevation',thickness:'Flight thickness',startX:'Center X',startZ:'Center Z'}:{width:'Stair width',rise:'Total rise',run:'Total run',steps:'Step count',direction:'Uphill direction',elevation:'Base elevation',thickness:'Flight thickness',startX:'Lower start X',startZ:'Lower start Z'};
  return <Panel padding="body" aria-label={editing?'Edit '+(spiral?'spiral':'straight')+' stairs':'Selected '+(spiral?'spiral':'straight')+' stairs'}>
    <PanelHeading title={editing?'Editing '+(spiral?'spiral':'straight')+' stairs':(spiral?'Spiral':'Straight')+' stairs selected'} subtitle={level?.name}/>
    <p role="status">{editing?s.connections?'Use Width or Radius handles. Attached endpoints follow their surfaces; use Reattach to move them.':spiral?'Move Center or use Radius, Width and Rise handles.':'Move the flight or use Run / direction, Width and Rise handles.': 'Double-click these stairs or press Enter to edit.'}</p>
    <FieldMessage>{s.steps} steps · rise {(s.rise/s.steps).toFixed(3)} m / tread {((spiral?spiralRun(stair):stair.depth)/s.steps).toFixed(3)} m</FieldMessage>
    <FieldMessage>Lower start {ends.start.map(n=>n.toFixed(2)).join(', ')} at {stair.elevation.toFixed(2)} m · upper end {ends.end.map(n=>n.toFixed(2)).join(', ')} at {(stair.elevation+s.rise).toFixed(2)} m above level.</FieldMessage>
    <Button variant="ghost" onClick={onFrame}>Frame selected stairs · F</Button>
    {onAttachStair&&(['bottom','top'] as const).map(end=><div key={end}><Button variant="ghost" disabled={busy} onClick={()=>onAttachStair(end)}>{s.connections?.[end]?'Reattach ':'Attach '}{end}</Button>{s.connections?.[end]&&<><FieldMessage>{'Linked to '+(s.connections![end]!.floorId?state.project.entities.find(e=>e.id===s.connections![end]!.floorId)?.name??'floor':end==='bottom'?'terrain':state.project.entities.find(e=>e.id===s.connections!.top!.wallId)?.name??'wall walk')} · landing {s.connections[end]!.depth.toFixed(2)} m</FieldMessage><Button variant="ghost" disabled={busy} onClick={()=>{try{editor.execute({type:'replace',entity:detachStairEnd(stair,end)},'Detach stair '+end);onStatus('Detached '+end+'. Its landing and generated opening were removed.');}catch(error){onStatus(error instanceof Error?error.message:'Could not detach.');}}}>Detach {end}</Button></>}</div>)}
    {s.connections&&<FieldMessage>Attached surfaces control the flight endpoints and elevations. Use Reattach to change the entrance or landing depth. Width, step count, flight thickness and railings remain editable.</FieldMessage>}
    {editing&&<>
      <Field variant="checkbox"><CheckboxInput checked={snapping} disabled={busy} onChange={e=>onSnapping(e.target.checked)}/>Snap stair edits to 0.25 m</Field>
      <form onSubmit={e=>{e.preventDefault();if(candidate&&!issue&&changed)try{editor.execute({type:'replace',entity:candidate},'Edit '+(spiral?'spiral':'straight')+' stairs');onStatus('Stair dimensions applied.');}catch(error){onStatus(error instanceof Error?error.message:'Could not edit stairs.');}}}>
        <fieldset className="opening-edit-fields" disabled={busy}>
          <Field>Name<TextInput aria-label="Stair name" maxLength={80} required value={name} onChange={e=>setName(e.target.value)}/></Field>
          {spiral&&<Field variant="checkbox"><CheckboxInput checked={clockwise} disabled={!!s.connections?.top} onChange={e=>setClockwise(e.target.checked)}/>Clockwise stairs</Field>}
          <FieldGrid columns="auto">{(Object.keys(labels) as Key[]).map(key=><Field variant="number" key={key}><span>{labels[key]}</span><FieldControl><NumericInput aria-label={labels[key]} disabled={controlled(key)} step={key==='steps'?1:'any'} required value={values[key]} onChange={e=>setValues(old=>({...old,[key]:e.target.value}))}/>{key!=='steps'&&<small>{key==='direction'?'°':key==='turns'?'turns':'m'}</small>}</FieldControl></Field>)}</FieldGrid>
          <Field variant="color"><ColorInput aria-label="Stair color" disabled={!!stair.materialId} title={stair.materialId?'Color comes from the shared Material section':undefined} value={color} onChange={e=>setColor(e.target.value)}/><span>Stair color</span></Field>
          {issue&&<FieldMessage role="alert" tone="error">{issue}</FieldMessage>}
          <Button type="submit" disabled={!changed||!!issue||busy}>Apply stair dimensions</Button>
        </fieldset>
      </form>
      {tower?.kind==='wall'&&spiral&&!s.connections?.top&&<><FieldMessage>Fitted inside {tower.name}. Radius, width and height stay editable; edits must retain wall and walk-deck clearance and keep railings below the wall top. Tower movement carries these stairs.</FieldMessage><Button variant="ghost" disabled={busy} onClick={()=>{try{editor.execute({type:'replace',entity:remapSpiralTower(stair,new Map())},'Detach spiral stairs');onStatus('Stairs detached at their current dimensions.');}catch(error){onStatus(error instanceof Error?error.message:'Could not detach stairs.');}}}>Detach stairs from tower</Button></>}
      <RailingEditor host={stair} editor={editor} onStatus={onStatus}/>
      <p role="status">{status}</p>
      <FieldMessage>{spiral?'Radius reaches the outer tread edge; width extends inward and leaves an open center. Height is the total rise. Turn count and start angle control the upper exit. Railings follow every stair edit. Attach either end to a floor, bottom to terrain or top to a wall walk for linked landings and openings.':'Total rise is the floor-to-floor height; total run includes all treads. Run and direction edits keep the lower start fixed. Attach either end to a floor, bottom to terrain or top to a wall walk for landings that follow surface edits.'}</FieldMessage>
      <Button variant="ghost" disabled={busy} onClick={()=>{try{editor.execute({type:'remove',id:stair.id},'Delete stairs');onFinish();}catch(error){onStatus(error instanceof Error?error.message:'Could not delete stairs.');}}}>Delete stairs</Button>
      <Button onClick={onFinish}>Finish editing <span>Esc</span></Button>
    </>}
    {level&&<Button variant="ghost" onClick={()=>onSelect(level.id)}>Select whole floor · {level.name}</Button>}
    {unit&&<Button variant="ghost" onClick={()=>onSelect(unit.id)}>Select whole unit · {unit.name}</Button>}
  </Panel>;
}
