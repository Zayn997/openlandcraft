import {useEffect,useState} from 'react';
import {applyCommand,battlementLayout,DEFAULT_BATTLEMENTS,type Editor,type Wall} from '@openlandcraft/core';
import {Button,CheckboxInput,Field,FieldControl,FieldGrid,FieldMessage,NumericInput} from './ui';
import {InspectorSection} from './InspectorSection';

/** One editor for straight, arc and circular wall-owned patterns. */
export function BattlementsEditor({wall,editor,onStatus}:{wall:Wall;editor:Editor;onStatus:(message:string)=>void}){
  const textValues=()=>Object.fromEntries(Object.entries(wall.battlements??DEFAULT_BATTLEMENTS).map(([k,v])=>[k,String(v)])) as Record<'width'|'height'|'spacing',string>;
  const [enabled,setEnabled]=useState(!!wall.battlements),[values,setValues]=useState(textValues);
  useEffect(()=>{setEnabled(!!wall.battlements);setValues(textValues());},[wall]);
  const busy=!!editor.getSnapshot().gestureLabel;
  const battlements=enabled?{width:Number(values.width),height:Number(values.height),spacing:Number(values.spacing)}:undefined;
  const candidate={...wall,battlements};
  const changed=JSON.stringify(battlements)!==JSON.stringify(wall.battlements);
  let issue='';if(changed&&!busy)try{applyCommand(editor.getSnapshot().project,{type:'replace',entity:candidate});}catch(error){issue=error instanceof Error?error.message:'Invalid battlements.';}
  const layout=battlementLayout(candidate);
  return <InspectorSection sectionId="wall-battlements" title="Battlements">
    <form onSubmit={e=>{e.preventDefault();if(changed&&!issue&&!busy)try{editor.execute({type:'replace',entity:candidate},enabled?'Edit battlements':'Remove battlements');onStatus(enabled?'Battlements applied. They follow this wall automatically.':'Battlements removed.');}catch(error){onStatus(error instanceof Error?error.message:'Could not edit battlements.');}}}>
      <fieldset className="opening-edit-fields" disabled={busy}>
        <Field variant="checkbox"><CheckboxInput checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Enable battlements</Field>
        {enabled&&<>
          <FieldGrid columns="auto">{(['width','height','spacing'] as const).map(key=><Field variant="number" key={key}><span>{key==='spacing'?'Clear gap':key==='width'?'Block width':'Block height'}</span><FieldControl><NumericInput aria-label={`Battlement ${key}`} min="0.1" max={key==='spacing'?10:5} step="any" required value={values[key]} onChange={e=>setValues(old=>({...old,[key]:e.target.value}))}/><small>m</small></FieldControl></Field>)}</FieldGrid>
          {!issue&&<FieldMessage>{layout.count} blocks · {layout.gap.toFixed(2)} m clear gap · {wall.walk?'parapet':'wall'} thickness {(wall.walk?.parapetThickness??wall.thickness).toFixed(2)} m</FieldMessage>}
          <FieldMessage>Width and gap follow the wall centerline. Rings distribute evenly with at least the chosen gap; open walls center the pattern. Blocks follow wall edits and use parapet thickness when a wall walk is enabled. Each wall keeps its own pattern. Hide the roof for an open tower.</FieldMessage>
        </>}
        {issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}
        <Button type="submit" disabled={!changed||!!issue||busy}>Apply battlements</Button>
      </fieldset>
    </form>
  </InspectorSection>;
}
