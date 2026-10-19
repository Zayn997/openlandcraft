import { z } from "zod";
import type { Project } from "./model";

export const DEFAULT_LAYER = "default";
export const layerSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    parentId: z.string().min(1).max(100).nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    visible: z.boolean(),
    locked: z.boolean(),
  })
  .strict();
export type Layer = z.infer<typeof layerSchema>;
export const defaultLayers = (): Layer[] => [
  {
    id: DEFAULT_LAYER,
    name: "Default",
    parentId: null,
    color: "#c8d9ac",
    visible: true,
    locked: false,
  },
];
export type LayerDocument = {
  layers: Layer[];
  objectLayers: Record<string, string>;
  activeLayerId: string | null;
};

export function layerIssue(
  project: LayerDocument,
  objectIds: Set<string>,
): string | null {
  const ids = new Set(project.layers.map((l) => l.id));
  if (ids.size !== project.layers.length) return "Layer IDs must be unique.";
  if (!ids.has(DEFAULT_LAYER)) return "The Default layer is required.";
  for (const layer of project.layers) {
    if (layer.id === DEFAULT_LAYER && layer.parentId !== null)
      return "Default must remain a root layer.";
    const visited = new Set([layer.id]);
    let parent = layer.parentId;
    while (parent !== null) {
      if (!ids.has(parent)) return "A layer parent must exist.";
      if (visited.has(parent)) return "Layers cannot contain cycles.";
      visited.add(parent);
      parent = project.layers.find((l) => l.id === parent)!.parentId;
    }
    if (
      project.layers.some(
        (l) =>
          l.id !== layer.id &&
          l.parentId === layer.parentId &&
          l.name.toLocaleLowerCase() === layer.name.toLocaleLowerCase(),
      )
    )
      return "Use unique layer names within each parent.";
  }
  if (project.activeLayerId !== null && !ids.has(project.activeLayerId))
    return "The active layer must exist.";
  for (const [id, layer] of Object.entries(project.objectLayers)) {
    if (!objectIds.has(id) || !ids.has(layer))
      return "Layer assignments must reference existing objects and layers.";
  }
  return null;
}

export function layerState(
  project: LayerDocument,
  id: string,
  isolatedId: string | null = null,
) {
  let visible = true,
    locked = false,
    inIsolation = isolatedId === null;
  const seen = new Set<string>();
  let current: string | null = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const layer = project.layers.find((l) => l.id === current);
    if (!layer) return { visible: false, locked: true };
    visible &&= layer.visible;
    locked ||= layer.locked;
    inIsolation ||= current === isolatedId;
    current = layer.parentId;
  }
  return { visible: visible && inIsolation, locked };
}

export function objectLayer(project: LayerDocument, id: string) {
  return project.objectLayers[id] ?? DEFAULT_LAYER;
}

/** Ownership still governs editing; layer membership never reparents geometry. */
export function objectOwners(project: Project, id: string): string[] {
  const entity = project.entities.find((e) => e.id === id);
  if (!entity) return [];
  return [
    entity.parentId !== "site" ? entity.parentId : null,
    entity.kind === "level" ? entity.buildingId : null,
    entity.kind === "instance" ? entity.regionId : null,
    project.entities.find((e) => e.kind === "unit" && e.memberIds.includes(id))
      ?.id,
  ].filter((value): value is string => !!value);
}

export function objectLayerState(
  project: Project,
  id: string,
  isolatedId: string | null = null,
  seen = new Set<string>(),
): { visible: boolean; locked: boolean } {
  const own = layerState(project, objectLayer(project, id), isolatedId);
  if (seen.has(id)) return own;
  seen.add(id);
  for (const parent of objectOwners(project, id)) {
    // Isolation is a layer filter, so ancestors on other layers don't suppress members.
    const inherited = objectLayerState(project, parent, null, seen);
    own.visible &&= inherited.visible;
    own.locked ||= inherited.locked;
  }
  return own;
}

export function canEditObject(
  project: Project,
  id: string,
  isolatedId: string | null = null,
) {
  const state = objectLayerState(project, id, isolatedId);
  return state.visible && !state.locked;
}

/** Apply display filtering without modifying authored visibility or geometry. */
export function layerDisplayProject(
  project: Project,
  isolatedId: string | null = null,
): Project {
  return {
    ...project,
    entities: project.entities.map((entity) => {
      // Floors/buildings are transform containers; isolated child layers still need them.
      const container =
        entity.kind === "building" ||
        entity.kind === "level" ||
        entity.kind === "unit";
      const visible =
        entity.visible &&
        objectLayerState(project, entity.id, container ? null : isolatedId)
          .visible;
      return visible === entity.visible ? entity : { ...entity, visible };
    }),
  };
}
