import { footprint, sameCorner } from './architecture';
import type { BuildingPart, Entity, Level, Project, Unit, Wall } from './model';

export const isBuildingPart = (e: Entity): e is BuildingPart => e.kind === 'wall' || e.kind === 'slab' || e.kind === 'roof';
export function ownerLevel(project: Project, id: string | null): Level | undefined {
  const entity = project.entities.find(e => e.id === id);
  return entity?.kind === 'level' ? entity : project.entities.find((e): e is Level => e.kind === 'level' && e.id === entity?.parentId);
}
export function unitForPart(project: Project, id: string): Unit | undefined {
  return project.entities.find((e): e is Unit => e.kind === 'unit' && e.memberIds.includes(id));
}
export function scopeParts(project: Project, id: string): BuildingPart[] {
  const scope = project.entities.find(e => e.id === id);
  return project.entities.filter((e): e is BuildingPart => isBuildingPart(e) && (scope?.kind === 'unit' ? scope.memberIds.includes(e.id) : e.parentId === id));
}
export function floorHeight(project: Project, level: Level): number {
  return level.storeyHeight ?? Math.round(Math.max(0.5, ...scopeParts(project, level.id).filter(p => p.kind !== 'roof').map(p => p.elevation + (p.kind === 'wall' ? p.height : p.kind === 'slab' ? p.thickness : 0))) * 1000000) / 1000000;
}
export function partBounds(part: BuildingPart, level: Level) {
  const points = part.kind === 'wall' ? [part.start, part.end] : footprint(part);
  const angle = level.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const world = points.map(([x, z]) => [level.position[0] + x * c + z * s, level.position[2] - x * s + z * c]);
  const pad = part.kind === 'wall' ? part.thickness / 2 : 0;
  return { min: [Math.min(...world.map(p => p[0])) - pad, level.position[1] + part.elevation, Math.min(...world.map(p => p[1])) - pad],
    max: [Math.max(...world.map(p => p[0])) + pad, level.position[1] + part.elevation + (part.kind === 'wall' ? part.height : part.kind === 'slab' ? part.thickness : part.rise), Math.max(...world.map(p => p[1])) + pad] };
}
export function scopeBounds(project: Project, id: string) {
  if(project.entities.some(e=>e.id===id&&e.kind==='building')){
    const boxes=project.entities.filter((e):e is Level=>e.kind==='level'&&e.buildingId===id).flatMap(l=>scopeParts(project,l.id).map(p=>partBounds(p,l)));
    if(!boxes.length)return null;
    return {min:[0,1,2].map(k=>Math.min(...boxes.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...boxes.map(b=>b.max[k])))};
  }
  const level = ownerLevel(project, id), parts = scopeParts(project, id);
  if (!level || !parts.length) return null;
  const boxes = parts.map(p => partBounds(p, level));
  return { min: [0, 1, 2].map(k => Math.min(...boxes.map(b => b.min[k]))), max: [0, 1, 2].map(k => Math.max(...boxes.map(b => b.max[k]))) };
}

export function createUnit(project: Project, ids: string[], name = 'Unit', id: string = crypto.randomUUID()): Unit {
  const members = project.entities.filter(e => ids.includes(e.id));
  if (!members.length || members.length !== ids.length || members.some(e => !isBuildingPart(e))) throw new Error('Select walls, floors and a roof on one level to make a unit.');
  if (members.some(e => e.parentId !== members[0].parentId)) throw new Error('A unit must stay on one floor.');
  if (!members.some(e => e.kind !== 'roof')) throw new Error('Include walls or a floor in the unit.');
  if (members.some(e => unitForPart(project, e.id))) throw new Error('These elements already belong to a unit. Ungroup it first.');
  assertCompleteJoins(project, members.filter((e): e is Wall => e.kind === 'wall'));
  return { id, kind: 'unit', parentId: members[0].parentId, name, visible: true, memberIds: ids };
}

function assertCompleteJoins(project: Project, walls: Wall[]) {
  for (const wall of walls.filter(w => w.joins)) {
    const connected = project.entities.some(e => e.kind === 'wall' && e.joins && e.parentId === wall.parentId && !walls.some(w => w.id === e.id) && [e.start, e.end].some(p => sameCorner(p, wall.start) || sameCorner(p, wall.end)));
    if (connected) throw new Error('Include the complete joined wall chain in this unit. Shared walls cannot belong to two units.');
  }
}

