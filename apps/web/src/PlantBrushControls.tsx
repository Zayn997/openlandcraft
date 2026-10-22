import type { PlantBrushSettings } from '@openlandcraft/core';
import { Field, FieldGrid, FieldMessage, NumberField, SelectInput, SelectOption } from './ui';

export type PlantBrushControlsProps = {
  mode: 'place' | 'paint'; onMode: (mode: 'place' | 'paint') => void;
  brush: PlantBrushSettings; onBrush: (settings: PlantBrushSettings) => void;
};

export function PlantBrushControls({ mode, onMode, brush, onBrush }: PlantBrushControlsProps) {
  return <div className="mb-3">
    <Field label="Placement"><SelectInput aria-label="Plant placement mode" value={mode} onValueChange={value => onMode(value as 'place' | 'paint')}>
      <SelectOption value="place">Single plant</SelectOption><SelectOption value="paint">Scatter brush</SelectOption>
    </SelectInput></Field>
    {mode === 'paint' && <>
      <FieldGrid columns={2} className="mt-3">
        <NumberField label="Brush radius" value={brush.radius} min={1} max={20} onChange={radius => onBrush({ ...brush, radius })} />
        <NumberField label="Density / 100 m²" unit="" value={brush.density} min={1} max={100} onChange={density => onBrush({ ...brush, density })} />
        <NumberField label="Minimum size" unit="×" value={brush.scaleMin} min={0.1} max={3} onChange={scaleMin => onBrush({ ...brush, scaleMin, scaleMax: Math.max(scaleMin, brush.scaleMax) })} />
        <NumberField label="Maximum size" unit="×" value={brush.scaleMax} min={0.1} max={3} onChange={scaleMax => onBrush({ ...brush, scaleMax, scaleMin: Math.min(scaleMax, brush.scaleMin) })} />
      </FieldGrid>
      <FieldMessage>Drag to paint. Avoids water, paths and buildings. Each stroke is one undo step.</FieldMessage>
    </>}
  </div>;
}
