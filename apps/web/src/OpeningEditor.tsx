import { useEffect, useState } from 'react';
import { editOpening, type Editor, type Level, type Opening, type Wall } from '@openlandcraft/core';
import './openings.css';

export function OpeningEditor({ wall, opening, editor, levels, levelId, onLevel, onSelect, snapping, onSnapping, onFinish, onFrame, status, onStatus }: {
  wall?: Wall; opening?: Opening; editor: Editor; levels: Level[]; levelId?: string;
  onLevel: (id: string) => void; onSelect: (wallId: string, openingId: string) => void;
  snapping: boolean; onSnapping: (value: boolean) => void; onFinish: () => void; onFrame: () => void; status: string; onStatus: (text: string) => void;
}) {
  const fields = ['offset', 'width', 'height', 'sill'] as const;
  const [values, setValues] = useState({ offset: '', width: '', height: '', sill: '' });
  useEffect(() => { if (opening) setValues({ offset: String(Number(opening.offset.toFixed(8))), width: String(Number(opening.width.toFixed(8))), height: String(Number(opening.height.toFixed(8))), sill: String(Number(opening.sill.toFixed(8))) }); }, [opening]);
  const state = editor.getSnapshot();
  let candidate: Wall | undefined, issue = '';
  if (wall && opening) try {
    candidate = editOpening(wall, opening.id, Object.fromEntries(fields.map(key => [key, values[key].trim() === '' ? NaN : Number(values[key])])));
  } catch (error) { issue = error instanceof Error ? error.message : 'Invalid opening.'; }
  const changed = candidate && opening && fields.some(key => Math.abs(Number(values[key]) - opening[key]) > 1e-8);
  const commit = (operation: () => void) => { try { operation(); } catch (error) { onStatus(error instanceof Error ? error.message : 'The edit could not be applied.'); } };
  return <section className="opening-tools" aria-label="Edit openings">
    <div className="opening-tool-heading"><span>EDIT ON WALL</span><h2>{opening ? `Editing ${opening.kind}` : 'Select an opening'}</h2></div>
    <label className="name-field">Active floor<select aria-label="Opening edit floor" value={levelId ?? ''} onChange={e => onLevel(e.target.value)}>
      {!levels.length && <option value="">Add a building first</option>}
      {levels.map(level => <option key={level.id} value={level.id}>{level.name} · {level.position[1].toFixed(2)} m</option>)}
    </select></label>
    <p className="field-hint">This floor is isolated and its roof hidden. Drag this opening along its wall. Clicking another opening selects it; double-click to edit.</p>
    {wall && opening && <>
      <button className="text-button" onClick={onFrame}>Frame selected opening · F</button>
      <label className="name-field">{wall.name}<select aria-label="Selected hosted opening" value={opening.id} disabled={!!state.gestureLabel} onChange={e => onSelect(wall.id, e.target.value)}>
        {wall.openings?.map((o, i) => <option key={o.id} value={o.id}>{o.kind === 'door' ? 'Door' : 'Window'} {i + 1} · {o.offset.toFixed(2)} m</option>)}
      </select></label>
      <form onSubmit={event => { event.preventDefault(); if (candidate && !issue && changed) commit(() => { editor.execute({ type: 'replace', entity: candidate! }, 'Edit opening'); onStatus('Opening updated.'); }); }}>
        <fieldset disabled={!!state.gestureLabel} className="opening-edit-fields">
          <div className="construction-fields">{fields.filter(key => key !== 'sill' || opening.kind === 'window').map(key => <label key={key} className="number-field"><span>{key === 'sill' ? 'Sill height' : key === 'offset' ? 'Wall offset' : key === 'width' ? 'Width' : 'Height'}</span><div>
            <input aria-label={`Opening ${key}`} type="number" step="any" min={key === 'width' || key === 'height' ? 0.3 : 0} max={key === 'offset' ? 200 : 20} required value={values[key]} onChange={e => setValues(old => ({ ...old, [key]: e.target.value }))} /><small>m</small>
          </div></label>)}</div>
          {issue && <p role="alert" className="field-hint">{issue}</p>}
          <button className="primary-button" type="submit" disabled={!changed || !!issue}>Apply opening dimensions</button>
          <button className="text-button" type="button" onClick={() => commit(() => { editor.execute({ type: 'replace', entity: { ...wall, openings: wall.openings!.filter(o => o.id !== opening.id) } }, 'Remove opening'); onStatus('Opening removed. Undo restores it.'); })}>Remove selected opening</button>
        </fieldset>
      </form>
    </>}
    <label className="check-field"><input type="checkbox" checked={snapping} disabled={!!state.gestureLabel} onChange={e => onSnapping(e.target.checked)} />Snap edits to 0.1 m</label>
    <p className="opening-feedback" role="status">{status}</p>
    <p className="field-hint">Square side handles resize width. The upper handle changes height in 3D; use the height field in plan view. A completed drag is one undo step. Esc cancels and exits.</p>
    <button className="primary-button" onClick={onFinish}>Finish editing <span>Esc</span></button>
  </section>;
}
