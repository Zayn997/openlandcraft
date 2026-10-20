import { Button, PointEditor, ActionBar, ActionRow, ColorInput, Field, FieldGrid, FieldMessage, NumberField, PanelForm, PanelHeading, Row, TextInput } from './ui';
import { InspectorSection } from './InspectorSection';
import { useEffect, useState } from 'react';
import { Check, Plus, RotateCcw, Trash2, Waves } from 'lucide-react';
import { type Editor, type River } from '@openlandcraft/core';
import { WaterMaterialFields } from './MaterialFields';

export function RiverInspector({ river, editor, cancel, playing, onReset, onStep }: { river: River; editor: Editor; cancel: () => void; playing:boolean; onReset:()=>void; onStep:()=>void }) {
  const [draft, setDraft] = useState(river), [error, setError] = useState('');
  useEffect(() => { setDraft(river); }, [river]);
  const state = editor.getSnapshot();
  const site = state.project.site;
  const minimumWidth = Math.max(1, Math.ceil(20 * Math.max(site.width / (site.terrain.columns - 1), site.depth / (site.terrain.rows - 1))) / 10);
  const change = (next: River) => {
    setDraft(next);
    try {
      if (!editor.getSnapshot().gestureLabel) editor.begin('Edit river');
      editor.preview({ type: 'replace', entity: next }); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'The river is invalid.'); }
  };
  return <PanelForm className="river-inspector" onInputCapture={()=>{if(!editor.getSnapshot().gestureLabel)editor.begin('Edit river');}} onSubmit={(event) => { event.preventDefault(); if (!error) editor.commit(); }}>
    <PanelHeading title={<>{river.name}</>} icon={<><Waves size={24} /></>} subtitle={<>Editable river · upstream → downstream</>} />
    <InspectorSection sectionId="riverinspector-river-shape" title={<>River</>}><Field>Name<TextInput aria-label="River name" required maxLength={80} value={draft.name} onChange={(event) => change({ ...draft, name: event.target.value })} /></Field><FieldGrid columns={2}>
      <NumberField label="River width" value={draft.width} min={minimumWidth} max={12} onChange={(width) => change({ ...draft, width })} />
      <NumberField label="River depth" value={draft.depth} min={0.2} max={5} onChange={(depth) => change({ ...draft, depth })} />
      <NumberField label="Bank blend" value={draft.bank} min={1} max={8} onChange={(bank) => change({ ...draft, bank })} />
      <NumberField label="Flow speed" value={draft.speed} min={0} max={3} unit="×" onChange={(speed) => change({ ...draft, speed })} />
    </FieldGrid><Field variant="color"><ColorInput aria-label="River color" value={draft.color} onChange={(event) => change({ ...draft, color: event.target.value })} /><span>Water color</span><code>{draft.color.toUpperCase()}</code></Field></InspectorSection>
    <InspectorSection sectionId="riverinspector-water-motion" title={<>Water motion</>} defaultOpen={false}><FieldGrid columns={2}>
      <NumberField label="River wave amplitude" value={draft.water.amplitude} min={0} max={0.4} onChange={amplitude=>change({...draft,water:{...draft.water,amplitude}})} />
      <NumberField label="River wavelength" value={draft.water.wavelength} min={1.5} max={12} onChange={wavelength=>change({...draft,water:{...draft.water,wavelength}})} />
      <NumberField label="River foam" value={draft.water.foam} min={0} max={1} unit="" onChange={foam=>change({...draft,water:{...draft.water,foam}})} />
      <NumberField label="River foam lifetime" value={draft.water.foamPersistence} min={1} max={20} unit="s" onChange={foamPersistence=>change({...draft,water:{...draft.water,foamPersistence}})} />
      <NumberField label="Bank wetness" value={draft.water.wetBank} min={0} max={1} unit="" onChange={wetBank=>change({...draft,water:{...draft.water,wetBank}})} />
      <NumberField label="Bank drying time" value={draft.water.dryingTime} min={5} max={90} unit="s" onChange={dryingTime=>change({...draft,water:{...draft.water,dryingTime}})} />
    </FieldGrid><FieldMessage>Waves follow the channel and respond to depth. Foam flows downstream and fades; banks stay wet after water retreats. Flow speed controls the water preview.</FieldMessage>
      <Row className="coast-preview"><button type="button" disabled={!!state.gestureLabel} onClick={onReset}>Reset river preview</button><button type="button" disabled={!!state.gestureLabel||playing||river.speed===0} onClick={onStep}>Step river 0.5 s</button></Row>
      <FieldMessage>Pause water to step the river. Editing its shape or waves restarts this preview; material and foam settings retain it.</FieldMessage>
    </InspectorSection>
    <WaterMaterialFields appearance={draft.appearance} color={draft.color} onChange={values=>change({...draft,...values})} />
    <InspectorSection sectionId="riverinspector-control-points" title={<>Control points<span>{draft.points.length} / 16</span></>} defaultOpen={false}><FieldMessage>Drag the numbered handles in the viewport to move X/Z. Edit water elevation here. Point order defines flow direction; elevations must descend or stay level.</FieldMessage>
      {draft.points.map((point, index) => <PointEditor key={index} title={<>Point {index + 1}</>} actions={<><Button variant="ghost" size="icon-sm" type="button" aria-label={`Insert after point ${index + 1}`} title="Insert midpoint" disabled={index === draft.points.length - 1 || draft.points.length >= 16} onClick={() => { const points = [...draft.points], next = points[index + 1]; points.splice(index + 1, 0, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2, (point[2] + next[2]) / 2]); change({ ...draft, points }); }}><Plus size={13} /></Button><Button variant="ghost" size="icon-sm" type="button" aria-label={`Remove river point ${index + 1}`} disabled={draft.points.length <= 2} onClick={() => change({ ...draft, points: draft.points.filter((_, i) => i !== index) })}><Trash2 size={13} /></Button></>}><FieldGrid columns={'auto'}>{point.map((value, axis) => <NumberField key={axis} label={`Point ${index + 1} ${['X', 'elevation', 'Z'][axis]}`} value={value} min={axis === 1 ? -8 : -100} max={axis === 1 ? 30 : 100} onChange={(value) => { const points = draft.points.map((point) => [...point] as [number, number, number]); points[index][axis] = value; change({ ...draft, points }); }} />)}</FieldGrid></PointEditor>)}
    </InspectorSection>
    {error && <p className="river-error" role="alert">{error}</p>}
    <ActionBar pending={!!(state.gestureLabel)}><div><span className="status-dot" />{error ? 'Resolve the invalid edit' : state.gestureLabel ? 'Previewing river changes' : 'All changes applied'}</div><Button variant="default" type="submit" className="primary-button" disabled={!state.gestureLabel || !!error}><Check size={15} />Apply river changes</Button><Button variant="ghost" type="button" className="cancel-button" disabled={!state.gestureLabel} onClick={cancel}><RotateCcw size={13} />Cancel preview<span>Esc</span></Button></ActionBar>
    <ActionRow><Button variant="destructive" size="sm" type="button" className="delete-button" disabled={!!state.gestureLabel} onClick={() => editor.execute({ type: 'remove', id: river.id }, 'Delete river')}><Trash2 size={14} />Delete river</Button></ActionRow>
    <InspectorSection sectionId="riverinspector-notes-1" title="About this object" defaultOpen={false}><FieldMessage>Carving is derived from your sculpted ground. Moving, hiding, or deleting this river preserves independent terrain edits. Flow is a visual preview; this version has one unbranched channel.</FieldMessage></InspectorSection>
  </PanelForm>;
}
