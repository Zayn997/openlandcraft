import { useState } from 'react';
import { OpeningVolume } from './opening-volume';
import type { Level, Wall } from '@openlandcraft/core';
import type { OpeningFocus } from './opening-edit';

export type OpeningSelectionProps = {
  focus: OpeningFocus | null;
  onPick: (focus: OpeningFocus, doubleClick: boolean) => void;
};

/** Opening hit surfaces participate in ordinary selection, including inside cuts.
 * No pointer capture or editor transaction occurs until editing is activated. */
export function OpeningSelection({ level, walls, topView, focus, onPick }: OpeningSelectionProps & { level: Level; walls: Wall[]; topView: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return <group position={level.position} rotation={[0, level.rotation * Math.PI / 180, 0]} userData={{ waterCaptureExclude: true }}>
    {walls.map(wall => <group key={wall.id}>
      {wall.openings?.map(opening => {
        const selected = focus?.wallId === wall.id && focus.openingId === opening.id;
        const key = `${wall.id}/${opening.id}`, highlighted = selected || hovered === key;
        return <OpeningVolume key={opening.id} wall={wall} opening={opening} topView={topView} color={selected?'#d7f29c':'#a8d9d5'} opacity={selected ? .22 : hovered===key ? .12 : 0} outlined={highlighted} userData={{copyEntityId:wall.id,copyOpeningId:opening.id}}
          onPointerOver={event => { event.stopPropagation(); setHovered(key); }} onPointerOut={() => setHovered(null)}
          onClick={event => { event.stopPropagation(); if (event.button === 0 && event.delta <= 4) onPick({ wallId: wall.id, openingId: opening.id }, false); }}
          onDoubleClick={event => { event.stopPropagation(); if (event.button === 0 && event.delta <= 4) onPick({ wallId: wall.id, openingId: opening.id }, true); }}/>
      })}
    </group>)}
  </group>;
}
