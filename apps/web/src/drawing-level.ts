import { ownerLevel, type Level, type Project } from '@openlandcraft/core';

/** Keep architecture on the selected level; never silently fall back to ground. */
export function resolveDrawingLevel(project: Project, selectedId: string | null, available: Level[], requestedId?: string) {
  const id = requestedId ?? ownerLevel(project, selectedId)?.id;
  return available.find(level => level.id === id);
}
