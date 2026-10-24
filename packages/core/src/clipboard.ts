import { remapWallJunctions } from './architecture';
import { objectLayer } from './layers';
import { applyCommand, type Command } from './editor';
import { ownerLevel, isBuildingPart } from './floors';
import { wallLength } from './architecture';
import { openingCenter,openingDistanceAtPoint,wrapOpeningOffset } from './opening-profile';
import type { Asset } from './assets';
import type { Entity, Opening, Project } from './model';
import {remapRoofTower} from './conical-roofs';
import {remapSpiralTower} from './spiral-stairs';
import {remapStairConnections} from './stair-connections';
import {architecturalMaterials,partMaterialIds,type ArchitecturalMaterial} from './architectural-materials';
import {TOWER_PART_KEYS,type TowerType,type TowerAssembly} from './towers';

export type EditorClipboard = { kind: 'opening'; opening: Opening;materials?:ArchitecturalMaterial[] } | { kind: 'entities'; entities: Entity[]; roots: string[]; assets: Asset[]; materials?:ArchitecturalMaterial[]; objectLayers?:Record<string,string>;towerTypes?:TowerType[];towerAssemblies?:TowerAssembly[] };
function remapOpeningMaterials(o:Opening,ids:Map<string,string>):Opening{
 const j=o.joinery;if(!j)return o;return {...o,joinery:{...j,...(j.frame?{frame:{...j.frame,materialId:j.frame.materialId?ids.get(j.frame.materialId)??j.frame.materialId:undefined}}:{}),...(j.panel?{panel:{...j.panel,materialId:j.panel.materialId?ids.get(j.panel.materialId)??j.panel.materialId:undefined}}:{})}};
}
export function copySelection(project: Project, selectedId: string | null, selectedIds: readonly string[] = [], focus?: { wallId: string; openingId: string } | null): EditorClipboard {
  if (focus) {
    const host = project.entities.find(e => e.id === focus.wallId);
    const opening = host?.kind === 'wall' && host.openings?.find(o => o.id === focus.openingId);
    if (!opening) throw new Error('Select an existing door or window to copy.');
    const used=new Set([opening.joinery?.frame?.materialId,opening.joinery?.panel?.materialId]);
    return structuredClone({ kind: 'opening', opening,materials:architecturalMaterials(project).filter(m=>used.has(m.id)) });
  }
  const ids = new Set(selectedIds.length ? selectedIds : selectedId ? [selectedId] : []);
  const roots = project.entities.filter(e => ids.has(e.id)).map(e => e.id);
  if (!roots.length) throw new Error('Select an element to copy. Terrain cannot be copied.');
  let changed = true;
  while (changed) {
    const count = ids.size;
    for (const entity of project.entities) {
      if (ids.has(entity.parentId) || entity.kind === 'level' && entity.buildingId && ids.has(entity.buildingId) || entity.kind === 'instance' && entity.regionId && ids.has(entity.regionId)) ids.add(entity.id);
      if (entity.kind === 'unit' && ids.has(entity.id)) entity.memberIds.forEach(id => ids.add(id));
      if(entity.kind==='roof'&&entity.cone?.wallId&&ids.has(entity.cone.wallId))ids.add(entity.id);
      if(entity.kind==='slab'&&entity.stairs?.spiral?.towerId&&ids.has(entity.stairs.spiral.towerId))ids.add(entity.id);
      if(entity.kind==='slab'&&entity.stairs?.connections?.bottom?.floorId&&ids.has(entity.stairs.connections.bottom.floorId))ids.add(entity.id);
      if(entity.kind==='slab'&&entity.stairs?.connections?.top&&ids.has(entity.stairs.connections.top.floorId??entity.stairs.connections.top.wallId!))ids.add(entity.id);
    }
    changed = ids.size !== count;
  }
  const entities = project.entities.filter(e => ids.has(e.id));
  const assetIds = new Set(entities.flatMap(e => 'assetId' in e ? [e.assetId] : []));
  const materialIds=new Set(entities.flatMap(e=>isBuildingPart(e)?partMaterialIds(e):[]));
  const towers=project.towerAssemblies?.filter(t=>ids.has(t.levelId));
  return structuredClone({ kind: 'entities', entities, roots, materials:architecturalMaterials(project).filter(m=>materialIds.has(m.id)),objectLayers:Object.fromEntries(entities.map(e=>[e.id,objectLayer(project,e.id)])), assets: project.assets.filter(a => assetIds.has(a.id)),...(towers?.length?{towerAssemblies:towers,towerTypes:project.towerTypes?.filter(type=>towers.some(t=>t.typeId===type.id))}:{}) });
}

