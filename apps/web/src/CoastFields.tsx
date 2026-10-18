import type { Ocean } from '@openlandcraft/core';
import { NumberField } from './NumberField';

export function CoastFields({ ocean, onChange, playing, editing, onReset, onStep }: { ocean: Ocean; onChange: (change: Partial<Ocean>) => void; playing: boolean; editing: boolean; onReset: () => void; onStep: () => void }) {
  return <section className="property-section coast-settings"><h3>Shore and beach</h3><div className="coast-fields">
    <NumberField label="Breaker strength" value={ocean.breaker} min={0} max={2} unit="×" onChange={(breaker) => onChange({ breaker })} />
    <NumberField label="Shore foam" value={ocean.foam} min={0} max={1} unit="×" onChange={(foam) => onChange({ foam })} />
    <NumberField label="Foam persistence" value={ocean.foamPersistence} min={1} max={20} unit="s" onChange={(foamPersistence) => onChange({ foamPersistence })} />
    <NumberField label="Run-up" value={ocean.swash} min={0} max={2} unit="×" onChange={(swash) => onChange({ swash })} />
    <NumberField label="Wet sand" value={ocean.wetSand} min={0} max={1} unit="×" onChange={(wetSand) => onChange({ wetSand })} />
    <NumberField label="Drying time" value={ocean.dryingTime} min={5} max={90} unit="s" onChange={(dryingTime) => onChange({ dryingTime })} />
  </div><p className="field-hint">Waves slow and turn over shallow ground. Foam drifts and fades; wet sand remains after retreat and dries. Wave shape, run-up, and terrain edits restart the preview. Timing and appearance controls retain it.</p>
    <div className="coast-preview"><button type="button" disabled={editing} onClick={onReset}>Reset shore preview</button><button type="button" disabled={editing || playing || ocean.speed === 0} onClick={onStep}>Step shore 0.5 s</button></div><p className="field-hint">Pause water to step through shore motion at the chosen speed. Zero speed holds the shore preview. Time and foam/wetness history are rebuilt on reopening.</p>
  </section>;
}
