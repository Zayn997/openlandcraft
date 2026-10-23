import {useEffect,useState} from 'react';
import {applyCommand,defaultWallWalk,wallWalkProfile,type Editor,type Wall} from '@openlandcraft/core';
import {Button,CheckboxInput,Field,FieldControl,FieldGrid,FieldMessage,NumericInput,SelectInput,SelectOption} from './ui';
import {InspectorSection} from './InspectorSection';
import {RailingEditor} from './RailingEditor';

export function WallWalkEditor({wall,editor,onStatus}:{wall:Wall;editor:Editor;onStatus:(message:string)=>void}){
  const keys=['width','thickness','parapetHeight','parapetThickness'] as const;
  type Key=typeof keys[number];
  const textValues=()=>Object.fromEntries(keys.map(k=>[k,String((wall.walk??defaultWallWalk(wall))[k])])) as Record<Key,string>;
  const [enabled,setEnabled]=useState(!!wall.walk),[values,setValues]=useState(textValues),[side,setSide]=useState<'left'|'right'>(wall.walk?.side??'left');
  useEffect(()=>{setEnabled(!!wall.walk);setValues(textValues());setSide(wall.walk?.side??'left');},[wall]);
  const busy=!!editor.getSnapshot().gestureLabel;
  const walk=enabled?{...wall.walk,width:Number(values.width),thickness:Number(values.thickness),parapetHeight:Number(values.parapetHeight),parapetThickness:Number(values.parapetThickness),side}:undefined;
  const candidate={...wall,walk},changed=JSON.stringify(walk)!==JSON.stringify(wall.walk);
  let issue='';if(changed&&!busy)try{applyCommand(editor.getSnapshot().project,{type:'replace',entity:candidate});}catch(error){issue=error instanceof Error?error.message:'Invalid wall walk.';}
  const labels:Record<Key,string>={width:'Walk clear width',thickness:'Deck thickness',parapetHeight:'Parapet height',parapetThickness:'Parapet thickness'};
  return <><InspectorSection sectionId="wall-walk" title="Wall walk & parapet">
    <form onSubmit={e=>{e.preventDefault();if(changed&&!issue&&!busy)try{editor.execute({type:'replace',entity:candidate},enabled?'Edit wall walk and parapet':'Remove wall walk and parapet');onStatus(enabled?'Wall walk and parapet applied. They follow this wall automatically.':'Wall walk removed. Full-height wall and battlements restored.');}catch(error){onStatus(error instanceof Error?error.message:'Could not edit wall walk.');}}}>
      <fieldset className="opening-edit-fields" disabled={busy}>
        <Field variant="checkbox"><CheckboxInput checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Enable wall walk & parapet</Field>
        {enabled&&<>
          {!wall.curve&&<Field>Walk side<SelectInput aria-label="Walk side" value={side} onValueChange={value=>setSide(value as 'left'|'right')}><SelectOption value="left">Left of wall direction</SelectOption><SelectOption value="right">Right of wall direction</SelectOption></SelectInput></Field>}
          <FieldGrid columns="auto">{keys.map(key=><Field variant="number" key={key}><span>{labels[key]}</span><FieldControl><NumericInput aria-label={labels[key]} min={key==='width'?.5:key==='parapetHeight'?.3:key==='parapetThickness'?.05:.1} max={key==='width'?8:key==='parapetHeight'?3:key==='parapetThickness'?2:1} step="any" required value={values[key]} onChange={e=>setValues(old=>({...old,[key]:e.target.value}))}/><small>m</small></FieldControl></Field>)}</FieldGrid>
          {!issue&&<FieldMessage>Walking surface: {(wall.elevation+wallWalkProfile(candidate).deckTop).toFixed(2)} m above level · {wall.curve?'extends inward':'side follows Start → End'}</FieldMessage>}
          {!!wall.walk?.stairOpenings?.length&&<FieldMessage>{wall.walk.stairOpenings.length} attached stair entrance{wall.walk.stairOpenings.length===1?'':'s'} {wall.walk.stairOpenings.length===1?'follows':'follow'} this walk. Select the stairs to reattach or detach. Detach their tops before removing the walk.</FieldMessage>}
          <FieldMessage>Clear width starts behind the parapet. Wall height stays at the parapet top, beneath battlements. Deck and parapet follow wall edits; battlements use parapet thickness. Hide the roof for an open tower.</FieldMessage>
        </>}
        {issue&&<FieldMessage tone="error" role="alert">{issue}</FieldMessage>}
        <Button type="submit" disabled={!changed||!!issue||busy}>Apply wall walk</Button>
      </fieldset>
    </form>
  </InspectorSection>{wall.walk&&<RailingEditor host={wall} editor={editor} onStatus={onStatus}/>}</>;
}