export type DragCopyPlacement = { worldDelta: [number, number]; snapping: boolean };
export function pasteSelection(project: Project, clipboard: EditorClipboard, selectedId: string | null, prefix: string, count = 1, drag?: DragCopyPlacement): { command: Command; selectedIds: string[]; displaced?: boolean; focus?: { wallId: string; openingId: string } } {
  if (drag && !drag.worldDelta.every(Number.isFinite)) throw new Error('Keep the pointer on the placement plane.');
  const materialMap=new Map<string,string>(),newMaterials:ArchitecturalMaterial[]=[],library=architecturalMaterials(project);
  for(const [i,material] of (clipboard.materials??[]).entries()){
    const existing=library.find(m=>JSON.stringify(m)===JSON.stringify(material));
    const id=existing?.id??(!library.some(m=>m.id===material.id)?material.id:prefix+'-material-'+i);
    materialMap.set(material.id,id);if(!existing)newMaterials.push({...material,id});
  }
  const withMaterials=(command:Command):Command=>newMaterials.length?{type:'batch',commands:[...newMaterials.map(material=>({type:'architecturalMaterial' as const,material})),command]}:command;
  const localDelta = (parentId: string): [number, number] => {
    const level = project.entities.find(e => e.kind === 'level' && e.id === parentId);
    const angle = level?.kind === 'level' ? level.rotation*Math.PI/180 : 0, [x,z] = drag!.worldDelta;
    return [x*Math.cos(angle)-z*Math.sin(angle), x*Math.sin(angle)+z*Math.cos(angle)];
  };
  if (clipboard.kind === 'opening') {
    const sourceOpening=remapOpeningMaterials(clipboard.opening,materialMap);
    const wall = project.entities.find(e => e.id === selectedId);
    if (wall?.kind !== 'wall') throw new Error('Select a wall or one of its openings before pasting a door/window.');
    if (drag) {
      const delta = localDelta(wall.parentId);
      const center=openingCenter(wall,sourceOpening);
      let offset = openingDistanceAtPoint(wall,[center[0]+delta[0],center[1]+delta[1]],sourceOpening.offset+sourceOpening.width/2)-sourceOpening.width/2;
      if (drag.snapping) offset = Math.round(offset*10)/10;
      offset=wrapOpeningOffset(wall,offset);
      const opening = { ...sourceOpening, id: prefix+'-opening', offset };
      const command: Command = withMaterials({ type:'replace', entity:{...wall,openings:[...(wall.openings??[]),opening]} });
      applyCommand(project,command);
      return {command,selectedIds:[wall.id],displaced:Math.abs(offset-sourceOpening.offset)>0.001,focus:{wallId:wall.id,openingId:opening.id}};
    }
    // Try gaps after the source position, then wrap to the start. Full command
    // validation includes joined corner clearance, overlap and height limits.
    const candidates = [sourceOpening.offset + sourceOpening.width + 0.2, Math.max(0.1,wall.thickness*2), ...(wall.openings ?? []).map(o => o.offset + o.width + 0.2)].sort((a,b) => a-b);
    const after = sourceOpening.offset + sourceOpening.width + 0.2;
    const ordered = [...candidates.filter(x => x >= after), ...candidates.filter(x => x < after)];
    for (const offset of ordered) {
      if (offset + sourceOpening.width > wallLength(wall)) continue;
      const opening = { ...sourceOpening, id: prefix + '-opening', offset };
      const command: Command = withMaterials({ type: 'replace', entity: { ...wall, openings: [...(wall.openings ?? []), opening] } });
      try { applyCommand(project, command); return { command, selectedIds: [wall.id], focus: { wallId: wall.id, openingId: opening.id } }; } catch { /* Try the next free gap. */ }
    }
    throw new Error('No valid gap fits this opening on the selected wall. Choose another wall or resize the opening.');
  }
  const idMap = new Map(clipboard.entities.map((e, i) => [e.id, prefix + '-' + i]));
  const assets: Asset[] = [], assetMap = new Map<string,string>();
  clipboard.assets.forEach((asset, i) => {
    const existing = project.assets.find(a => a.data === asset.data);
    const id = existing?.id ?? prefix + '-asset-' + i;
    assetMap.set(asset.id, id);
    if (!existing) assets.push({ ...asset, id });
  });
  const destination = ownerLevel(project, selectedId);
  const snap = (value:number) => Number((drag?.snapping ? Math.round(value*4)/4 : value).toFixed(10));
  const worldShift: [number,number] = drag ? drag.worldDelta.map(snap) as [number,number] : [count*2,count*2];
  let displaced = false;
  const entities = clipboard.entities.map(source => {
    const entity = structuredClone(source);
    entity.id = idMap.get(source.id)!;
    entity.name = (source.name.slice(0,75) + ' copy').slice(0,80);
    entity.visible = source.visible;
    if(isBuildingPart(entity)&&entity.materialId)entity.materialId=materialMap.get(entity.materialId)??entity.materialId;
    if (isBuildingPart(entity) || entity.kind === 'unit') {
      const parent = idMap.get(source.parentId) ?? (drag ? undefined : destination?.id) ?? project.entities.find(e => e.kind === 'level' && e.id === source.parentId)?.id;
      if (!parent) throw new Error('Select a destination floor before pasting architectural elements.');
      entity.parentId = parent;
    }
    if (entity.kind === 'unit') entity.memberIds = entity.memberIds.map(id => idMap.get(id)!);
    if (entity.kind === 'level') entity.buildingId = entity.buildingId ? idMap.get(entity.buildingId) : undefined;
    if ('assetId' in entity) entity.assetId = assetMap.get(entity.assetId)!;
    if (entity.kind === 'instance') entity.regionId = entity.regionId ? idMap.get(entity.regionId) : undefined;
    const shift = drag && isBuildingPart(entity) ? localDelta(source.parentId).map(snap) : worldShift;
    // Use the actual snapped movement, including a rotated floor's local grid.
    if ('position' in entity || 'points' in entity) displaced ||= Math.hypot(...worldShift)>0.001;
    if (isBuildingPart(entity) && !idMap.has(source.parentId)) displaced ||= Math.hypot(...shift)>0.001;
    if ('position' in entity) entity.position = [entity.position[0] + worldShift[0], entity.position[1], entity.position[2] + worldShift[1]];
    if(entity.kind==='instance'&&entity.walkingRoute)entity.walkingRoute={...entity.walkingRoute,points:entity.walkingRoute.points.map(p=>[p[0]+worldShift[0],p[1]+worldShift[1]])};
    if ('points' in entity) entity.points = entity.points.map(p => entity.kind === 'river' ? [p[0]+worldShift[0],p[1],p[2]!+worldShift[1]] : [p[0]+worldShift[0],p[1]+worldShift[1]]) as typeof entity.points;
    if (entity.kind === 'wall') {
      entity.junctions = remapWallJunctions(entity,idMap);
      entity.openings = entity.openings?.map((o,i) => ({ ...remapOpeningMaterials(o,materialMap), id: entity.id + '-opening-' + i }));
      if (!idMap.has(source.parentId)) { entity.start = [entity.start[0]+shift[0],entity.start[1]+shift[1]]; entity.end = [entity.end[0]+shift[0],entity.end[1]+shift[1]]; if(entity.curve)entity.curve={...entity.curve,center:[entity.curve.center[0]+shift[0],entity.curve.center[1]+shift[1]]}; }
    }
    if ((entity.kind === 'slab' || entity.kind === 'roof') && !idMap.has(source.parentId)) entity.center = [entity.center[0]+shift[0],entity.center[1]+shift[1]];
    if(entity.kind==='roof'&&entity.cone?.wallId)entity.cone=remapRoofTower(entity,idMap).cone;
    if(entity.kind==='slab'&&entity.stairs?.spiral?.towerId)entity.stairs=remapSpiralTower(entity,idMap).stairs;
    if(entity.kind==='slab'&&entity.stairs?.connections)entity.stairs=remapStairConnections(entity,idMap,idMap.has(source.parentId)?[0,0]:shift as [number,number]).stairs;
    return entity;
  });
  const newTypes:TowerType[]=[],typeMap=new Map<string,string>();
  for(const [i,type] of (clipboard.towerTypes??[]).entries()){
    const existing=project.towerTypes?.find(t=>t.id===type.id),same=existing&&JSON.stringify(existing)===JSON.stringify(type),id=same?existing.id:existing?`${prefix}-tower-type-${i}`:type.id;
    typeMap.set(type.id,id);if(!same)newTypes.push({...type,id});
  }
  const towers=clipboard.towerAssemblies?.map((t,i)=>{const id=`${prefix}-tower-${i}`;return {...t,id,typeId:typeMap.get(t.typeId)!,levelId:idMap.get(t.levelId)!,parts:Object.fromEntries(TOWER_PART_KEYS.map(k=>[k,idMap.get(t.parts[k])??`${id}-${k}`])) as TowerAssembly['parts']};});
  const insert:Command={ type: 'insert', entities, assets,...(towers?.length?{towerTypes:newTypes,towerAssemblies:towers}:{}), objectLayers:Object.fromEntries(clipboard.entities.flatMap(e=>{const layer=clipboard.objectLayers?.[e.id];return layer&&project.layers.some(l=>l.id===layer)?[[idMap.get(e.id)!,layer]]:[];})) };
  const command:Command=withMaterials(insert);
  applyCommand(project, command);
  return { command, selectedIds: clipboard.roots.map(id => idMap.get(id)!), displaced };
}
