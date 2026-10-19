import type { Command } from './editor';
import type { Project } from './model';

/** Resolve deletion from the committed selection, never an unfinished preview. */
export function selectionDelete(project: Project, selectedId: string | null, selectedIds: readonly string[] = [], opening?: { wallId: string; openingId: string } | null): { command: Command; label: string } | null {
  if (opening) {
    const wall = project.entities.find(e => e.id === opening.wallId);
    const aperture = wall?.kind === 'wall' ? wall.openings?.find(o => o.id === opening.openingId) : undefined;
    // A stale aperture selection must never fall back to deleting its host.
    if (wall?.kind !== 'wall' || !aperture) return null;
    return { command: { type: 'replace', entity: { ...wall, openings: wall.openings!.filter(o => o.id !== aperture.id) } }, label: 'Delete ' + aperture.kind };
  }
  const ids = new Set(selectedIds.length ? selectedIds : selectedId ? [selectedId] : []);
  const targets = project.entities.filter(e => ids.has(e.id));
  if (!targets.length) return null;
  // Ancestors own removal of their children; don't issue a second remove for them.
  const owned = new Set<string>();
  for (const target of targets) {
    if (target.kind === 'building') project.entities.forEach(e => { if (e.kind === 'level' && e.buildingId === target.id) owned.add(e.id); });
    if (target.kind === 'unit') target.memberIds.forEach(id => owned.add(id));
  }
  for (const entity of project.entities) if (ids.has(entity.parentId) || owned.has(entity.parentId) || entity.kind === 'instance' && entity.regionId && ids.has(entity.regionId)) owned.add(entity.id);
  const commands: Command[] = targets.filter(e => !owned.has(e.id)).map(e => ({ type: 'remove', id: e.id }));
  // Remove units first: deleting their last selected member can remove an empty unit.
  commands.sort((a, b) => Number(b.type === 'remove' && project.entities.find(e => e.id === b.id)?.kind === 'unit') - Number(a.type === 'remove' && project.entities.find(e => e.id === a.id)?.kind === 'unit'));
  return { command: { type: 'batch', commands }, label: targets.length === 1 ? 'Delete ' + targets[0].name : 'Delete selected elements' };
}
