import { useState } from 'react';
import { Edges } from '@react-three/drei';
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
    {walls.map(wall => <group key={wall.id} position={[wall.start[0], wall.elevation, wall.start[1]]} rotation={[0, -Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0]), 0]}>
      {wall.openings?.map(opening => {
        const selected = focus?.wallId === wall.id && focus.openingId === opening.id;
        const key = `${wall.id}/${opening.id}`, highlighted = selected || hovered === key;
        return <mesh key={opening.id} userData={{copyEntityId:wall.id,copyOpeningId:opening.id}} position={[opening.offset + opening.width / 2, topView ? wall.height + 0.12 : opening.sill + opening.height / 2, 0]}
          onPointerOver={event => { event.stopPropagation(); setHovered(key); }} onPointerOut={() => setHovered(null)}
          onClick={event => { event.stopPropagation(); if (event.button === 0 && event.delta <= 4) onPick({ wallId: wall.id, openingId: opening.id }, false); }}
          onDoubleClick={event => { event.stopPropagation(); if (event.button === 0 && event.delta <= 4) onPick({ wallId: wall.id, openingId: opening.id }, true); }}>
          <boxGeometry args={[opening.width, topView ? 0.2 : opening.height, wall.thickness + (topView ? 0.35 : 0.08)]} />
          <meshBasicMaterial color={selected ? '#d7f29c' : '#a8d9d5'} transparent opacity={selected ? 0.22 : hovered === key ? 0.12 : 0} depthWrite={false} />
          {highlighted && <Edges raycast={() => undefined} color={selected ? '#d7f29c' : '#a8d9d5'} />}
        </mesh>;
      })}
    </group>)}
  </group>;
}
