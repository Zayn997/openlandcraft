import { groundHeight, type Entity, type Instance, type Level, type Project } from './model';
import { evaluateProject } from './surface';
import {detachedInstance} from './regions';
import type { Asset } from './assets';

export const snap = (value: number, step = 0.5) => Math.round(value / step) * step;

/** Place a ground-anchored library object, retaining its source dimensions. */
export function createPlacedInstance(project: Project, asset: Asset, x: number, z: number, snapping: boolean, id: string = crypto.randomUUID()): Instance {
  if (![x, z].every(Number.isFinite) || Math.abs(x) > project.site.width / 2 || Math.abs(z) > project.site.depth / 2) throw new Error('Choose a point inside the site.');
  const count = project.entities.filter(entity => entity.kind === 'instance' && entity.assetId === asset.id).length;
  return { id, parentId: 'site', kind: 'instance', visible: true, name: `${asset.name.slice(0, 65)}${count ? ` ${count + 1}` : ''}`, assetId: asset.id,
    position: [Math.max(-project.site.width / 2, Math.min(project.site.width / 2, snapping ? snap(x) : x)), 0, Math.max(-project.site.depth / 2, Math.min(project.site.depth / 2, snapping ? snap(z) : z))],
    rotation: 0, scale: [1, 1, 1], anchor: 'terrain' };
}
export function instancePosition(entity: Instance, project: Project): [number, number, number] {
  const [x, y, z] = entity.position;
  return [x, entity.anchor === 'terrain' ? groundHeight(x, z, project.site) + y : y, z];
}

/** A fixed-elevation level owns four joined walls, a slab and a gable roof. */
export function createBuilding(project: Project, x: number, z: number, width = 10, depth = 7, id: string = crypto.randomUUID()): Entity[] {
  const level: Level = { id, kind: 'level', parentId: 'site', visible: true, name: 'Building level', position: [snap(x, 0.25), groundHeight(snap(x, 0.25), snap(z, 0.25), evaluateProject(project).site) + 0.15, snap(z, 0.25)], rotation: 0 };
  const corners: [number, number][] = [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]];
  return [level,
    ...corners.map((start, index): Entity => ({ id: `${id}-wall-${index}`, parentId: id, kind: 'wall', joins: true, visible: true, name: `Wall ${index + 1}`, start, end: corners[(index + 1) % 4], height: 3.2, thickness: 0.25, elevation: 0.2, color: '#e4ded1' })),
    { id: `${id}-slab`, parentId: id, kind: 'slab', visible: true, name: 'Ground slab', center: [0, 0], width, depth, thickness: 0.2, elevation: 0, color: '#b8ac98' },
    { id: `${id}-roof`, parentId: id, kind: 'roof', visible: true, name: 'Gable roof', center: [0, 0], width: width + 0.8, depth: depth + 0.8, rise: 1.8, elevation: 3.4, color: '#667869' },
  ];
}

/** The seed and center fully determine placement; terrain is sampled at render time. */
export function scatterInstances(source: Instance, count: number, radius: number, seed: number, prefix: string = crypto.randomUUID()): Instance[] {
  if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isFinite(radius) || radius < 1 || radius > 30 || !Number.isInteger(seed) || seed < 0 || seed > 2147483647) throw new Error('Use 1–100 instances, a 1–30 m radius, and an integer seed.');
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  return Array.from({ length: count }, (_, index) => {
    const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * radius, scale = 0.8 + random() * 0.4;
    const dx=Math.cos(angle)*distance,dz=Math.sin(angle)*distance;
    return { ...detachedInstance(source), id: `${prefix}-${index}`, name: `${source.name.slice(0, 65)} ${index + 1}`, position: [source.position[0] + Math.cos(angle) * distance, source.position[1], source.position[2] + Math.sin(angle) * distance], rotation: random() * 360,
      ...(source.walkingRoute ? {walkingRoute:{...source.walkingRoute,points:source.walkingRoute.points.map(p=>[p[0]+dx,p[1]+dz] as [number,number])}} : {}),
      scale: source.scale.map((value) => Math.min(20, Math.max(0.05, value * scale))) as Instance['scale'] };
  });
}
