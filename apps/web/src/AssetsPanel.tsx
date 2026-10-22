import { useState } from 'react';
import { Bird, Fish, Footprints, Leaf, LoaderCircle, Search, X } from 'lucide-react';
import { Button, Card, CheckboxInput, Field, Panel, Row, SelectInput, SelectOption, TextInput } from './ui';
import { PLANTS } from './plant-library';
import { BIRDS } from './bird-library';
import { FISH } from './fish-library';
import { CHARACTERS } from './character-library';
import type { LibraryAsset } from './use-plant-placement';
import { PlantBrushControls, type PlantBrushControlsProps } from './PlantBrushControls';

export function AssetsPanel({ chosen, loading, grow, onGrow, wind, onWind, onChoose, onCancel, ...controls }: {
  chosen: LibraryAsset | null; loading: boolean; grow: boolean;
  wind: boolean; onWind: (value: boolean) => void;
  onGrow: (value: boolean) => void; onChoose: (plant: LibraryAsset) => void; onCancel: () => void;
} & PlantBrushControlsProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All assets');
  const birds = category === 'Birds' || chosen?.category === 'Birds';
  const fish = category === 'Fish' || chosen?.category === 'Fish';
  const people = category === 'People' || chosen?.category === 'People';
  const ground = ['Animals','People'].includes(category) || ['Animals','People'].includes(chosen?.category ?? '');
  const animals = birds || fish || ground;
  const matches = [...PLANTS, ...BIRDS, ...FISH, ...CHARACTERS].filter(plant => (category === 'All assets' || plant.category === category) && `${plant.name} ${plant.category}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <Panel aria-label="Scene assets" className="flex flex-1 flex-col overflow-hidden">
    <Row className="organizer-search mb-3"><Search size={14} /><TextInput appearance="plain" aria-label="Search assets" placeholder="Search assets…" value={query} onChange={event => setQuery(event.target.value)} />
      <SelectInput appearance="plain" aria-label="Asset category" value={category} onValueChange={value => { setCategory(value); onCancel(); }}>
        {['All assets', 'Trees', 'Ground cover', 'Flowers', 'Birds', 'Fish', 'Animals', 'People'].map(name => <SelectOption key={name} value={name}>{name==='All assets'?'All':name}</SelectOption>)}
      </SelectInput>
    </Row>
    <div className="organizer-scroll px-3 pb-3">
      {!animals && <PlantBrushControls {...controls} />}
      <div className="grid grid-cols-2 gap-2">
        {matches.map(plant => <Card key={plant.id} size="compact" className={chosen?.id === plant.id ? 'border-accent bg-selected p-0' : 'p-0'}>
          <Button variant="ghost" aria-label={`Place ${plant.name}`} aria-pressed={chosen?.id === plant.id}
            className="w-full min-w-0 flex-col gap-0 whitespace-normal p-2 text-ink" onClick={() => onChoose(plant)}>
            <img src={plant.thumbnail} alt="" width={128} height={128} loading="lazy" draggable={false} className="h-16 phone:h-10 w-full object-contain" />
            <span className="text-ui">{plant.name}</span><span className="mt-1 text-label text-muted phone:hidden">{'length' in plant ? `${plant.length} m long` : 'wingspan' in plant ? `${plant.wingspan} m wingspan` : `${plant.height} m`}</span>
          </Button>
        </Card>)}
      </div>
      {!matches.length && <p className="text-ui text-muted">No assets match your search.</p>}
    </div>
    <div className="shrink-0 border-0 border-t border-solid border-line px-3 py-2 text-ui">
      {chosen ? <Row justify="between" className="mb-2" gap="xs">
        <span role="status" className="min-w-0 text-accent">{loading ? <><LoaderCircle size={13} className="mr-1 inline-block animate-spin motion-reduce:animate-none" />Loading {chosen.name}…</> : <>{chosen.category === 'Fish' ? <Fish size={13} className="mr-1 inline-block" /> : chosen.category === 'Birds' ? <Bird size={13} className="mr-1 inline-block" /> : ground ? <Footprints size={13} className="mr-1 inline-block" /> : <Leaf size={13} className="mr-1 inline-block" />}{chosen.category === 'Fish' ? 'Click open water to set the swim center' : chosen.category === 'Birds' ? 'Click ground to set the flight center' : ground ? `Click dry ground to place ${chosen.name}` : controls.mode === 'paint' ? `Drag to paint ${chosen.name}` : `Click ground to plant ${chosen.name}`}</>}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Cancel asset placement" title="Cancel (Escape)" onClick={onCancel}><X size={14} /></Button>
      </Row> : <p className="mt-0 mb-2 text-muted">{fish ? 'Choose a fish, then click deeper, open water.' : birds ? 'Choose a bird, then click its flight center.' : ground ? 'Choose a horse or person, then click dry, open ground.' : `Choose an asset, then ${controls.mode === 'paint' ? 'drag to paint plants' : 'click the ground'}.`}</p>}
      {animals ? <p className="m-0 text-muted text-label">{fish ? 'Nearby fish form schools of up to 8. Leave open water for turns and spacing.' : people ? 'Select a person and draw their walking route in Properties. Choose Automatic, Walk or Idle.' : ground ? 'Walks where there is clear space; idles in tighter areas. Pause freezes movement.' : 'Birds circle above the scene. Pause freezes wings and flight.'}</p> : <Row justify="between" wrap>
        <Field variant="checkbox" className="min-h-7"><CheckboxInput checked={grow} onChange={event => onGrow(event.target.checked)} />Grow on placement</Field>
        <Field variant="checkbox" className="min-h-7 !mt-0"><CheckboxInput checked={wind} onChange={event => onWind(event.target.checked)} />Wind sway</Field>
      </Row>}
    </div>
  </Panel>;
}
