import type { Level, Opening, Wall } from '@openlandcraft/core';
import './openings.css';

export function OpeningSelectionSummary({ wall, opening, level, onFrame }: { wall: Wall; opening: Opening; level?: Level; onFrame: () => void }) {
  return <section className="opening-tools" aria-label="Selected opening">
    <div className="opening-tool-heading"><span>SELECTED ELEMENT</span><h2>{opening.kind === 'door' ? 'Door' : 'Window'} selected</h2></div>
    <p className="opening-feedback" role="status">Double-click this opening to edit. You can also press Enter.</p>
    <p className="field-hint">{wall.name} · {level?.name}</p>
    <dl className="opening-summary">
      <dt>Width × height</dt><dd>{opening.width.toFixed(2)} × {opening.height.toFixed(2)} m</dd>
      <dt>Wall offset</dt><dd>{opening.offset.toFixed(2)} m</dd>
      {opening.kind === 'window' && <><dt>Sill height</dt><dd>{opening.sill.toFixed(2)} m</dd></>}
    </dl>
    <button className="text-button" onClick={onFrame}>Frame selected opening · F</button>
    <p className="field-hint">Selection does not change the model. Click elsewhere to select another element, or press Esc to clear this selection.</p>
  </section>;
}
