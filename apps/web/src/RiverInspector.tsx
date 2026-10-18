import { useEffect, useState } from 'react';
import { Check, Plus, RotateCcw, Trash2, Waves } from 'lucide-react';
import { type Editor, type River } from '@openlandcraft/core';
import { NumberField } from './NumberField';

export function RiverInspector({ river, editor, cancel }: { river: River; editor: Editor; cancel: () => void }) {
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
  return <form className="inspector-content river-inspector" onSubmit={(event) => { event.preventDefault(); if (!error) editor.commit(); }}>
    <div className="object-heading"><div className="object-icon"><Waves size={24} /></div><div><h2>{river.name}</h2><span>Editable river · upstream → downstream</span></div></div>
    <section className="property-section"><h3>River</h3><label className="name-field">Name<input aria-label="River name" required maxLength={80} value={draft.name} onChange={(event) => change({ ...draft, name: event.target.value })} /></label><div className="river-settings">
      <NumberField label="River width" value={draft.width} min={minimumWidth} max={12} onChange={(width) => change({ ...draft, width })} />
      <NumberField label="River depth" value={draft.depth} min={0.2} max={5} onChange={(depth) => change({ ...draft, depth })} />
      <NumberField label="Bank blend" value={draft.bank} min={1} max={8} onChange={(bank) => change({ ...draft, bank })} />
      <NumberField label="Flow speed" value={draft.speed} min={0} max={3} unit="×" onChange={(speed) => change({ ...draft, speed })} />
    </div><label className="color-field"><input aria-label="River color" type="color" value={draft.color} onChange={(event) => change({ ...draft, color: event.target.value })} /><span>Water color</span><code>{draft.color.toUpperCase()}</code></label></section>
    <section className="property-section"><h3>Control points<span>{draft.points.length} / 16</span></h3><p className="field-hint">Drag the numbered handles in the viewport to move X/Z. Edit water elevation here. Point order defines flow direction; elevations must descend or stay level.</p>
      {draft.points.map((point, index) => <div key={index} className="river-point-editor"><div><strong>Point {index + 1}</strong><button type="button" aria-label={`Insert after point ${index + 1}`} title="Insert midpoint" disabled={index === draft.points.length - 1 || draft.points.length >= 16} onClick={() => { const points = [...draft.points], next = points[index + 1]; points.splice(index + 1, 0, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2, (point[2] + next[2]) / 2]); change({ ...draft, points }); }}><Plus size={13} /></button><button type="button" aria-label={`Remove river point ${index + 1}`} disabled={draft.points.length <= 2} onClick={() => change({ ...draft, points: draft.points.filter((_, i) => i !== index) })}><Trash2 size={13} /></button></div><div className="construction-fields">{point.map((value, axis) => <NumberField key={axis} label={`Point ${index + 1} ${['X', 'elevation', 'Z'][axis]}`} value={value} min={axis === 1 ? -8 : -100} max={axis === 1 ? 30 : 100} onChange={(value) => { const points = draft.points.map((point) => [...point] as [number, number, number]); points[index][axis] = value; change({ ...draft, points }); }} />)}</div></div>)}
    </section>
    {error && <p className="river-error" role="alert">{error}</p>}
    <div className={`edit-actions ${state.gestureLabel ? 'has-preview' : ''}`}><div><span className="status-dot" />{error ? 'Resolve the invalid edit' : state.gestureLabel ? 'Previewing river changes' : 'All changes applied'}</div><button type="submit" className="primary-button" disabled={!state.gestureLabel || !!error}><Check size={15} />Apply river changes</button><button type="button" className="cancel-button" disabled={!state.gestureLabel} onClick={cancel}><RotateCcw size={13} />Cancel preview<span>Esc</span></button></div>
    <div className="object-actions"><button type="button" className="delete-button" disabled={!!state.gestureLabel} onClick={() => editor.execute({ type: 'remove', id: river.id }, 'Delete river')}><Trash2 size={14} />Delete river</button></div>
    <p className="scope-note">Carving is derived from your sculpted ground. Moving, hiding, or deleting this river preserves independent terrain edits. Flow is a visual preview; this version has one unbranched channel.</p>
  </form>;
}
