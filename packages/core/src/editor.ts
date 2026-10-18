import {replaceJoinedWall} from './architecture';
import {duplicateAbove} from './floors';
import { parseProject, type Entity, type Project } from './model';
import {detachedInstance,plantingInstanceChanged,regeneratePlanting} from './regions';
import type {PlantingRegion} from './model';
import type { Asset } from './assets';
import type { TerrainMaterials } from './materials';
import { diffHeights, restoreHeights, terrainSchema, type Heightfield, type HeightPatch } from '@openlandcraft/landscape';

export type Command =
  | {type:'duplicateAbove';sourceId:string;height:number;prefix:string}
  | {type:'ungroup';id:string}
  | {type:'planting';region:PlantingRegion}
  | { type: 'batch'; commands: Command[] }
  | { type: 'replace'; entity: Entity }
  | { type: 'add'; entity: Entity }
  | { type: 'insert'; entities: Entity[]; assets?: Asset[] }
  | { type: 'asset'; asset: Asset }
  | { type: 'removeAsset'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'rename'; name: string }
  | { type: 'materials'; materials: TerrainMaterials }
  | { type: 'terrain'; field: Heightfield };

type Entry = { type: 'document'; before: Project; after: Project; label: string } | { type: 'terrain'; patch: HeightPatch; label: string };
export type EditorState = {
  project: Project;
  preview: Project | null;
  selectedId: string | null;
  revision: number;
  past: readonly Entry[];
  future: readonly Entry[];
  gestureLabel: string | null;
};

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    const children = Array.isArray(value) ? value : Object.values(value);
    for (const child of children) if (child && typeof child === 'object') freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function applyCommand(project: Project, command: Command): Project {
  if (command.type === 'batch') return command.commands.reduce(applyCommand, project);
  if (command.type === 'terrain') {
    const field = terrainSchema.parse(command.field);
    if (field.columns !== project.site.terrain.columns || field.rows !== project.site.terrain.rows) throw new Error('A brush cannot change terrain resolution.');
    return freeze({ ...project, site: { ...project.site, terrain: field } });
  }
  let candidate: Project;
  switch (command.type) {
    case 'duplicateAbove': candidate=duplicateAbove(project,command.sourceId,command.height,command.prefix).project; break;
    case 'ungroup': {
      if(!project.entities.some(e=>e.id===command.id&&e.kind==='unit'))throw new Error('Choose a unit to ungroup.');
      candidate={...project,entities:project.entities.filter(e=>e.id!==command.id)};break;
    }
    case 'replace': {
      const current = project.entities.find((e) => e.id === command.entity.id);
      if (!current) throw new Error('The object no longer exists.');
      if (current.kind !== command.entity.kind) throw new Error('An object cannot change its kind.');
      let replacement=command.entity;
      if(current.kind==='instance'&&current.regionId&&replacement.kind==='instance'&&plantingInstanceChanged(current,replacement))replacement=detachedInstance(replacement);
      if(current.kind==='plantingRegion'&&replacement.kind==='plantingRegion'&&(Object.keys(current) as (keyof PlantingRegion)[]).some(key=>key!=='name'&&key!=='visible'&&JSON.stringify(current[key])!==JSON.stringify((replacement as PlantingRegion)[key])))throw new Error('Preview regeneration to change planting region settings.');
      candidate = { ...project, entities: current.kind==='wall'&&replacement.kind==='wall'?replaceJoinedWall(project.entities,current,replacement):project.entities.map((e) => e.id === command.entity.id ? replacement : e) };
      break;
    }
    case 'add': candidate = { ...project, entities: [...project.entities, command.entity] }; break;
    case 'planting': {
      const current=project.entities.find(e=>e.id===command.region.id);
      if(current&&current.kind!=='plantingRegion')throw new Error('An object cannot change its kind.');
      candidate=regeneratePlanting(project,command.region);break;
    }
    case 'insert': candidate = { ...project, entities: [...project.entities, ...command.entities], assets: [...project.assets, ...(command.assets ?? [])] }; break;
    case 'asset': {
      if (!project.assets.some((asset) => asset.id === command.asset.id)) throw new Error('The model no longer exists.');
      candidate = { ...project, assets: project.assets.map((asset) => asset.id === command.asset.id ? command.asset : asset) }; break;
    }
    case 'removeAsset': {
      if (project.entities.some((entity) => (entity.kind === 'instance'||entity.kind==='plantingRegion') && entity.assetId === command.id)) throw new Error('Delete the model instances and planting regions before removing their source.');
      candidate = { ...project, assets: project.assets.filter((asset) => asset.id !== command.id) }; break;
    }
    case 'remove': {
      if (!project.entities.some((e) => e.id === command.id)) throw new Error('The object no longer exists.');
      const removed=new Set([command.id]);
      const target=project.entities.find(e=>e.id===command.id);
      if(target?.kind==='unit')target.memberIds.forEach(id=>removed.add(id));
      if(target?.kind==='building')project.entities.forEach(e=>{if(e.kind==='level'&&e.buildingId===target.id)removed.add(e.id);});
      project.entities.forEach(e=>{if(removed.has(e.parentId)||e.kind==='instance'&&e.regionId&&removed.has(e.regionId))removed.add(e.id);});
      candidate = { ...project, entities: project.entities.filter(e=>!removed.has(e.id)).map(e=>e.kind==='unit'?{...e,memberIds:e.memberIds.filter(id=>!removed.has(id))}:e).filter(e=>e.kind!=='unit'||e.memberIds.length) };
      break;
    }
    case 'rename': candidate = { ...project, name: command.name }; break;
    case 'materials': candidate = { ...project, site:{...project.site,materials:command.materials} }; break;
  }
  const parsed = parseProject(candidate);
  // Entity edits share the unchanged terrain instead of retaining duplicate grids.
  parsed.site.terrain = project.site.terrain;
  parsed.entities = parsed.entities.map((entity) => { const existing = project.entities.find((before) => before.id === entity.id); return existing && JSON.stringify(existing) === JSON.stringify(entity) ? existing : entity; });
  if (command.type !== 'asset' && command.type !== 'removeAsset' && !(command.type === 'insert' && command.assets?.length)) parsed.assets = project.assets;
  return freeze(parsed);
}

