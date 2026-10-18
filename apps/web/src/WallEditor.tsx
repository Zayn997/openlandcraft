import { useEffect, useState } from 'react';
import { applyCommand, unitForPart, wallLength, type Editor, type Level, type Wall } from '@openlandcraft/core';
import './openings.css';

export function WallEditor({ wall, level, editing, editor, snapping, onSnapping, onFrame, onFinish, onSelect, status, onStatus }: {
  wall: Wall; level?: Level; editing: boolean; editor: Editor; snapping: boolean; onSnapping: (value: boolean) => void;
  onFrame: () => void; onFinish: () => void; onSelect: (id: string) => void; status: string; onStatus: (message: string) => void;
}) {
  const fields = ['startX', 'startZ', 'endX', 'endZ', 'height', 'thickness', 'elevation'] as const;
  type Field = typeof fields[number];
  const labels: Record<Field, string> = { startX: 'Start X', startZ: 'Start Z', endX: 'End X', endZ: 'End Z', height: 'Wall height', thickness: 'Wall thickness', elevation: 'Base elevation' };
  const valuesFor = (value: Wall) => ({ startX: value.start[0], startZ: value.start[1], endX: value.end[0], endZ: value.end[1], height: value.height, thickness: value.thickness, elevation: value.elevation });
  const [values, setValues] = useState<Record<Field, string>>(() => Object.fromEntries(Object.entries(valuesFor(wall)).map(([k, v]) => [k, String(v)])) as Record<Field, string>);
  useEffect(() => { setValues(Object.fromEntries(Object.entries(valuesFor(wall)).map(([k, v]) => [k, String(Number(v.toFixed(8)))])) as Record<Field, string>); }, [wall]);
  const [name, setName] = useState(wall.name), [color, setColor] = useState(wall.color), [joins, setJoins] = useState(wall.joins);
  useEffect(() => { setName(wall.name); setColor(wall.color); setJoins(wall.joins); }, [wall]);
  const dx=Number(values.endX)-Number(values.startX), dz=Number(values.endZ)-Number(values.startZ), length=Math.hypot(dx,dz);
  const setDirection=(x:number,z:number)=>setValues(old=>({...old,endX:String(Number((Number(old.startX)+x).toFixed(8))),endZ:String(Number((Number(old.startZ)+z).toFixed(8)))}));
  const state = editor.getSnapshot(), unit = unitForPart(state.project, wall.id);
  let candidate: Wall | undefined, issue = '';
  const changed = name!==wall.name || color!==wall.color || joins!==wall.joins || fields.some(key => Math.abs(Number(values[key]) - valuesFor(wall)[key]) > 1e-8 || values[key].trim() === '');
  if (editing && changed && !state.gestureLabel) try {
    const n = (key: Field) => values[key].trim() === '' ? NaN : Number(values[key]);
    candidate = { ...wall, name, color, joins, start: [n('startX'), n('startZ')], end: [n('endX'), n('endZ')], height: n('height'), thickness: n('thickness'), elevation: n('elevation') };
    applyCommand(state.project, { type: 'replace', entity: candidate });
  } catch (error) { issue = error instanceof Error ? error.message : 'Invalid wall dimensions.'; }
  return <section className="opening-tools" aria-label={editing ? 'Edit wall' : 'Selected wall'}>
    <div className="opening-tool-heading"><span>{editing ? 'EDIT ON FLOOR' : 'SELECTED ELEMENT'}</span><h2>{editing ? 'Editing wall' : 'Wall selected'}</h2></div>
    <p className="field-hint">{wall.name} · {level?.name}</p>
    <p className="opening-feedback" role="status">{editing ? status : 'Double-click this wall to edit. You can also press Enter.'}</p>
    <dl className="opening-summary"><dt>Length × height</dt><dd>{wallLength(wall).toFixed(2)} × {wall.height.toFixed(2)} m</dd><dt>Wall connections</dt><dd>{wall.joins ? 'Joined corners move together' : 'Independent wall'}</dd></dl>
    <button className="text-button" onClick={onFrame}>Frame selected wall · F</button>
    {editing ? <>
      <p className="field-hint">Drag the wall body to move it on the floor plane, or drag Start / End to reshape it. This floor is isolated and its roof hidden. Floors and roofs keep their outlines.</p>
      <label className="check-field"><input type="checkbox" checked={snapping} disabled={!!state.gestureLabel} onChange={e => onSnapping(e.target.checked)} />Snap wall edits to 0.25 m</label>
      <form onSubmit={event => { event.preventDefault(); if (candidate && !issue && changed) try { editor.execute({ type: 'replace', entity: candidate }, 'Edit wall dimensions'); onStatus('Wall dimensions applied.'); } catch (error) { onStatus(error instanceof Error ? error.message : 'Invalid wall edit.'); } }}>
        <fieldset className="opening-edit-fields" disabled={!!state.gestureLabel}>
        <label className="name-field">Name<input aria-label="Wall name" value={name} maxLength={80} required onChange={e => setName(e.target.value)} /></label>
        <label className="check-field"><input type="checkbox" checked={!!joins} onChange={e => setJoins(e.target.checked)} />Join wall chain</label>
        <p className="field-hint">Joining and profile changes apply to the connected wall chain.</p><div className="construction-fields">{fields.map(key => <label key={key} className="number-field"><span>{labels[key]}</span><div><input aria-label={labels[key]} type="number" step="any" required value={values[key]} onChange={e => setValues(old => ({ ...old, [key]: e.target.value }))} /><small>m</small></div></label>)}</div>
        <label className="number-field"><span>Wall length</span><div><input aria-label="Wall length" type="number" min="0.2" max="200" step="any" value={Number.isFinite(length)?Number(length.toFixed(8)):''} onChange={e=>{const value=Number(e.target.value);if(length>0&&Number.isFinite(value))setDirection(dx*value/length,dz*value/length);}}/><small>m</small></div></label>
        <div className="part-buttons"><button type="button" onClick={()=>setDirection((Math.sign(dx)||Math.sign(dz)||1)*length,0)}>Align X</button><button type="button" onClick={()=>setDirection(0,(Math.sign(dz)||Math.sign(dx)||1)*length)}>Align Z</button></div>
        <label className="color-field"><input aria-label="Wall color" type="color" value={color} onChange={e => setColor(e.target.value)} /><span>Wall color</span></label>
        {issue && <p role="alert" className="field-hint">{issue}</p>}
        <button className="primary-button" type="submit" disabled={!changed || !!issue}>Apply wall dimensions</button></fieldset>
      </form>
      <p className="field-hint">Openings keep their offsets from the wall start. Changes that clip openings or create unsupported corners are rejected. Each drag is one undo step.</p>
      <button className="text-button" disabled={!!state.gestureLabel} onClick={() => { try { editor.execute({ type: 'remove', id: wall.id }, 'Delete wall'); onFinish(); } catch (error) { onStatus(error instanceof Error ? error.message : 'Cannot delete wall.'); } }}>Delete wall and its openings</button>
      <button className="primary-button" onClick={onFinish}>Finish editing <span>Esc</span></button>
    </> : <p className="field-hint">Single clicks only select. Double-click shows the editing handles.</p>}
    {level && <button className="text-button" onClick={() => onSelect(level.id)}>Select whole floor · {level.name}</button>}
    {unit && <button className="text-button" onClick={() => onSelect(unit.id)}>Select whole unit · {unit.name}</button>}
  </section>;
}
