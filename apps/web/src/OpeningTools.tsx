import type { Level, OpeningSettings } from '@openlandcraft/core';
import './openings.css';

export type OpeningDimensions = { width: string; height: string; sill: string };
export function OpeningTools({ kind, dimensions, onDimensions, snapping, onSnapping, levels, levelId, onLevel, onKind, onFinish, status }: {
  kind: OpeningSettings['kind']; dimensions: OpeningDimensions; onDimensions: (value: OpeningDimensions) => void;
  snapping: boolean; onSnapping: (value: boolean) => void; levels: Level[]; levelId?: string;
  onLevel: (id: string) => void; onKind: (kind: OpeningSettings['kind']) => void; onFinish: () => void; status: string;
}) {
  return <section className="opening-tools" aria-label="Opening placement">
    <div className="opening-tool-heading"><span>PLACE ON WALL</span><h2>{kind === 'door' ? 'Door' : 'Window'} placement</h2></div>
    <div className="part-buttons">{(['door', 'window'] as const).map(value => <button key={value} aria-pressed={value === kind} onClick={() => onKind(value)}>{value === 'door' ? 'Door' : 'Window'}</button>)}</div>
    <label className="name-field">Active floor<select aria-label="Placement floor" value={levelId ?? ''} onChange={event => onLevel(event.target.value)}>
      {!levels.length && <option value="">Add a building first</option>}
      {levels.map(level => <option key={level.id} value={level.id}>{level.name} · {level.position[1].toFixed(2)} m</option>)}
    </select></label>
    <p className="field-hint">Only this floor is shown; its roof is hidden while placing openings.</p>
    <div className="construction-fields">{(['width', 'height', ...(kind === 'window' ? ['sill'] as const : [])] as const).map(key => {
      const value = Number(dimensions[key]), min = key === 'sill' ? 0 : 0.3;
      const invalid = dimensions[key].trim() === '' || !Number.isFinite(value) || value < min || value > 20;
      return <label className={`number-field ${invalid ? 'invalid' : ''}`} key={key}><span>{key === 'sill' ? 'Sill height' : key === 'width' ? 'Width' : 'Height'}</span><div><input aria-label={`Placement ${key}`} aria-invalid={invalid} type="number" min={min} max={20} step={0.1} value={dimensions[key]} onChange={event => onDimensions({ ...dimensions, [key]: event.target.value })} /><small>m</small></div>{invalid && <em>{min}–20 m required</em>}</label>;
    })}</div>
    <label className="check-field"><input type="checkbox" checked={snapping} onChange={event => onSnapping(event.target.checked)} />Snap offset to 0.1 m</label>
    <p className="opening-feedback" role="status">{levels.length ? status : 'Add a building or a floor with walls to begin.'}</p>
    <p className="field-hint">Hover to preview, click to place, then click another position to repeat. Drag to orbit or pan. Each placement is one undo step.</p>
    <button className="primary-button" onClick={onFinish}>Finish placing <span>Esc</span></button>
    <p className="field-hint">After finishing placement, click a door or window to select it. Double-click it to move and resize it.</p>
  </section>;
}
