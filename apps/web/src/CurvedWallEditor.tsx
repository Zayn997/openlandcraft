import { useEffect, useState } from 'react';
import { applyCommand, attachWallJunctions, isCircularWall, updateCurvedWall, type Wall } from '@openlandcraft/core';
import type { WallEditor } from './WallEditor';
import { WallPropertiesPanel } from './WallPropertiesPanel';
import { InspectorSection } from './InspectorSection';
import { Button, CheckboxInput, ColorInput, Field, FieldControl, FieldGrid, FieldMessage, NumericInput, TextInput } from './ui';

export function CurvedWallEditor(props:Parameters<typeof WallEditor>[0]){
  const {wall,editor,onStatus}=props;
  const curve=wall.curve!,circle=isCircularWall(wall),state=editor.getSnapshot();
  const valuesFor=()=>({centerX:curve.center[0],centerZ:curve.center[1],radius:curve.radius,height:wall.height,thickness:wall.thickness,elevation:wall.elevation,startAngle:curve.startAngle,sweepAngle:curve.sweepAngle});
  type Key=keyof ReturnType<typeof valuesFor>;
  const textValues=()=>Object.fromEntries(Object.entries(valuesFor()).map(([k,v])=>[k,String(Number(v.toFixed(8)))])) as Record<Key,string>;
  const [values,setValues]=useState(textValues),[name,setName]=useState(wall.name),[color,setColor]=useState(wall.color),[joins,setJoins]=useState(!!wall.joins);
  useEffect(()=>{setValues(textValues());setName(wall.name);setColor(wall.color);setJoins(!!wall.joins);},[wall]);
  const changed=joins!==!!wall.joins||name!==wall.name||color!==wall.color||(Object.keys(values) as Key[]).some(k=>!values[k].trim()||Math.abs(Number(values[k])-valuesFor()[k])>1e-8);
  let candidate:typeof wall|undefined,issue='';
  if(changed&&!state.gestureLabel)try{
    const n=(key:Key)=>values[key].trim()?Number(values[key]):NaN;
    candidate={...updateCurvedWall(wall,{center:[n('centerX'),n('centerZ')],radius:n('radius'),startAngle:n('startAngle'),sweepAngle:circle?curve.sweepAngle:n('sweepAngle')}),name,color,joins,height:n('height'),thickness:n('thickness'),elevation:n('elevation')};
    if(joins&&!wall.joins)candidate=attachWallJunctions(candidate,state.project.entities.filter((e):e is Wall=>e.kind==='wall'&&e.parentId===wall.parentId));
    applyCommand(state.project,{type:'replace',entity:candidate});
  }catch(error){issue=error instanceof Error?error.message:'Invalid curved wall dimensions.';}
  const labels:Record<Key,string>={centerX:'Center X',centerZ:'Center Z',radius:'Wall radius',height:'Wall height',thickness:'Wall thickness',elevation:'Base elevation',startAngle:'Start angle',sweepAngle:'Sweep angle'};
  const numericField=(key:Key)=><Field variant="number" key={key}><span>{labels[key]}</span><FieldControl><NumericInput aria-label={labels[key]} step="any" required value={values[key]} onChange={e=>setValues(old=>({...old,[key]:e.target.value}))}/><small>{key.endsWith('Angle')?'°':'m'}</small></FieldControl></Field>;
  return <WallPropertiesPanel {...props}>
      <form onSubmit={e=>{e.preventDefault();if(candidate&&!issue&&changed&&!state.gestureLabel)try{editor.execute({type:'replace',entity:candidate},'Edit curved wall dimensions');onStatus('Curved wall dimensions applied.');}catch(error){onStatus(error instanceof Error?error.message:'Could not apply wall dimensions.');}}}>
        <fieldset className="opening-edit-fields" disabled={!!state.gestureLabel}>
          <Field>Name<TextInput aria-label="Wall name" value={name} maxLength={80} required onChange={e=>setName(e.target.value)}/></Field>
          <FieldGrid columns={2}>{(['height','thickness','elevation','radius'] as const).map(numericField)}</FieldGrid>
          <Field variant="checkbox" title="Height and base elevation apply to connected walls; thickness stays independent."><CheckboxInput checked={joins} onChange={e=>setJoins(e.target.checked)}/>Join wall chain</Field>
          <Field variant="color"><ColorInput aria-label="Wall color" disabled={!!wall.materialId} title={wall.materialId?'Color comes from the shared Material section':undefined} value={color} onChange={e=>setColor(e.target.value)}/><span>Wall color</span></Field>
          <InspectorSection sectionId="wall-position" title="Position & arc" defaultOpen={false}>
            <FieldGrid columns={2}>{(['centerX','centerZ'] as const).map(numericField)}{!circle&&(['startAngle','sweepAngle'] as const).map(numericField)}</FieldGrid>
          </InspectorSection>
          {issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}
          <Button type="submit" disabled={!changed||!!issue}>Apply changes</Button>
        </fieldset>
      </form>
  </WallPropertiesPanel>;
}
