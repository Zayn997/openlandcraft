import { useEffect, useState } from 'react';
import { Check, Plus, RotateCcw, Route, Trash2 } from 'lucide-react';
import { type Editor, type Path } from '@openlandcraft/core';
import { pathLength, type PathPoint } from '@openlandcraft/landscape';
import { NumberField } from './NumberField';

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
  return <div className="inspector-content path-inspector">
    <div className="object-heading"><div className="object-icon"><Route size={24} /></div><div><h2>{path.name}</h2><span>Editable landscape path</span></div></div>
    <div className="path-summary"><strong>{pathLength(draft.points).toFixed(1)} <small>m</small></strong><span>Plan length · {draft.points.length} points</span></div>
    <label className="path-snap"><input type="checkbox" aria-label="Snap path points" checked={snapping} onChange={event => onSnapping(event.target.checked)} />Snap to 0.5 m grid and building edges</label>
    <form onInputCapture={begin} onSubmit={event => { event.preventDefault(); if (!error) editor.commit(); }}>
      <section className="property-section"><h3>Path surface</h3>
        <label className="name-field">Name<input aria-label="Path name" required maxLength={80} value={draft.name} onChange={event => change({ ...draft, name: event.target.value })} /></label>
        <div className="river-settings"><NumberField label="Path width" value={draft.width} min={0.5} max={8} onChange={width => change({ ...draft, width })} /></div>
        <label className="select-field">Surface<select aria-label="Path surface" value={draft.surface} onChange={event => change({ ...draft, surface: event.target.value as Path['surface'] })}><option value="gravel">Gravel</option><option value="paving">Stone paving</option><option value="timber">Timber</option></select></label>
        <div className="path-elevation"><span>Elevation</span><strong>Follow terrain</strong></div>
        <p className="field-hint">The surface follows sculpting and river carving. It stays on the ground at water crossings. Grading, bridges, and fixed elevations come later.</p>
      </section>
      <section className="property-section"><h3>Control points<span>{draft.points.length} / 16</span></h3>
        <p className="field-hint">Drag the numbered handles or enter X/Z below. Endpoints snap within 0.8 m of visible building corners and edge midpoints; internal points snap to the grid. Dimensions show horizontal plan distances.</p>
        {draft.points.map((point, index) => <div key={index} className="river-point-editor"><div><strong>Point {index + 1}{index === 0 ? ' · Start' : index === draft.points.length - 1 ? ' · End' : ''}</strong>
          <button type="button" aria-label={`Insert after path point ${index + 1}`} disabled={index === draft.points.length - 1 || draft.points.length >= 16} onClick={() => { const points = [...draft.points], next = points[index + 1]; points.splice(index + 1, 0, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2]); change({ ...draft, points }); }}><Plus size={14} /></button>
          <button type="button" aria-label={`Remove path point ${index + 1}`} disabled={draft.points.length <= 2} onClick={() => change({ ...draft, points: draft.points.filter((_, i) => i !== index) })}><Trash2 size={14} /></button></div>
          <div className="construction-fields">{point.map((value, axis) => <NumberField key={axis} label={`Path point ${index + 1} ${axis === 0 ? 'X' : 'Z'}`} value={value} min={-100} max={100} onChange={value => { const points = draft.points.map(p => [...p] as PathPoint); points[index][axis] = value; change({ ...draft, points }); }} />)}</div>
        </div>)}
      </section>
      {error && <p className="river-error" role="alert">{error}</p>}
      <div className={`edit-actions ${state.gestureLabel ? 'has-preview' : ''}`}><div><span className="status-dot" />{error ? 'Resolve the invalid edit' : state.gestureLabel ? 'Previewing path changes' : 'All changes applied'}</div>
        <button type="submit" className="primary-button" disabled={!state.gestureLabel || !!error}><Check size={15} />Apply path changes</button>
        <button type="button" className="cancel-button" disabled={!state.gestureLabel} onClick={cancel}><RotateCcw size={13} />Cancel preview<span>Esc</span></button>
      </div>
      <div className="object-actions"><button type="button" className="delete-button" disabled={!!state.gestureLabel} onClick={() => editor.execute({ type: 'remove', id: path.id }, 'Delete path')}><Trash2 size={14} />Delete path</button></div>
    </form>
    <p className="scope-note">One open path, up to 16 points and 250 m. Deleting it preserves your terrain. Snapping places endpoints; it does not attach them to future building moves.</p>
  </div>;
}
