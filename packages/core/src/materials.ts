import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.');
export const terrainMaterialsSchema = z.object({
  sand: color, grass: color, rock: color,
  scale: z.number().finite().min(0.25).max(4),
  roughness: z.number().finite().min(0.3).max(1),
  rockSlope: z.number().finite().min(20).max(75),
}).strict();
export const waterAppearanceSchema = z.object({
  clarity: z.number().finite().min(0.25).max(3),
  roughness: z.number().finite().min(0).max(1),
  rippleScale: z.number().finite().min(0.25).max(4),
}).strict();
export type TerrainMaterials = z.infer<typeof terrainMaterialsSchema>;
export type WaterAppearance = z.infer<typeof waterAppearanceSchema>;

export const TERRAIN_MATERIAL_DEFAULTS: TerrainMaterials = {sand:'#c7b89f',grass:'#869777',rock:'#898a80',scale:1,roughness:0.95,rockSlope:48};
export const WATER_APPEARANCE_DEFAULTS: WaterAppearance = {clarity:1,roughness:0.3,rippleScale:1};
export const TERRAIN_PRESETS = [
  {id:'coastal',name:'Coastal',value:TERRAIN_MATERIAL_DEFAULTS},
  {id:'woodland',name:'Woodland',value:{sand:'#afa68d',grass:'#687c55',rock:'#858b88',scale:0.8,roughness:0.95,rockSlope:42}},
  {id:'arid',name:'Arid',value:{sand:'#cfb48a',grass:'#a4a071',rock:'#aa8a70',scale:1.5,roughness:0.9,rockSlope:35}},
] satisfies {id:string;name:string;value:TerrainMaterials}[];
export const WATER_PRESETS = [
  {id:'clear',name:'Clear coastal',color:'#28786f',value:WATER_APPEARANCE_DEFAULTS},
  {id:'blue',name:'Cool blue',color:'#326b91',value:{clarity:1.5,roughness:0.4,rippleScale:1.3}},
  {id:'silt',name:'Silty green',color:'#65785c',value:{clarity:0.35,roughness:0.22,rippleScale:0.7}},
] satisfies {id:string;name:string;color:string;value:WaterAppearance}[];
