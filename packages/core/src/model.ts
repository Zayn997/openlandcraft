import { z } from 'zod';
import { createHeightfield, riverIssue, sampleHeight, terrainSchema } from '@openlandcraft/landscape';
import { assetSchema, glbByteLength, MAX_ASSET_BYTES } from './assets';

const finite = z.number().finite();
const position = z.tuple([finite.min(-500).max(500), finite.min(-50).max(100), finite.min(-500).max(500)]);
const base = {
  id: z.string().min(1).max(100),
  parentId: z.literal('site'),
  name: z.string().trim().min(1).max(80),
  visible: z.boolean(),
};
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.');

export const blockSchema = z.object({
  ...base, kind: z.literal('block'), position,
  size: z.tuple([finite.min(0.2).max(100), finite.min(0.2).max(100), finite.min(0.2).max(100)]),
  rotation: finite.min(-360).max(360), color,
}).strict();
export const oceanSchema = z.object({
  ...base, kind: z.literal('ocean'),
  level: finite.min(-8).max(8), amplitude: finite.min(0).max(0.8),
  speed: finite.min(0).max(3), color,
}).strict();
const rotation = finite.min(-360).max(360);
const localPoint = z.tuple([finite.min(-100).max(100), finite.min(-100).max(100)]);
export const instanceSchema = z.object({ ...base, kind: z.literal('instance'), assetId: z.string(), position, rotation,
  scale: z.tuple([finite.min(0.05).max(20), finite.min(0.05).max(20), finite.min(0.05).max(20)]), anchor: z.enum(['terrain', 'fixed']),
}).strict();
export const levelSchema = z.object({ ...base, kind: z.literal('level'), position, rotation }).strict();
const part = { ...base, parentId: z.string().min(1).max(100), color };
export const wallSchema = z.object({ ...part, kind: z.literal('wall'), start: localPoint, end: localPoint,
  height: finite.min(0.2).max(30), thickness: finite.min(0.05).max(2), elevation: finite.min(-10).max(30),
}).strict();
export const slabSchema = z.object({ ...part, kind: z.literal('slab'), center: localPoint,
  width: finite.min(0.5).max(100), depth: finite.min(0.5).max(100), thickness: finite.min(0.05).max(2), elevation: finite.min(-10).max(30),
}).strict();
export const roofSchema = z.object({ ...part, kind: z.literal('roof'), center: localPoint,
  width: finite.min(0.5).max(100), depth: finite.min(0.5).max(100), rise: finite.min(0.1).max(15), elevation: finite.min(-10).max(40),
}).strict();
export const riverSchema = z.object({ ...base, kind: z.literal('river'),
  points: z.array(z.tuple([finite.min(-100).max(100), finite.min(-8).max(30), finite.min(-100).max(100)])).min(2).max(16),
  width: finite.min(1).max(12), depth: finite.min(0.2).max(5), bank: finite.min(1).max(8), speed: finite.min(0).max(3), color,
}).strict();
export const entitySchema = z.discriminatedUnion('kind', [blockSchema, oceanSchema, instanceSchema, levelSchema, wallSchema, slabSchema, roofSchema, riverSchema]);
const envelope = {
  format: z.literal('openlandcraft.project'),
  name: z.string().trim().min(1).max(100), units: z.literal('m'), upAxis: z.literal('Y'),
  entities: z.array(entitySchema).max(1000),
};
const siteSchema = z.object({
    id: z.literal('site'), width: finite.min(20).max(200), depth: finite.min(20).max(200),
    shoreX: finite.min(-20).max(20), slope: finite.min(0.05).max(0.5),
}).strict();
const legacyProjectSchema = z.object({ ...envelope, version: z.literal(1), site: siteSchema }).strict();
const versionTwoSchema = z.object({ ...envelope, version: z.literal(2), site: siteSchema.extend({ terrain: terrainSchema }) }).strict();
const versionThreeSchema = z.object({ ...envelope, version: z.literal(3), site: siteSchema.extend({ terrain: terrainSchema }), assets: z.array(assetSchema).max(16) }).strict();
export const projectSchema = z.object({ ...envelope, version: z.literal(4), site: siteSchema.extend({ terrain: terrainSchema }), assets: z.array(assetSchema).max(16) }).strict().superRefine((project, ctx) => {
  const ids = new Set<string>(['site', 'terrain']);
  let oceans = 0;
  project.entities.forEach((entity, index) => {
    if (ids.has(entity.id)) ctx.addIssue({ code: 'custom', path: ['entities', index, 'id'], message: 'Entity IDs must be unique.' });
    ids.add(entity.id);
    if (entity.kind === 'ocean') oceans++;
  });
  if (oceans > 1) ctx.addIssue({ code: 'custom', path: ['entities'], message: 'This version supports one ocean surface.' });
  if (project.entities.filter((entity) => entity.kind === 'river').length > 1) ctx.addIssue({ code: 'custom', path: ['entities'], message: 'This version supports one unbranched river.' });
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  if (assetIds.size !== project.assets.length) ctx.addIssue({ code: 'custom', path: ['assets'], message: 'Asset IDs must be unique.' });
  if (project.assets.reduce((sum, asset) => sum + glbByteLength(asset.data), 0) > MAX_ASSET_BYTES) ctx.addIssue({ code: 'custom', path: ['assets'], message: 'The asset library exceeds 24 MB.' });
  project.entities.forEach((entity, index) => {
    if (entity.kind === 'river') { const issue = riverIssue(entity, project.site, project.site.terrain); if (issue) ctx.addIssue({ code: 'custom', path: ['entities', index, 'points'], message: issue }); }
    if (entity.kind === 'instance' && !assetIds.has(entity.assetId)) ctx.addIssue({ code: 'custom', path: ['entities', index, 'assetId'], message: 'The embedded model is missing.' });
    if (entity.parentId !== 'site' && !project.entities.some((level) => level.id === entity.parentId && level.kind === 'level')) ctx.addIssue({ code: 'custom', path: ['entities', index, 'parentId'], message: 'Building elements must belong to an existing level.' });
    if (['wall', 'slab', 'roof'].includes(entity.kind) && entity.parentId === 'site') ctx.addIssue({ code: 'custom', path: ['entities', index, 'parentId'], message: 'Choose a building level for this element.' });
    if (entity.kind === 'wall' && Math.hypot(entity.end[0] - entity.start[0], entity.end[1] - entity.start[1]) < 0.2) ctx.addIssue({ code: 'custom', path: ['entities', index, 'end'], message: 'Walls must be at least 0.2 m long.' });
  });
});

