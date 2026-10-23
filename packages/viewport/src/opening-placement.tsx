import {OpeningJoineryMeshes} from './opening-joinery';
import { useEffect, useMemo, useState } from 'react';
import { openingAtPoint, openingCenter, type Level, type Wall, type OpeningSettings, type WallHit, type Project } from '@openlandcraft/core';
import { DoubleSide } from 'three';
import { OpeningVolume } from './opening-volume';
import { buildWallGeometry } from './architecture-geometry';
import { ArchitectureLabel } from './architecture-label';

export type OpeningPlacementProps = {
  level: Level; project:Project; walls: Wall[]; settings: OpeningSettings;
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
    <meshBasicMaterial colorWrite={false} depthWrite={false} side={DoubleSide} />
  </mesh>;
}

export function OpeningPlacement({ level, project, walls: incomingWalls, settings, onStatus, onPlace }: OpeningPlacementProps) {
  const wallsKey = JSON.stringify(incomingWalls);
  const walls = useMemo(() => incomingWalls, [wallsKey]);
  const [hit, setHit] = useState<{ wallId: string; point: WallHit } | null>(null);
  const wall = walls.find(w => w.id === hit?.wallId);
  const result = wall && hit ? openingAtPoint(wall, level, hit.point, settings, '__opening_preview__',walls) : null;
  const opening = result?.opening;
  const message = result?.issue ?? (opening ? `${wall!.name} · ${opening.offset.toFixed(2)} m from start · Click to place ${settings.kind}` : `Point at a wall to place a ${settings.kind}.`);
  useEffect(() => onStatus(message), [message, onStatus]);
  return <group position={level.position} rotation={[0, level.rotation * Math.PI / 180, 0]} userData={{ waterCaptureExclude: true }}>
    {walls.map(w => <WallTarget key={w.id} wall={w} walls={walls}
      hover={point => setHit({ wallId: w.id, point })}
      leave={() => setHit(old => old?.wallId === w.id ? null : old)}
      place={point => { setHit(onPlace(w.id, point) ? null : { wallId: w.id, point }); }} />)}
    {wall && opening && <group>
      {!result?.issue&&<OpeningJoineryMeshes wall={{...wall,openings:[opening]}} project={project}/>}
      <OpeningVolume wall={wall} opening={opening} raycast={noRaycast} renderOrder={15} color={result?.issue?'#ed775f':'#a8dd87'} opacity={.55}/>
      <ArchitectureLabel position={[openingCenter(wall,opening)[0],wall.elevation+wall.height+.3,openingCenter(wall,opening)[1]]} text={`${result?.issue ? 'Cannot place' : settings.kind} · ${opening.width.toFixed(2)} × ${opening.height.toFixed(2)} m`} />
    </group>}
  </group>;
}
