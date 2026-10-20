import { Button, PointEditor, PropertyRow, ActionBar, ActionRow, CheckboxInput, Field, FieldGrid, FieldMessage, NumberField, PanelBody, PanelHeading, SelectInput, SelectOption, TextInput } from './ui';
import { InspectorSection } from './InspectorSection';
import { useEffect, useState } from 'react';
import { Check, Plus, RotateCcw, Route, Trash2 } from 'lucide-react';
import { type Editor, type Path } from '@openlandcraft/core';
import { pathLength, type PathPoint } from '@openlandcraft/landscape';

export function PathInspector({ path, editor, cancel, snapping, onSnapping }: { path: Path; editor: Editor; cancel: () => void; snapping: boolean; onSnapping: (value: boolean) => void }) {
  const [draft, setDraft] = useState(path), [error, setError] = useState('');
  useEffect(() => setDraft(path), [path]);
  const state = editor.getSnapshot();
  const begin = () => { if (!editor.getSnapshot().gestureLabel) editor.begin('Edit path'); };
  const change = (next: Path) => {
    setDraft(next); begin();
    try { editor.preview({ type: 'replace', entity: next }); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'The path is invalid.'); }
  };
  return <PanelBody className="path-inspector">
    <PanelHeading title={<>{path.name}</>} icon={<><Route size={24} /></>} subtitle={<>Editable landscape path</>} />
    <div className="path-summary"><strong>{pathLength(draft.points).toFixed(1)} <small>m</small></strong><span>Plan length · {draft.points.length} points</span></div>
    <Field variant="checkbox"><CheckboxInput aria-label="Snap path points" checked={snapping} onChange={event => onSnapping(event.target.checked)} />Snap to 0.5 m grid and building edges</Field>
    <form onInputCapture={begin} onSubmit={event => { event.preventDefault(); if (!error) editor.commit(); }}>
      <InspectorSection sectionId="pathinspector-path-surface" title={<>Path surface</>}>
        <Field>Name<TextInput aria-label="Path name" required maxLength={80} value={draft.name} onChange={event => change({ ...draft, name: event.target.value })} /></Field>
        <FieldGrid columns={2}><NumberField label="Path width" value={draft.width} min={0.5} max={8} onChange={width => change({ ...draft, width })} /></FieldGrid>
        <Field>Surface<SelectInput aria-label="Path surface" value={draft.surface} onValueChange={(value) => change({ ...draft, surface: value as Path['surface'] })}><SelectOption value="gravel">Gravel</SelectOption><SelectOption value="paving">Stone paving</SelectOption><SelectOption value="timber">Timber</SelectOption></SelectInput></Field>
        <PropertyRow><span>Elevation</span><strong>Follow terrain</strong></PropertyRow>
        <FieldMessage>The surface follows sculpting and river carving. It stays on the ground at water crossings. Grading, bridges, and fixed elevations come later.</FieldMessage>
      </InspectorSection>
      <InspectorSection sectionId="pathinspector-control-points" title={<>Control points<span>{draft.points.length} / 16</span></>} defaultOpen={false}>
        <FieldMessage>Drag the numbered handles or enter X/Z below. Endpoints snap within 0.8 m of visible building corners and edge midpoints; internal points snap to the grid. Dimensions show horizontal plan distances.</FieldMessage>
        {draft.points.map((point, index) => <PointEditor key={index} title={<>Point {index + 1}{index === 0 ? ' · Start' : index === draft.points.length - 1 ? ' · End' : ''}</>} actions={<>
          <Button variant="ghost" size="icon-sm" type="button" aria-label={`Insert after path point ${index + 1}`} disabled={index === draft.points.length - 1 || draft.points.length >= 16} onClick={() => { const points = [...draft.points], next = points[index + 1]; points.splice(index + 1, 0, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2]); change({ ...draft, points }); }}><Plus size={14} /></Button>
          <Button variant="ghost" size="icon-sm" type="button" aria-label={`Remove path point ${index + 1}`} disabled={draft.points.length <= 2} onClick={() => change({ ...draft, points: draft.points.filter((_, i) => i !== index) })}><Trash2 size={14} /></Button></>}>
          <FieldGrid columns={2}>{point.map((value, axis) => <NumberField key={axis} label={`Path point ${index + 1} ${axis === 0 ? 'X' : 'Z'}`} value={value} min={-100} max={100} onChange={value => { const points = draft.points.map(p => [...p] as PathPoint); points[index][axis] = value; change({ ...draft, points }); }} />)}</FieldGrid>
        </PointEditor>)}
      </InspectorSection>
      {error && <p className="river-error" role="alert">{error}</p>}
      <ActionBar pending={!!(state.gestureLabel)}><div><span className="status-dot" />{error ? 'Resolve the invalid edit' : state.gestureLabel ? 'Previewing path changes' : 'All changes applied'}</div>
        <Button variant="default" type="submit" className="primary-button" disabled={!state.gestureLabel || !!error}><Check size={15} />Apply path changes</Button>
        <Button variant="ghost" type="button" className="cancel-button" disabled={!state.gestureLabel} onClick={cancel}><RotateCcw size={13} />Cancel preview<span>Esc</span></Button>
      </ActionBar>
      <ActionRow><Button variant="destructive" size="sm" type="button" className="delete-button" disabled={!!state.gestureLabel} onClick={() => editor.execute({ type: 'remove', id: path.id }, 'Delete path')}><Trash2 size={14} />Delete path</Button></ActionRow>
    </form>
    <InspectorSection sectionId="pathinspector-notes-1" title="About this object" defaultOpen={false}><FieldMessage>One open path, up to 16 points and 250 m. Deleting it preserves your terrain. Snapping places endpoints; it does not attach them to future building moves.</FieldMessage></InspectorSection>
  </PanelBody>;
}
