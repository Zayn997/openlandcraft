import {OpeningJoineryFields,type JoineryDraft} from './OpeningJoineryFields';
import {InspectorSection} from './InspectorSection';
import type {Project} from '@openlandcraft/core';
import { Button, PanelHeading, CheckboxInput, Field, FieldControl, FieldGrid, FieldMessage, NumericInput, Panel, Row, SelectInput, SelectOption } from './ui';
import type { Level, OpeningSettings } from '@openlandcraft/core';

export type OpeningDimensions = { width: string; height: string; sill: string;shape:'rectangle'|'arch';archRise:string;joinery:JoineryDraft };
export function OpeningTools({ project,kind, dimensions, onDimensions, snapping, onSnapping, levels, levelId, onLevel, onKind, onFinish, status }: {
  project:Project;kind: OpeningSettings['kind']; dimensions: OpeningDimensions; onDimensions: (value: OpeningDimensions) => void;
  snapping: boolean; onSnapping: (value: boolean) => void; levels: Level[]; levelId?: string;
  onLevel: (id: string) => void; onKind: (kind: OpeningSettings['kind']) => void; onFinish: () => void; status: string;
}) {
  return <Panel padding="body" className="opening-tools" aria-label="Opening placement">
    <PanelHeading title={<>{kind === 'door' ? 'Door' : 'Window'} placement</>} subtitle={<>PLACE ON WALL</>} />
    <Row className="part-buttons">{(['door', 'window'] as const).map(value => <button key={value} aria-pressed={value === kind} onClick={() => onKind(value)}>{value === 'door' ? 'Door' : 'Window'}</button>)}</Row>
    <Field>Active floor<SelectInput aria-label="Placement floor" value={levelId ?? ''} disabled={!levels.length} placeholder="Add a building first" onValueChange={(value) => onLevel(value)}>
      {levels.map(level => <SelectOption key={level.id} value={level.id}>{level.name} · {level.position[1].toFixed(2)} m</SelectOption>)}
    </SelectInput></Field>
    <FieldMessage>Only this floor is shown; its roof is hidden while placing openings.</FieldMessage>
    <Field>Opening shape<SelectInput aria-label="Placement opening shape" value={dimensions.shape} onValueChange={value=>onDimensions({...dimensions,shape:value as OpeningDimensions['shape']})}><SelectOption value="rectangle">Rectangular</SelectOption><SelectOption value="arch">Round arch</SelectOption></SelectInput></Field>
    <FieldGrid columns={2}>{(['width', 'height', ...(kind === 'window' ? ['sill'] as const : [])] as const).map(key => {
      const value = Number(dimensions[key]), min = key === 'sill' ? 0 : 0.3;
      const invalid = dimensions[key].trim() === '' || !Number.isFinite(value) || value < min || value > 20;
      return <Field variant="number" invalid={invalid} key={key}><span>{key === 'sill' ? 'Sill height' : key === 'width' ? 'Width' : 'Height'}</span><FieldControl><NumericInput aria-label={`Placement ${key}`} aria-invalid={invalid} min={min} max={20} step={0.1} value={dimensions[key]} onChange={event => onDimensions({ ...dimensions, [key]: event.target.value })} /><small>m</small></FieldControl>{invalid && <em>{min}–20 m required</em>}</Field>;
    })}</FieldGrid>
    {dimensions.shape==='arch'&&<Field variant="number"><span>Arch rise</span><FieldControl><NumericInput aria-label="Placement arch rise" min={.1} max={Math.max(.1,Number(dimensions.height)-.1)} step={.1} value={dimensions.archRise} onChange={e=>onDimensions({...dimensions,archRise:e.target.value})}/><small>m</small></FieldControl></Field>}
    <FieldMessage>Width and offset follow the wall centerline. Height includes the arch. On curved walls, radius edits keep the angular center and width; edits that no longer fit are rejected.</FieldMessage>
    <InspectorSection sectionId="placement-joinery" title="Frame & infill" defaultOpen={false}><OpeningJoineryFields kind={kind} value={dimensions.joinery} project={project} onChange={joinery=>onDimensions({...dimensions,joinery})}/></InspectorSection>
    <Field variant="checkbox"><CheckboxInput checked={snapping} onChange={event => onSnapping(event.target.checked)} />Snap offset to 0.1 m</Field>
    <p className="opening-feedback" role="status">{levels.length ? status : 'Add a building or a floor with walls to begin.'}</p>
    <FieldMessage>{dimensions.joinery.frame?'Frame enabled. ':''}{dimensions.joinery.infill?(kind==='door'?'Closed door panel enabled.':'Glass enabled.'):'Transparent / open.'} Adjust Frame & infill above.</FieldMessage>
    <FieldMessage>Hover to preview, click to place, then click another position to repeat. Drag to orbit or pan. Each placement is one undo step.</FieldMessage>
    <Button variant="default" className="primary-button" onClick={onFinish}>Finish placing <span>Esc</span></Button>
    <FieldMessage>After finishing placement, click a door or window to select it. Double-click it to move and resize it.</FieldMessage>
  </Panel>;
}
