import { carveLake, carveRiver, type Heightfield } from '@openlandcraft/landscape';
import { groundHeight, type Lake, type Project, type River } from './model';
import { WATER_APPEARANCE_DEFAULTS } from './materials';
import { RIVER_WATER_DEFAULTS } from './river-water';
import {gradedTerrain} from './site-grading';

const evaluated = new WeakMap<Heightfield, { river: River; width: number; depth: number; field: Heightfield }>();
function sameChannel(a: River, b: River) {
  return a.width === b.width && a.depth === b.depth && a.bank === b.bank
    && (a.points === b.points || JSON.stringify(a.points) === JSON.stringify(b.points));
}
function evaluateRiver(project: Project): Project {
  const river = project.entities.find((entity): entity is River => entity.kind === 'river' && entity.visible);
  if (!river) return project;
  let cached = evaluated.get(project.site.terrain);
  if (!cached || !sameChannel(cached.river, river) || cached.width !== project.site.width || cached.depth !== project.site.depth) {
    cached = { river, width: project.site.width, depth: project.site.depth, field: carveRiver(project.site.terrain, project.site, river) }; evaluated.set(project.site.terrain, cached);
  }
  return { ...project, site: { ...project.site, terrain: cached.field } };
}
const lakeFields=new WeakMap<Heightfield,{key:string;field:Heightfield}>();
const sourceFields=new WeakMap<Heightfield,Heightfield>();
/** Deterministic order: authored ground → site grading → river → lake → following objects. */
export function evaluateProject(project:Project):Project {
  const original=sourceFields.get(project.site.terrain);if(original)project={...project,site:{...project.site,terrain:original}};
  const authoredField=project.site.terrain;
  const field=gradedTerrain(project);if(field!==project.site.terrain)project={...project,site:{...project.site,terrain:field}};
  const hidden=new Set(project.entities.filter(e=>e.kind==='plantingRegion'&&!e.visible).map(e=>e.id));
  if(hidden.size)project={...project,entities:project.entities.map(e=>e.kind==='instance'&&e.regionId&&hidden.has(e.regionId)?{...e,visible:false}:e)};
  const result=evaluateRiver(project),lake=result.entities.find((e):e is Lake=>e.kind==='lake'&&e.visible);
  if(!lake){if(result.site.terrain!==authoredField)sourceFields.set(result.site.terrain,authoredField);return result;}
  const key=JSON.stringify([result.site.width,result.site.depth,lake.points,lake.holes,lake.level,lake.depth,lake.bank]);
  let cached=lakeFields.get(result.site.terrain);
  if(!cached||cached.key!==key){cached={key,field:carveLake(result.site.terrain,result.site,lake)};lakeFields.set(result.site.terrain,cached);}
  if(cached.field!==authoredField)sourceFields.set(cached.field,authoredField);
  return {...result,site:{...result.site,terrain:cached.field}};
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
  return { id: crypto.randomUUID(), kind: 'river', parentId: 'site', name: 'Coastal river', visible: true, points, width: Math.max(Math.min(4, Math.min(width, depth) * 0.1), Math.ceil(20 * Math.max(width / (terrain.columns - 1), depth / (terrain.rows - 1))) / 10), depth: 1.5, bank: Math.min(2, Math.min(width, depth) * 0.05), speed: 0.8, color: '#448e87', appearance:{...WATER_APPEARANCE_DEFAULTS}, water:{...RIVER_WATER_DEFAULTS} };
}
