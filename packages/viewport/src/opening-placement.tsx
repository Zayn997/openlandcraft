import { useEffect, useMemo, useState } from 'react';
import { Edges } from '@react-three/drei';
import { openingAtPoint, wallLength, type Level, type Wall, type OpeningSettings, type WallHit } from '@openlandcraft/core';
import { buildWallGeometry } from './architecture-geometry';
import { ArchitectureLabel } from './architecture-label';

export type OpeningPlacementProps = {
  level: Level; walls: Wall[]; settings: OpeningSettings;
  onStatus: (message: string) => void;
  onPlace: (wallId: string, point: WallHit) => boolean;
};
const noRaycast = () => undefined;

function WallTarget({ wall, walls, hover, leave, place }: {
  wall: Wall; walls: Wall[]; hover: (point: WallHit) => void; leave: () => void; place: (point: WallHit) => void;
}) {
  // A solid picking surface also catches clicks inside existing holes, so overlap
  // is rejected on this wall instead of accidentally inserting into the far wall.
  const geometry = useMemo(() => buildWallGeometry({ ...wall, openings: [] }, walls), [wall, walls]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}
    onPointerMove={event => { event.stopPropagation(); if (event.buttons) leave(); else hover(event.point.toArray() as WallHit); }}
    onPointerOut={leave}
    onClick={event => { event.stopPropagation(); if (event.button === 0 && event.delta <= 4) place(event.point.toArray() as WallHit); }}>
    <meshBasicMaterial colorWrite={false} depthWrite={false} />
  </mesh>;
}

export function OpeningPlacement({ level, walls: incomingWalls, settings, onStatus, onPlace }: OpeningPlacementProps) {
  const wallsKey = JSON.stringify(incomingWalls);
  const walls = useMemo(() => incomingWalls, [wallsKey]);
  const [hit, setHit] = useState<{ wallId: string; point: WallHit } | null>(null);
  const wall = walls.find(w => w.id === hit?.wallId);
  const result = wall && hit ? openingAtPoint(wall, level, hit.point, settings, '__opening_preview__') : null;
  const opening = result?.opening;
  const message = result?.issue ?? (opening ? `${wall!.name} · ${opening.offset.toFixed(2)} m from start · Click to place ${settings.kind}` : `Point at a wall to place a ${settings.kind}.`);
  useEffect(() => onStatus(message), [message, onStatus]);
  return <group position={level.position} rotation={[0, level.rotation * Math.PI / 180, 0]} userData={{ waterCaptureExclude: true }}>
    {walls.map(w => <WallTarget key={w.id} wall={w} walls={walls}
      hover={point => setHit({ wallId: w.id, point })}
      leave={() => setHit(old => old?.wallId === w.id ? null : old)}
      place={point => { setHit(onPlace(w.id, point) ? null : { wallId: w.id, point }); }} />)}
    {wall && opening && <group position={[wall.start[0], wall.elevation, wall.start[1]]} rotation={[0, -Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0]), 0]}>
      <mesh position={[opening.offset + opening.width / 2, opening.sill + opening.height / 2, 0]} raycast={noRaycast} renderOrder={15}>
        <boxGeometry args={[opening.width, opening.height, wall.thickness + 0.08]} />
        <meshBasicMaterial color={result?.issue ? '#ed775f' : '#a8dd87'} transparent opacity={0.55} depthWrite={false} />
        <Edges raycast={noRaycast} color={result?.issue ? '#ff755b' : '#d6ffaf'} />
      </mesh>
      <ArchitectureLabel position={[Math.max(0, Math.min(wallLength(wall), opening.offset + opening.width / 2)), wall.height + 0.3, 0]} text={`${result?.issue ? 'Cannot place' : settings.kind} · ${opening.width.toFixed(2)} × ${opening.height.toFixed(2)} m`} />
    </group>}
  </group>;
}
