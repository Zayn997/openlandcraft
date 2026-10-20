import { Button, PanelHeading, FieldMessage, Panel } from './ui';
import type { Level, Opening, Wall } from '@openlandcraft/core';

export function OpeningSelectionSummary({ wall, opening, level, onFrame }: { wall: Wall; opening: Opening; level?: Level; onFrame: () => void }) {
  return <Panel padding="body" className="opening-tools" aria-label="Selected opening">
    <PanelHeading title={<>{opening.kind === 'door' ? 'Door' : 'Window'} selected</>} subtitle={<>SELECTED ELEMENT</>} />
    <p className="opening-feedback" role="status">Double-click this opening to edit. You can also press Enter.</p>
    <FieldMessage>{wall.name} · {level?.name}</FieldMessage>
    <dl className="opening-summary">
      <dt>Width × height</dt><dd>{opening.width.toFixed(2)} × {opening.height.toFixed(2)} m</dd>
      <dt>Wall offset</dt><dd>{opening.offset.toFixed(2)} m</dd>
      {opening.kind === 'window' && <><dt>Sill height</dt><dd>{opening.sill.toFixed(2)} m</dd></>}
    </dl>
    <Button variant="ghost" className="text-button" onClick={onFrame}>Frame selected opening · F</Button>
    <FieldMessage>Selection does not change the model. Click elsewhere to select another element, or press Esc to clear this selection.</FieldMessage>
  </Panel>;
}
