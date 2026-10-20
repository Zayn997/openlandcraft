import type { Level } from '@openlandcraft/core';
import { Button, CheckboxInput, Field, FieldMessage, NumberField, Panel, PanelHeading, Row, SelectInput, SelectOption } from './ui';

export type ArchitectureTool = 'wall' | 'floor' | 'roof';
export function ArchitectureTools({ kind, levels, level, count, offset, thickness, snapping, onLevel, onNewLevel, onOffset, onThickness, onSnapping, onFinish, onBack, onCancel, onExit }: {
  kind: ArchitectureTool; levels: Level[]; level?: Level; count: number; offset: number; thickness: number; snapping: boolean;
  onLevel: (id: string) => void; onNewLevel: () => void; onOffset: (n: number) => void; onThickness: (n: number) => void;
  onSnapping: (value: boolean) => void; onFinish: (closed: boolean) => void; onBack: () => void; onCancel: () => void; onExit: () => void;
}) {
  const label = kind === 'wall' ? 'Wall' : kind === 'floor' ? 'Floor' : 'Roof';
  return <Panel padding="body" aria-label="Architecture drawing">
    <PanelHeading title={`Draw ${label.toLowerCase()}`} subtitle="CHOOSE LEVEL · DRAW · FINISH" />
    <Field>Drawing level<SelectInput aria-label="Drawing level" value={level?.id ?? ''} placeholder="Choose a level" disabled={count > 0 || !levels.length} onValueChange={onLevel}>
      {levels.map(item => <SelectOption key={item.id} value={item.id}>{item.name} · {item.position[1].toFixed(2)} m</SelectOption>)}
    </SelectInput></Field>
    <Button variant="outline" disabled={count > 0} onClick={onNewLevel}>Add blank level</Button>
    {count > 0 && <FieldMessage>Finish or cancel this drawing before changing level.</FieldMessage>}
    {level && <FieldMessage>{level.name} · elevation {level.position[1].toFixed(2)} m. Drawing stays on this level; other levels are temporarily hidden.</FieldMessage>}
    {kind === 'wall' && <>
      <NumberField label="Wall thickness" value={thickness} min={0.05} max={2} unit="m" onChange={onThickness} />
      <FieldMessage>Draw to a wall endpoint for a corner, or to its middle for an interior connection. Joined walls keep their own thickness. Height and base follow the connected walls.</FieldMessage>
    </>}
    {kind !== 'wall' && <>
      <NumberField label="Base offset" value={offset} min={-10} max={kind === 'roof' ? 40 : 30} unit="m" onChange={onOffset} />
      <NumberField label="Thickness" value={thickness} min={kind === 'roof' ? 0.1 : 0.05} max={kind === 'roof' ? 15 : 2} unit="m" onChange={onThickness} />
      <FieldMessage>{kind === 'roof' ? 'Draw a flat roof outline. Base offset is its underside above the level; thickness extends upward.' : 'Draw a closed floor boundary. Base offset is the underside of the slab above the level.'}</FieldMessage>
    </>}
    <Field variant="checkbox"><CheckboxInput checked={snapping} onChange={event => onSnapping(event.target.checked)} />Snap to walls and 0.25 m grid</Field>
    <p role="status">{!level ? 'Choose a level above, or add a blank level to begin.' : `${count} corners · Click points in the viewport. ${kind === 'wall' ? 'Finish an open chain or close a room.' : 'Finish closes the outline.'}`}</p>
    <Row className="part-buttons">
      <Button disabled={!level || count < (kind === 'wall' ? 2 : 3)} onClick={() => onFinish(kind !== 'wall')}>Finish {label.toLowerCase()}</Button>
      {kind === 'wall' && <Button disabled={!level || count < 3} onClick={() => onFinish(true)}>Close room</Button>}
    </Row>
    <Row className="part-buttons"><Button variant="outline" disabled={!count} onClick={onBack}>Back one point</Button><Button variant="ghost" disabled={!count} onClick={onCancel}>Cancel drawing</Button></Row>
    <FieldMessage>Each finished drawing is one undo step. Escape cancels a draft; Escape again exits. Click the first corner to close an outline.</FieldMessage>
    <Button variant="outline" onClick={onExit}>Exit {label.toLowerCase()} tool</Button>
  </Panel>;
}
