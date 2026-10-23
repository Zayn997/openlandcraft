import { useEffect, useState } from 'react';
import { applyCommand, attachWallJunctions, isCircularWall, unitForPart, updateCurvedWall, wallLength, type Wall } from '@openlandcraft/core';
import type { WallEditor } from './WallEditor';
import { BattlementsEditor } from './BattlementsEditor';
import { WallWalkEditor } from './WallWalkEditor';
import { Button, CheckboxInput, ColorInput, Field, FieldControl, FieldGrid, FieldMessage, NumericInput, Panel, PanelHeading, TextInput } from './ui';

export function CurvedWallEditor({wall,level,editing,editor,snapping,onSnapping,onFrame,onFinish,onSelect,status,onStatus}:Parameters<typeof WallEditor>[0]){
  const curve=wall.curve!,circle=isCircularWall(wall),state=editor.getSnapshot(),unit=unitForPart(state.project,wall.id);
  const valuesFor=()=>({centerX:curve.center[0],centerZ:curve.center[1],radius:curve.radius,height:wall.height,thickness:wall.thickness,elevation:wall.elevation,startAngle:curve.startAngle,sweepAngle:curve.sweepAngle});
  type Key=keyof ReturnType<typeof valuesFor>;
  const textValues=()=>Object.fromEntries(Object.entries(valuesFor()).map(([k,v])=>[k,String(Number(v.toFixed(8)))])) as Record<Key,string>;
  const [values,setValues]=useState(textValues),[name,setName]=useState(wall.name),[color,setColor]=useState(wall.color),[joins,setJoins]=useState(!!wall.joins);
  useEffect(()=>{setValues(textValues());setName(wall.name);setColor(wall.color);setJoins(!!wall.joins);},[wall,editing]);
  const changed=joins!==!!wall.joins||name!==wall.name||color!==wall.color||(Object.keys(values) as Key[]).some(k=>!values[k].trim()||Math.abs(Number(values[k])-valuesFor()[k])>1e-8);
  let candidate:typeof wall|undefined,issue='';
  if(editing&&changed&&!state.gestureLabel)try{
    const n=(key:Key)=>values[key].trim()?Number(values[key]):NaN;
    candidate={...updateCurvedWall(wall,{center:[n('centerX'),n('centerZ')],radius:n('radius'),startAngle:n('startAngle'),sweepAngle:circle?curve.sweepAngle:n('sweepAngle')}),name,color,joins,height:n('height'),thickness:n('thickness'),elevation:n('elevation')};
    if(joins&&!wall.joins)candidate=attachWallJunctions(candidate,state.project.entities.filter((e):e is Wall=>e.kind==='wall'&&e.parentId===wall.parentId));
    applyCommand(state.project,{type:'replace',entity:candidate});
  }catch(error){issue=error instanceof Error?error.message:'Invalid curved wall dimensions.';}
  const labels:Record<Key,string>={centerX:'Center X',centerZ:'Center Z',radius:'Wall radius',height:'Wall height',thickness:'Wall thickness',elevation:'Base elevation',startAngle:'Start angle',sweepAngle:'Sweep angle'};
  const keys:Key[]=circle?['radius','thickness','height','elevation','centerX','centerZ']:['radius','thickness','height','elevation','centerX','centerZ','startAngle','sweepAngle'];
  return <Panel padding="body" aria-label={editing?'Edit curved wall':'Selected curved wall'}>
    <PanelHeading title={`${editing?'Editing':'Selected'} ${circle?'circular':'arc'} wall`} subtitle={level?.name}/>
    {!editing&&<><FieldMessage>{wall.name}</FieldMessage><dl className="opening-summary"><dt>Centerline radius</dt><dd>{curve.radius.toFixed(2)} m</dd><dt>Thickness × height</dt><dd>{wall.thickness.toFixed(2)} × {wall.height.toFixed(2)} m</dd><dt>{circle?'Circumference':'Arc length / sweep'}</dt><dd>{wallLength(wall).toFixed(2)} m{!circle&&` / ${curve.sweepAngle.toFixed(1)}°`}</dd></dl></>}
    <p role="status">{editing?status:'Double-click this wall or press Enter to edit radius, thickness and height.'}</p>
    <Button variant="ghost" onClick={onFrame}>Frame selected wall · F</Button>
    {editing&&<>
      <FieldMessage>Drag Center to move, Radius to resize{!circle&&', or Start/End to change the arc'}.</FieldMessage>
      <Field variant="checkbox"><CheckboxInput checked={snapping} disabled={!!state.gestureLabel} onChange={e=>onSnapping(e.target.checked)}/>Snap wall edits to 0.25 m</Field>
      <WallWalkEditor wall={wall} editor={editor} onStatus={onStatus}/>
      <BattlementsEditor wall={wall} editor={editor} onStatus={onStatus}/>
      <form onSubmit={e=>{e.preventDefault();if(candidate&&!issue&&changed)try{editor.execute({type:'replace',entity:candidate},'Edit curved wall dimensions');onStatus('Curved wall dimensions applied.');}catch(error){onStatus(error instanceof Error?error.message:'Could not apply wall dimensions.');}}}>
        <fieldset className="opening-edit-fields" disabled={!!state.gestureLabel}>
          <Field>Name<TextInput aria-label="Wall name" value={name} maxLength={80} required onChange={e=>setName(e.target.value)}/></Field>
          <Field variant="checkbox"><CheckboxInput checked={joins} onChange={e=>setJoins(e.target.checked)}/>Join wall chain</Field>
          <FieldGrid columns="auto">{keys.map(key=><Field variant="number" key={key}><span>{labels[key]}</span><FieldControl><NumericInput aria-label={labels[key]} step="any" required value={values[key]} onChange={e=>setValues(old=>({...old,[key]:e.target.value}))}/><small>{key.endsWith('Angle')?'°':'m'}</small></FieldControl></Field>)}</FieldGrid>
          <Field variant="color"><ColorInput aria-label="Wall color" disabled={!!wall.materialId} title={wall.materialId?'Color comes from the shared Material section':undefined} value={color} onChange={e=>setColor(e.target.value)}/><span>Wall color</span></Field>
          {issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}
          <Button type="submit" disabled={!changed||!!issue}>Apply wall dimensions</Button>
        </fieldset>
      </form>
      <FieldMessage>Radius follows the centerline. Attached straight walls follow radius and center edits. Openings retain their angular centers and widths; edits that clip openings are rejected. Thickness stays independent; height and base apply to connected walls.</FieldMessage>
      <Button variant="ghost" disabled={!!state.gestureLabel} onClick={()=>{try{editor.execute({type:'remove',id:wall.id},'Delete curved wall');onFinish();}catch(error){onStatus(error instanceof Error?error.message:'Cannot delete wall.');}}}>Delete wall</Button>
      <Button onClick={onFinish}>Finish editing <span>Esc</span></Button>
    </>}
    {level&&<Button variant="ghost" onClick={()=>onSelect(level.id)}>Select whole floor · {level.name}</Button>}
    {unit&&<Button variant="ghost" onClick={()=>onSelect(unit.id)}>Select whole unit · {unit.name}</Button>}
  </Panel>;
}
