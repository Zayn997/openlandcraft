import {OpeningJoineryFields,joineryDraft,joineryValue} from './OpeningJoineryFields';
import { Button, PanelHeading, CheckboxInput, Field, FieldControl, FieldGrid, FieldMessage, NumericInput, Panel, SelectInput, SelectOption } from './ui';
import { useEffect, useState } from 'react';
import { InspectorSection } from './InspectorSection';
import { applyCommand,editOpening, type Editor, type Level, type Opening, type Wall } from '@openlandcraft/core';

export function OpeningEditor({ wall, opening, editor, levels, levelId, onLevel, onSelect, snapping, onSnapping, onFinish, onFrame, status, onStatus }: {
  wall?: Wall; opening?: Opening; editor: Editor; levels: Level[]; levelId?: string;
  onLevel: (id: string) => void; onSelect: (wallId: string, openingId: string) => void;
  snapping: boolean; onSnapping: (value: boolean) => void; onFinish: () => void; onFrame: () => void; status: string; onStatus: (text: string) => void;
}) {
  const fields = ['offset', 'width', 'height', 'sill'] as const;
  const [values, setValues] = useState({ offset: '', width: '', height: '', sill: '' });
  const [shape,setShape]=useState<'rectangle'|'arch'>('rectangle'),[archRise,setArchRise]=useState('');
  useEffect(() => { if (opening) setValues({ offset: String(Number(opening.offset.toFixed(8))), width: String(Number(opening.width.toFixed(8))), height: String(Number(opening.height.toFixed(8))), sill: String(Number(opening.sill.toFixed(8))) }); }, [opening]);
  useEffect(()=>{if(opening){setShape(opening.shape??'rectangle');setArchRise(String(opening.archRise??Math.min(opening.width/2,opening.height/2)));}},[opening]);
  const [joinery,setJoinery]=useState(()=>joineryDraft(opening?.kind??'door',opening?.joinery));
  useEffect(()=>setJoinery(joineryDraft(opening?.kind??'door',opening?.joinery)),[opening]);
  const state = editor.getSnapshot();
  let candidate: Wall | undefined, issue = '';
  if (wall && opening) try {
    candidate = editOpening(wall, opening.id, {...Object.fromEntries(fields.map(key => [key, values[key].trim() === '' ? NaN : Number(values[key])])),joinery:joineryValue(opening.kind,joinery),shape,archRise:shape==='arch'?(archRise.trim()===''?NaN:Number(archRise)):undefined});
    applyCommand(state.project,{type:'replace',entity:candidate});
  } catch (error) { issue = error instanceof Error ? error.message : 'Invalid opening.'; }
  const changed = candidate && opening && (JSON.stringify(candidate.openings?.find(o=>o.id===opening.id)?.joinery)!==JSON.stringify(opening.joinery)||shape!==(opening.shape??'rectangle')||shape==='arch'&&Number(archRise)!==opening.archRise||fields.some(key => Math.abs(Number(values[key]) - opening[key]) > 1e-8));
  const commit = (operation: () => void) => { try { operation(); } catch (error) { onStatus(error instanceof Error ? error.message : 'The edit could not be applied.'); } };
  return <Panel padding="body" className="opening-tools" aria-label="Edit openings">
    <PanelHeading title={<>{opening ? `Editing ${opening.kind}` : 'Select an opening'}</>} subtitle={<>EDIT ON WALL</>} />
    <Field>Active floor<SelectInput aria-label="Opening edit floor" value={levelId ?? ''} disabled={!levels.length} placeholder="Add a building first" onValueChange={(value) => onLevel(value)}>
      {levels.map(level => <SelectOption key={level.id} value={level.id}>{level.name} · {level.position[1].toFixed(2)} m</SelectOption>)}
    </SelectInput></Field>
    <FieldMessage>This floor is isolated and its roof hidden. Drag this opening along its wall. Clicking another opening selects it; double-click to edit.</FieldMessage>
    {wall && opening && <>
      <Button variant="ghost" className="text-button" onClick={onFrame}>Frame selected opening · F</Button>
      <Field>{wall.name}<SelectInput aria-label="Selected hosted opening" value={opening.id} disabled={!!state.gestureLabel} onValueChange={(value) => onSelect(wall.id, value)}>
        {wall.openings?.map((o, i) => <SelectOption key={o.id} value={o.id}>{o.kind === 'door' ? 'Door' : 'Window'} {i + 1} · {o.offset.toFixed(2)} m</SelectOption>)}
      </SelectInput></Field>
      <InspectorSection sectionId="opening-dimensions" title="Dimensions & position"><form onSubmit={event => { event.preventDefault(); if (candidate && !issue && changed) commit(() => { editor.execute({ type: 'replace', entity: candidate! }, 'Edit opening'); onStatus('Opening updated.'); }); }}>
        <fieldset disabled={!!state.gestureLabel} className="opening-edit-fields">
          <Field>Opening shape<SelectInput aria-label="Opening shape" value={shape} onValueChange={value=>setShape(value as typeof shape)}><SelectOption value="rectangle">Rectangular</SelectOption><SelectOption value="arch">Round arch</SelectOption></SelectInput></Field>
          <FieldGrid columns={2}>{fields.filter(key => key !== 'sill' || opening.kind === 'window').map(key => <Field variant="number" key={key}><span>{key === 'sill' ? 'Sill height' : key === 'offset' ? 'Wall offset' : key === 'width' ? 'Width' : 'Height'}</span><FieldControl>
            <NumericInput aria-label={`Opening ${key}`} step="any" min={key === 'width' || key === 'height' ? 0.3 : 0} max={key === 'offset' ? 650 : 20} required value={values[key]} onChange={e => setValues(old => ({ ...old, [key]: e.target.value }))} /><small>m</small>
          </FieldControl></Field>)}</FieldGrid>
          {shape==='arch'&&<Field variant="number"><span>Arch rise</span><FieldControl><NumericInput aria-label="Opening arch rise" min={.1} step="any" value={archRise} onChange={e=>setArchRise(e.target.value)}/><small>m</small></FieldControl></Field>}
          <InspectorSection sectionId="opening-joinery" title="Frame & infill"><OpeningJoineryFields kind={opening.kind} value={joinery} onChange={setJoinery} project={state.project} disabled={!!state.gestureLabel}/></InspectorSection>
          {issue && <FieldMessage tone="error" role="alert">{issue}</FieldMessage>}
          <Button variant="default" className="primary-button" type="submit" disabled={!changed || !!issue}>Apply opening changes</Button>
          <Button variant="ghost" className="text-button" type="button" onClick={() => commit(() => { editor.execute({ type: 'replace', entity: { ...wall, openings: wall.openings!.filter(o => o.id !== opening.id) } }, 'Remove opening'); onStatus('Opening removed. Undo restores it.'); })}>Remove selected opening</Button>
        </fieldset>
      </form></InspectorSection>
    </>}
    <Field variant="checkbox"><CheckboxInput checked={snapping} disabled={!!state.gestureLabel} onChange={e => onSnapping(e.target.checked)} />Snap edits to 0.1 m</Field>
    <p className="opening-feedback" role="status">{status}</p>
    <FieldMessage>Square side handles resize width. The upper handle changes height in 3D; use the height field in plan view. A completed drag is one undo step. Esc cancels and exits.</FieldMessage>
    {wall?.curve&&<FieldMessage>Width and offset are measured along the curve. Radius edits keep the opening's angular center and its width. Height includes the arch rise.</FieldMessage>}
    <Button variant="default" className="primary-button" onClick={onFinish}>Finish editing <span>Esc</span></Button>
  </Panel>;
}
