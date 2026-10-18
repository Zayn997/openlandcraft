import { carveRiver, type Heightfield } from '@openlandcraft/landscape';
import { groundHeight, type Project, type River } from './model';

const evaluated = new WeakMap<Heightfield, { river: River; field: Heightfield }>();
export function evaluateProject(project: Project): Project {
  const river = project.entities.find((entity): entity is River => entity.kind === 'river' && entity.visible);
  if (!river) return project;
  let cached = evaluated.get(project.site.terrain);
  if (!cached || cached.river !== river) {
    cached = { river, field: carveRiver(project.site.terrain, project.site, river) }; evaluated.set(project.site.terrain, cached);
  }
  return { ...project, site: { ...project.site, terrain: cached.field } };
}
export function createRiver(project: Project): River {
  let previous = 30;
  const { width, depth, terrain } = project.site, scale = Math.min(width / 90, depth / 72);
  const plan = Math.min(width, depth) < 60 || width / depth < 0.5 || width / depth > 2
    ? [[-width * 0.15, -depth * 0.28], [-width * 0.15, -depth * 0.03], [-width * 0.15, depth * 0.25]]
    : [[-27, -27], [-14, -18], [-17, -4], [-5, 9], [4, 20]].map(([x, z]) => [x * scale, z * scale]);
  const points = plan.map(([x, z]): [number, number, number] => {
    previous = Math.max(0, Math.min(previous, groundHeight(x, z, project.site) - 0.3)); return [x, previous, z];
  });
  return { id: crypto.randomUUID(), kind: 'river', parentId: 'site', name: 'Coastal river', visible: true, points, width: Math.max(Math.min(4, Math.min(width, depth) * 0.1), Math.ceil(20 * Math.max(width / (terrain.columns - 1), depth / (terrain.rows - 1))) / 10), depth: 1.5, bank: Math.min(2, Math.min(width, depth) * 0.05), speed: 0.8, color: '#448e87' };
}
