import {useEffect,useState} from 'react';
import {applyCommand,DEFAULT_RAILING,wallRailingLength,type Editor,type RailingHost,type Slab} from '@openlandcraft/core';
import {Button,CheckboxInput,Field,FieldControl,FieldGrid,FieldMessage,NumericInput,SelectInput,SelectOption} from './ui';
import {InspectorSection} from './InspectorSection';

export function RailingEditor({host,editor,onStatus}:{host:RailingHost;editor:Editor;onStatus:(message:string)=>void}){
  const railing=host.kind==='wall'?host.walk?.railings:host.stairs?.railings;
  const gap=host.kind==='wall'?host.walk?.railings?.gap:undefined;
  const [enabled,setEnabled]=useState(!!railing),[height,setHeight]=useState(String(railing?.height??DEFAULT_RAILING.height)),[spacing,setSpacing]=useState(String(railing?.spacing??DEFAULT_RAILING.spacing));
  const [side,setSide]=useState<NonNullable<NonNullable<Slab['stairs']>['railings']>['side']>(host.kind==='slab'?host.stairs?.railings?.side??'both':'both');
  const [opening,setOpening]=useState(!!gap),[position,setPosition]=useState(String((gap?.position??.5)*100)),[width,setWidth]=useState(String(gap?.width??1.5));
  useEffect(()=>{setEnabled(!!railing);setHeight(String(railing?.height??DEFAULT_RAILING.height));setSpacing(String(railing?.spacing??DEFAULT_RAILING.spacing));setSide(host.kind==='slab'?host.stairs?.railings?.side??'both':'both');setOpening(!!gap);setPosition(String((gap?.position??.5)*100));setWidth(String(gap?.width??1.5));},[host]);
  const busy=!!editor.getSnapshot().gestureLabel,n=(value:string)=>value.trim()?Number(value):NaN;
  const settings={height:n(height),spacing:n(spacing)};
  const candidate:RailingHost=host.kind==='wall'?{...host,walk:{...host.walk!,railings:enabled?{...settings,...(opening?{gap:{position:n(position)/100,width:n(width)}}:{})}:undefined}}:{...host,stairs:{...host.stairs!,railings:enabled?{...settings,side}:undefined}};
  const next=candidate.kind==='wall'?candidate.walk?.railings:candidate.stairs?.railings,changed=JSON.stringify(next)!==JSON.stringify(railing);
  let issue='';if(changed&&!busy)try{applyCommand(editor.getSnapshot().project,{type:'replace',entity:candidate});}catch(error){issue=error instanceof Error?error.message:'Invalid railings.';}
  return <InspectorSection sectionId="railings" title="Railings">
    <form onSubmit={e=>{e.preventDefault();if(!changed||issue||busy)return;try{editor.execute({type:'replace',entity:candidate},enabled?'Edit railings':'Remove railings');onStatus(enabled?'Railings applied. They follow this object automatically.':'Railings removed.');}catch(error){onStatus(error instanceof Error?error.message:'Could not edit railings.');}}}>
      <fieldset className="opening-edit-fields" disabled={busy}>
        <Field variant="checkbox"><CheckboxInput checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Enable railings</Field>
        {enabled&&<>
          {host.kind==='slab'&&<Field>Stair sides<SelectInput aria-label="Railing sides" value={side} onValueChange={value=>setSide(value as typeof side)}><SelectOption value="both">Both sides</SelectOption><SelectOption value="left">{host.stairs?.spiral?host.stairs.spiral.clockwise?'Outer edge':'Inner edge':'Left looking uphill'}</SelectOption><SelectOption value="right">{host.stairs?.spiral?host.stairs.spiral.clockwise?'Inner edge':'Outer edge':'Right looking uphill'}</SelectOption></SelectInput></Field>}
          <FieldGrid columns="auto">
            <Field variant="number"><span>Railing height</span><FieldControl><NumericInput aria-label="Railing height" min={.3} max={2.5} step="any" required value={height} onChange={e=>setHeight(e.target.value)}/><small>m</small></FieldControl></Field>
            <Field variant="number"><span>Max post spacing</span><FieldControl><NumericInput aria-label="Max post spacing" min={.2} max={5} step="any" required value={spacing} onChange={e=>setSpacing(e.target.value)}/><small>m</small></FieldControl></Field>
          </FieldGrid>
          <FieldMessage>{host.kind==='wall'?'Railing follows the inner, open edge of the walk. Circular posts are spaced evenly around the tower.':host.stairs?.spiral?'Height is vertical above the spiral nosing line. Posts sit on treads; maximum spacing follows each curved edge.':'Height is vertical above the tread nosing line. Posts sit on treads; spacing is measured along the horizontal run.'} Top rail and middle rail follow every edit.</FieldMessage>
          {host.kind==='wall'&&!!host.walk?.stairOpenings?.some(g=>g.edge==='inner')&&<FieldMessage>Attached stairs create their own access openings automatically. Edit those connections on the stairs; the optional opening below is additional.</FieldMessage>}
          {host.kind==='wall'&&<>
            <Field variant="checkbox"><CheckboxInput checked={opening} onChange={e=>setOpening(e.target.checked)}/>Leave access opening</Field>
            {opening&&<>
              <FieldGrid columns="auto">
                <Field variant="number"><span>Opening center along wall</span><FieldControl><NumericInput aria-label="Railing opening center" min={0} max={100} step="any" required value={position} onChange={e=>setPosition(e.target.value)}/><small>%</small></FieldControl></Field>
                <Field variant="number"><span>Opening width</span><FieldControl><NumericInput aria-label="Railing opening width" min={.5} max={8} step="any" required value={width} onChange={e=>setWidth(e.target.value)}/><small>m</small></FieldControl></Field>
              </FieldGrid>
              <FieldMessage>Center follows Start → End, or the tower seam around a full circle. Width stays fixed as the radius changes. Railing length: {wallRailingLength(host).toFixed(2)} m.</FieldMessage>
            </>}
          </>}
        </>}
        {issue&&<FieldMessage role="alert" tone="error">{issue}</FieldMessage>}
        <Button type="submit" disabled={!changed||!!issue||busy}>Apply railings</Button>
      </fieldset>
    </form>
  </InspectorSection>;
}