export type DuplicateAbove = { project: Project; selectedId: string; levelId: string; addedIds: string[]; movedRoofIds: string[]; height: number };
/** Pure, atomic plan used by both the ghost preview and the committed command. */
export function duplicateAbove(project: Project, sourceId: string, height: number, prefix: string): DuplicateAbove {
  const source = project.entities.find(e => e.id === sourceId), level = ownerLevel(project, sourceId);
  if (!level || !source || (source.kind !== 'level' && source.kind !== 'unit')) throw new Error('Select a unit or floor to duplicate above.');
  if (!Number.isFinite(height) || height < 0.5 || height > 30) throw new Error('Use a floor-to-floor height from 0.5 to 30 m.');
  const parts = scopeParts(project, sourceId), content = parts.filter(p => p.kind !== 'roof'), roofs = parts.filter(p => p.kind === 'roof');
  if (!content.length) throw new Error('Add walls or a floor before duplicating.');
  assertCompleteJoins(project, parts.filter((p): p is Wall => p.kind === 'wall'));
  const bottom = Math.min(...content.map(p => p.elevation)), top = Math.max(...content.map(p => p.elevation + (p.kind === 'wall' ? p.height : p.kind === 'slab' ? p.thickness : 0)));
  if (height < top - bottom - 0.00001) throw new Error(`Use at least ${(top - bottom).toFixed(2)} m to keep the copied storey clear of this one.`);
  const y = level.position[1] + height;
  if (y > 100) throw new Error('The next floor exceeds the 100 m elevation limit.');
  const buildingId = level.buildingId ?? `${prefix}-building`;
  const siblings = project.entities.filter((e): e is Level => e.kind === 'level' && e.buildingId === buildingId);
  const occupied = siblings.find(e => Math.abs(e.position[1] - y) < 0.001);
  if (occupied && (Math.abs(occupied.position[0] - level.position[0]) > 0.001 || Math.abs(occupied.position[2] - level.position[2]) > 0.001 || Math.abs(occupied.rotation - level.rotation) > 0.001)) throw new Error('The destination floor has a different origin or rotation. Align it before copying.');
  if (occupied && source.kind === 'level') throw new Error('A floor already exists at this elevation. Select a unit to copy into a free area.');
  const target: Level = occupied ?? { ...level, id: `${prefix}-level`, buildingId, storeyHeight: height, name: `Floor +${y.toFixed(2)} m`, position: [level.position[0], y, level.position[2]] };
  const map = new Map(content.map((p, i) => [p.id, `${prefix}-part-${i}`]));
  for (const roof of roofs) map.set(roof.id, roof.id); // Carry the top roof; never sandwich copies between storeys.
  const copied: BuildingPart[] = content.map(p => ({ ...structuredClone(p), id: map.get(p.id)!, parentId: target.id,
    ...(p.kind === 'wall' ? { openings: p.openings?.map((o, i) => ({ ...o, id: `${prefix}-opening-${content.indexOf(p)}-${i}` })) } : {}) }));
  const movedRoofs = roofs.map(p => ({ ...p, parentId: target.id }));
  const movedRoofIds = roofs.map(p => p.id);
  const overlaps = (a: ReturnType<typeof partBounds>, b: ReturnType<typeof partBounds>) => [0, 1, 2].every(k => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 0.001);
  // Conservative world-space bounds reject uncertain overlaps, including rotated neighbors.
  for (const candidate of [...copied, ...movedRoofs]) for (const existing of project.entities.filter(isBuildingPart)) {
    if (movedRoofIds.includes(existing.id)) continue;
    const host = ownerLevel(project, existing.id);
    if (host && overlaps(partBounds(candidate, target), partBounds(existing, host))) throw new Error(`The copy would overlap ${existing.name}. Choose another height or clear the destination.`);
  }
  const units = source.kind === 'unit' ? [source] : project.entities.filter((e): e is Unit => e.kind === 'unit' && e.parentId === level.id);
  const copiedUnits: Unit[] = units.map((u, i) => ({ ...u, id: `${prefix}-unit-${i}`, parentId: target.id, memberIds: u.memberIds.map(id => map.get(id)!).filter(Boolean) }));
  const added: Entity[] = [...(occupied ? [] : [target]), ...copied, ...copiedUnits];
  if (!level.buildingId) added.push({ id: buildingId, kind: 'building', parentId: 'site', visible: true, name: level.name.slice(0, 65) + ' building' });
  let entities = project.entities.map(e => {
    if (e.id === level.id) return { ...level, buildingId, storeyHeight: height };
    const moved = movedRoofs.find(r => r.id === e.id); if (moved) return moved;
    if (e.kind === 'unit' && e.memberIds.some(id => movedRoofIds.includes(id))) return { ...e, memberIds: e.memberIds.filter(id => !movedRoofIds.includes(id)) };
    return e;
  }).filter(e => e.kind !== 'unit' || e.memberIds.length);
  entities = [...entities, ...added];
  if (entities.length > 1000) throw new Error('This copy exceeds the 1,000-element scene limit.');
  const ids = new Set(entities.map(e => e.id));
  if (ids.size !== entities.length) throw new Error('Copy IDs already exist. Start a new preview.');
  const candidate={...project,entities};
  if(new TextEncoder().encode(JSON.stringify(candidate,null,2)).length>40*1024*1024)throw new Error('This copy exceeds the 40 MB project limit.');
  return { project: candidate, selectedId: source.kind === 'unit' ? copiedUnits[0].id : target.id, levelId: target.id, addedIds: added.map(e => e.id), movedRoofIds, height };
}