export class Editor {
  private state: EditorState;
  private listeners = new Set<() => void>();
  constructor(project: Project) {
    this.state = { project: freeze(parseProject(project)), preview: null, selectedId: 'block-pavilion', revision: 0, past: [], future: [], gestureLabel: null };
    this.reconcileSelection();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private reconcileSelection() {
    if (this.state.selectedId !== 'terrain' && !this.state.project.entities.some((e) => e.id === this.state.selectedId)) this.state = { ...this.state, selectedId: null };
  }
  private publish(patch: Partial<EditorState>) {
    this.state = { ...this.state, ...patch };
    this.reconcileSelection();
    this.listeners.forEach((listener) => listener());
  }
  select(id: string | null) {
    if (this.state.gestureLabel) this.cancel();
    this.publish({ selectedId: id });
  }
  private commitProject(project: Project, label: string) {
    const before = this.state.project;
    const sameEntities = project.entities === before.entities || project.entities.length === before.entities.length && project.entities.every((entity, index) => entity === before.entities[index] || JSON.stringify(entity) === JSON.stringify(before.entities[index]));
    const sameAssets = project.assets === before.assets || project.assets.length === before.assets.length && project.assets.every((asset, index) => { const previous = before.assets[index]; return asset.id === previous.id && asset.name === previous.name && asset.attribution === previous.attribution && asset.data === previous.data; });
    const sameMetadata = project.name === before.name && project.site.width === before.site.width && project.site.depth === before.site.depth && project.site.shoreX === before.site.shoreX && project.site.slope === before.site.slope;
    const sameResolution = before.site.terrain.columns === project.site.terrain.columns && before.site.terrain.rows === project.site.terrain.rows;
    const sameMaterials=JSON.stringify(project.site.materials)===JSON.stringify(before.site.materials);
    const terrainOnly = sameMetadata && sameMaterials && sameEntities && sameAssets && sameResolution;
    const patch = terrainOnly ? diffHeights(before.site.terrain, project.site.terrain) : null;
    if (patch && !patch.indices.length) {
      this.publish({ preview: null, gestureLabel: null });
      return;
    }
    const entry: Entry = terrainOnly
      ? freeze({ type: 'terrain', patch: patch!, label })
      : { type: 'document', before, after: project, label };
    this.publish({ project, preview: null, gestureLabel: null, past: [...this.state.past, entry].slice(-100), future: [], revision: this.state.revision + 1 });
  }
  execute(command: Command, label: string) {
    if (this.state.gestureLabel) throw new Error('Finish or cancel the current edit first.');
    this.commitProject(applyCommand(this.state.project, command), label);
  }
  replaceProject(value: unknown, label: string) {
    const project = freeze(parseProject(value));
    this.cancel(); this.commitProject(project, label);
  }
  begin(label: string) {
    if (this.state.gestureLabel) throw new Error('An edit is already in progress.');
    this.publish({ gestureLabel: label, preview: this.state.project });
  }
  preview(command: Command) {
    if (!this.state.gestureLabel) throw new Error('Start an edit before previewing.');
    // Every preview starts from the committed baseline, never the previous frame.
    this.publish({ preview: applyCommand(this.state.project, command) });
  }
  commit() {
    if (this.state.gestureLabel && this.state.preview) this.commitProject(this.state.preview, this.state.gestureLabel);
  }
  cancel() { if (this.state.gestureLabel) this.publish({ preview: null, gestureLabel: null }); }
  undo() {
    this.cancel();
    const entry = this.state.past.at(-1);
    if (entry) {
      const project = entry.type === 'document' ? entry.before : freeze({ ...this.state.project, site: { ...this.state.project.site, terrain: restoreHeights(this.state.project.site.terrain, entry.patch, 'before') } });
      this.publish({ project, past: this.state.past.slice(0, -1), future: [entry, ...this.state.future], revision: this.state.revision + 1 });
    }
  }
  redo() {
    this.cancel();
    const entry = this.state.future[0];
    if (entry) {
      const project = entry.type === 'document' ? entry.after : freeze({ ...this.state.project, site: { ...this.state.project.site, terrain: restoreHeights(this.state.project.site.terrain, entry.patch, 'after') } });
      this.publish({ project, past: [...this.state.past, entry], future: this.state.future.slice(1), revision: this.state.revision + 1 });
    }
  }
  load(value: unknown) {
    // Parse completely before touching the current document or draft.
    const project = freeze(parseProject(value));
    this.publish({ project, preview: null, gestureLabel: null, past: [], future: [], selectedId: null, revision: this.state.revision + 1 });
  }
}