export type Block = z.infer<typeof blockSchema>;
export type Ocean = z.infer<typeof oceanSchema>;
export type Instance = z.infer<typeof instanceSchema>;
export type Level = z.infer<typeof levelSchema>;
export type Wall = z.infer<typeof wallSchema>;
export type Slab = z.infer<typeof slabSchema>;
export type Roof = z.infer<typeof roofSchema>;
export type BuildingPart = Wall | Slab | Roof;
export type River = z.infer<typeof riverSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Project = z.infer<typeof projectSchema>;

export function parseProject(value: unknown): Project {
  let candidate = value;
  if (value && typeof value === 'object' && 'version' in value && value.version === 1) {
    const legacy = legacyProjectSchema.safeParse(value);
    if (legacy.success) {
      const site = legacy.data.site;
      candidate = { ...legacy.data, version: 4, assets: [], site: { ...site, terrain: createHeightfield(site, (x, z) => coastHeight(x, z, site)) } };
    }
  }
  if (value && typeof value === 'object' && 'version' in value && value.version === 2) {
    const legacy = versionTwoSchema.safeParse(value);
    if (legacy.success) candidate = { ...legacy.data, version: 4, assets: [] };
  }
  if (value && typeof value === 'object' && 'version' in value && value.version === 3) {
    const legacy = versionThreeSchema.safeParse(value); if (legacy.success) candidate = { ...legacy.data, version: 4 };
  }
  const result = projectSchema.safeParse(candidate);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Project could not be read: ${issue.path.join('.') || 'document'} — ${issue.message}`);
  }
  return result.data;
}

function coastHeight(x: number, z: number, site: z.infer<typeof siteSchema>): number {
  const coast = site.shoreX + Math.sin(z * 0.09) * 3 + Math.sin(z * 0.23) * 0.8;
  const slope = (coast - x) * site.slope;
  const hill = 2.7 * Math.exp(-((x + 22) ** 2 + (z - 13) ** 2) / 150);
  return Math.max(-7, Math.min(7, slope + hill));
}

/** The same authored heightfield feeds land geometry, picking, and water depth. */
export function groundHeight(x: number, z: number, site: Project['site']): number {
  return sampleHeight(site.terrain, site, x, z);
}

export function createProject(): Project {
  const baseSite = { id: 'site' as const, width: 90, depth: 72, shoreX: 1, slope: 0.16 };
  const site = { ...baseSite, terrain: createHeightfield(baseSite, (x, z) => coastHeight(x, z, baseSite)) };
  const block = (id: string, name: string, x: number, z: number, size: Block['size'], color: string): Block => ({
    id, name, kind: 'block', parentId: 'site', visible: true,
    position: [x, groundHeight(x, z, site) + 0.15, z], size, rotation: 0, color,
  });
  return parseProject({
    format: 'openlandcraft.project', version: 4, assets: [], name: 'Coastal study', units: 'm', upAxis: 'Y', site,
    entities: [
      block('block-pavilion', 'Pavilion 01', -13, 1, [10, 4, 7], '#e4ded1'),
      block('block-studio', 'Studio 02', -22, -10, [7, 3, 5], '#c4ccba'),
      block('block-terrace', 'Terrace 03', -12, -10, [8, 0.5, 5], '#b8ac98'),
      { id: 'ocean-main', name: 'Coastal water', kind: 'ocean', parentId: 'site', visible: true, level: 0, amplitude: 0.16, speed: 0.8, color: '#3e8e90' },
    ],
  });
}

export function createSite(options: { name: string; width: number; depth: number; resolution: 129 | 257; preset: 'coast' | 'flat' }): Project {
  const baseSite = siteSchema.parse({ id: 'site', width: options.width, depth: options.depth, shoreX: 1, slope: 0.16 });
  const terrain = createHeightfield(baseSite, (x, z) => options.preset === 'flat' ? 2 : coastHeight(x, z, baseSite), options.resolution, options.resolution);
  return parseProject({ format: 'openlandcraft.project', version: 4, name: options.name, units: 'm', upAxis: 'Y', site: { ...baseSite, terrain }, assets: [],
    entities: options.preset === 'coast' ? [{ id: 'ocean-main', name: 'Coastal water', kind: 'ocean', parentId: 'site', visible: true, level: 0, amplitude: 0.16, speed: 0.8, color: '#3e8e90' }] : [] });
}
