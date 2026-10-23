import { layerSchema, layerIssue, defaultLayers } from './layers';
import { z } from 'zod';
import { architectureIssue, wallLength } from './architecture';
import { createHeightfield, lakeIssue, lakeRiverOverlap, regionIssue, pointSegmentDistance, riverIssue, sampleHeight, terrainSchema, walkingRouteIssue } from '@openlandcraft/landscape';
import { assetSchema, glbByteLength, MAX_ASSET_BYTES } from './assets';
import { assetAnimation } from './asset-animation';
import { terrainMaterialsSchema, waterAppearanceSchema, TERRAIN_MATERIAL_DEFAULTS, WATER_APPEARANCE_DEFAULTS } from './materials';
import { riverWaterSchema, RIVER_WATER_DEFAULTS } from './river-water';
import {stairConnectionsIssue} from './stair-connections';
import {architecturalMaterialSchema,ARCHITECTURAL_MATERIAL_DEFAULTS} from './architectural-materials';
import {openingJoinerySchema,openingJoineryIssue} from './opening-joinery';

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
const legacyOceanSchema = z.object({
  ...base, kind: z.literal('ocean'),
  level: finite.min(-8).max(8), amplitude: finite.min(0).max(0.8),
  speed: finite.min(0).max(3), color,
}).strict();
export const COAST_DEFAULTS = { breaker: 1, foam: 0.65, foamPersistence: 6, swash: 1.1, wetSand: 0.8, dryingTime: 30 } as const;
export const OCEAN_DEFAULTS = { level: 0, amplitude: 0.16, speed: 0.8, direction: 20, wavelength: 10, color: '#3e8e90', ...COAST_DEFAULTS } as const;
const versionFiveOceanSchema = legacyOceanSchema.extend({ direction: finite.min(0).max(360), wavelength: finite.min(4).max(40) });
const versionSixOceanSchema = versionFiveOceanSchema.extend({ breaker: finite.min(0).max(2), foam: finite.min(0).max(1), foamPersistence: finite.min(1).max(20), swash: finite.min(0).max(2), wetSand: finite.min(0).max(1), dryingTime: finite.min(5).max(90) });
export const oceanSchema = versionSixOceanSchema.extend({ appearance: waterAppearanceSchema });
const rotation = finite.min(-360).max(360);
const localPoint = z.tuple([finite.min(-100).max(100), finite.min(-100).max(100)]);
export const legacyInstanceSchema = z.object({ ...base, kind: z.literal('instance'), assetId: z.string(), position, rotation,
  scale: z.tuple([finite.min(0.05).max(20), finite.min(0.05).max(20), finite.min(0.05).max(20)]), anchor: z.enum(['terrain', 'fixed']),
}).strict();
const legacyLevelSchema = z.object({ ...base, kind: z.literal('level'), position, rotation }).strict();
export const buildingSchema = z.object({ ...base, kind: z.literal('building') }).strict();
export const levelSchema = legacyLevelSchema.extend({ buildingId: z.string().min(1).max(100).optional(), storeyHeight: finite.min(0.5).max(30).optional() });
export const unitSchema = z.object({ ...base, parentId:z.string().min(1).max(100), kind:z.literal('unit'), memberIds:z.array(z.string().min(1).max(100)).min(1).max(128) }).strict();
const part = { ...base, parentId: z.string().min(1).max(100), color };
export const legacyWallSchema = z.object({ ...part, kind: z.literal('wall'), start: localPoint, end: localPoint,
  height: finite.min(0.2).max(30), thickness: finite.min(0.05).max(2), elevation: finite.min(-10).max(30),
}).strict();
export const legacySlabSchema = z.object({ ...part, kind: z.literal('slab'), center: localPoint,
  width: finite.min(0.5).max(100), depth: finite.min(0.5).max(100), thickness: finite.min(0.05).max(2), elevation: finite.min(-10).max(30),
}).strict();
export const legacyRoofSchema = z.object({ ...part, kind: z.literal('roof'), center: localPoint,
  width: finite.min(0.5).max(100), depth: finite.min(0.5).max(100), rise: finite.min(0.1).max(15), elevation: finite.min(-10).max(40),
}).strict();
const legacyRiverSchema = z.object({ ...base, kind: z.literal('river'),
  points: z.array(z.tuple([finite.min(-100).max(100), finite.min(-8).max(30), finite.min(-100).max(100)])).min(2).max(16),
  width: finite.min(1).max(12), depth: finite.min(0.2).max(5), bank: finite.min(1).max(8), speed: finite.min(0).max(3), color,
}).strict();
const versionSevenRiverSchema = legacyRiverSchema.extend({ appearance: waterAppearanceSchema });
export const riverSchema = versionSevenRiverSchema.extend({ water: riverWaterSchema });
const cornerRounding=z.array(finite.min(0).max(1)).max(16).optional();
const checkCorners=(route:{points:unknown[];cornerRounding?:number[]},ctx:z.RefinementCtx)=>{
  if(route.cornerRounding&&(route.cornerRounding.length!==route.points.length||route.cornerRounding[0]!==0||route.cornerRounding.at(-1)!==0))ctx.addIssue({code:'custom',path:['cornerRounding'],message:'Corner rounding must match the anchors, with unrounded endpoints.'});
};
export const pathSchema = z.object({ ...base, kind: z.literal('path'), points: z.array(localPoint).min(2).max(16),cornerRounding,
  width: finite.min(0.5).max(8), surface: z.enum(['gravel', 'paving', 'timber']), elevationMode: z.literal('terrain'),
}).strict().superRefine(checkCorners);
const versionEightEntitySchema = z.discriminatedUnion('kind', [blockSchema, oceanSchema, legacyInstanceSchema, legacyLevelSchema, legacyWallSchema, legacySlabSchema, legacyRoofSchema, riverSchema]);
const versionNineEntitySchema = z.discriminatedUnion('kind', [...versionEightEntitySchema.options, pathSchema]);
export const lakeSchema = z.object({ ...base, kind:z.literal('lake'), points:z.array(localPoint).min(3).max(24),
  level:finite.min(-8).max(30),depth:finite.min(0.2).max(5),bank:finite.min(1).max(8),
  amplitude:finite.min(0).max(0.3),wavelength:finite.min(1.5).max(12),direction:finite.min(0).max(360),speed:finite.min(0).max(3),
  foam:finite.min(0).max(1),foamPersistence:finite.min(1).max(20),wetBank:finite.min(0).max(1),dryingTime:finite.min(5).max(90),
  color,appearance:waterAppearanceSchema,
}).strict();
const versionTenEntitySchema=z.discriminatedUnion('kind',[...versionNineEntitySchema.options,lakeSchema]);
const versionSixteenInstanceSchema=legacyInstanceSchema.extend({regionId:z.string().min(1).max(100).optional(),characterAnimation:z.enum(['auto','walk','idle']).optional()});
const legacyWalkingRouteSchema=z.object({points:z.array(localPoint).min(2).max(16),width:finite.min(0.5).max(8)}).strict();
const versionSeventeenInstanceSchema=versionSixteenInstanceSchema.extend({walkingRoute:legacyWalkingRouteSchema.optional()});
export const walkingRouteSchema=legacyWalkingRouteSchema.extend({cornerRounding}).superRefine(checkCorners);
export const instanceSchema=versionSixteenInstanceSchema.extend({walkingRoute:walkingRouteSchema.optional()});
const regionBase={...base,points:z.array(localPoint).min(3).max(16)};
export const materialRegionSchema=z.object({...regionBase,kind:z.literal('materialRegion'),surface:z.enum(['grass','sand','rock','gravel']),color,roughness:finite.min(0.3).max(1),detailScale:finite.min(0.25).max(4)}).strict();
export const plantingRegionSchema=z.object({...regionBase,kind:z.literal('plantingRegion'),assetId:z.string().min(1),seed:finite.int().min(0).max(2147483647),density:finite.min(1).max(100),scaleMin:finite.min(0.05).max(5),scaleMax:finite.min(0.05).max(5),spacing:finite.min(0.5).max(15),clearance:finite.min(0).max(10),exclusions:z.object({water:z.boolean(),paths:z.boolean(),buildings:z.boolean()}).strict()}).strict();
const legacyOpeningSchema=z.object({id:z.string().min(1).max(100),kind:z.enum(['door','window']),offset:finite.min(0).max(200),width:finite.min(0.3).max(20),height:finite.min(0.3).max(20),sill:finite.min(0).max(20)}).strict();
const openingProfileSchema=legacyOpeningSchema.extend({offset:finite.min(0).max(650),shape:z.enum(['rectangle','arch']).optional(),archRise:finite.min(0.1).max(20).optional()});
const checkOpeningShape=(o:z.infer<typeof openingProfileSchema>,ctx:z.RefinementCtx)=>{
  if(o.shape==='arch'&&(o.archRise===undefined||o.archRise>o.height-0.1+1e-8))ctx.addIssue({code:'custom',message:'An arch needs a rise of at least 0.1 m and at least 0.1 m of vertical jamb below it.'});
  if(o.shape!=='arch'&&o.archRise!==undefined)ctx.addIssue({code:'custom',message:'Arch rise only applies to arched openings.'});
};
const versionThirtyOpeningSchema=openingProfileSchema.superRefine(checkOpeningShape);
export const openingSchema=openingProfileSchema.extend({joinery:openingJoinerySchema.optional()}).superRefine((o,ctx)=>{checkOpeningShape(o,ctx);const issue=openingJoineryIssue(o);if(issue)ctx.addIssue({code:'custom',message:issue});});
const versionFourteenWallSchema=legacyWallSchema.extend({joins:z.boolean().optional(),openings:z.array(legacyOpeningSchema).max(8).optional()});
const versionEighteenWallSchema=versionFourteenWallSchema.extend({junctions:z.object({start:z.string().min(1).max(100).optional(),end:z.string().min(1).max(100).optional()}).strict().optional()});
export const wallCurveSchema=z.object({center:localPoint,radius:finite.min(0.25).max(100),startAngle:finite.min(-360).max(360),sweepAngle:finite.min(-360).max(360)}).strict();
const versionNineteenWallSchema=versionEighteenWallSchema.extend({curve:wallCurveSchema.optional()});
const versionTwentyTwoWallSchema=versionNineteenWallSchema.extend({openings:z.array(versionThirtyOpeningSchema).max(8).optional()});
export const battlementsSchema=z.object({width:finite.min(.1).max(5),height:finite.min(.1).max(5),spacing:finite.min(.1).max(10)}).strict();
const versionTwentyThreeWallSchema=versionTwentyTwoWallSchema.extend({battlements:battlementsSchema.optional()});
const versionTwentyFiveWalkSchema=z.object({width:finite.min(.5).max(8),thickness:finite.min(.1).max(1),parapetHeight:finite.min(.3).max(3),parapetThickness:finite.min(.05).max(2),side:z.enum(['left','right'])}).strict();
export const railingSchema=z.object({height:finite.min(.3).max(2.5),spacing:finite.min(.2).max(5)}).strict();
const versionTwentySevenWalkSchema=versionTwentyFiveWalkSchema.extend({railings:railingSchema.extend({gap:z.object({position:finite.min(0).max(1),width:finite.min(.5).max(8)}).strict().optional()}).optional()});
const stairWalkOpeningSchema=z.object({stairId:z.string().min(1).max(100),position:finite.min(0).max(1),width:finite.min(.05).max(30),edge:z.enum(['inner','outer'])}).strict();
export const wallWalkSchema=versionTwentySevenWalkSchema.extend({stairOpenings:z.array(stairWalkOpeningSchema).max(32).optional()});
const versionTwentySevenWallSchema=versionTwentyThreeWallSchema.extend({walk:versionTwentySevenWalkSchema.optional()});
const versionTwentyFiveWallSchema=versionTwentyThreeWallSchema.extend({walk:versionTwentyFiveWalkSchema.optional()});
const versionTwentyNineWallSchema=versionTwentyThreeWallSchema.extend({walk:wallWalkSchema.optional()});
const materialReference={materialId:z.string().min(1).max(100).optional()};
const versionThirtyWallSchema=versionTwentyNineWallSchema.extend(materialReference);
export const wallSchema=versionThirtyWallSchema.extend({openings:z.array(openingSchema).max(8).optional()});
const versionTwentyFourSlabSchema=legacySlabSchema.extend({outline:z.array(localPoint).min(3).max(16).optional()});
const versionTwentyFiveStairsSchema=z.object({rise:finite.min(.2).max(30),steps:finite.int().min(1).max(128),direction:rotation}).strict();
const versionTwentySixStairsSchema=versionTwentyFiveStairsSchema.extend({railings:railingSchema.extend({side:z.enum(['left','right','both'])}).optional()});
const versionTwentySevenStairsSchema=versionTwentySixStairsSchema.extend({spiral:z.object({radius:finite.min(.75).max(20),turns:finite.min(.25).max(4),clockwise:z.boolean(),towerId:z.string().min(1).max(100).optional()}).strict().optional()});
const stairLandingSchema=z.object({points:z.array(localPoint).min(3).max(128),elevation:finite.min(-10).max(60),base:finite.min(-20).max(60),railPaths:z.array(z.object({side:z.enum(['left','right']),points:z.array(localPoint).min(2).max(128)}).strict()).max(4)}).strict();
const versionTwentyEightConnectionsSchema=z.object({bottom:z.object({point:localPoint,depth:finite.min(.5).max(4)}).strict().optional(),top:z.object({wallId:z.string().min(1).max(100),position:finite.min(0).max(1),edge:z.enum(['inner','outer']),depth:finite.min(.5).max(4)}).strict().optional()}).strict();
const versionTwentyEightStairsSchema=versionTwentySevenStairsSchema.extend({connections:versionTwentyEightConnectionsSchema.optional(),landings:z.object({bottom:stairLandingSchema.optional(),top:stairLandingSchema.optional()}).strict().optional()});
const versionTwentyFiveSlabSchema=versionTwentyFourSlabSchema.extend({stairs:versionTwentyFiveStairsSchema.optional()});
const versionTwentySixSlabSchema=versionTwentyFourSlabSchema.extend({stairs:versionTwentySixStairsSchema.optional()});
const versionTwentySevenSlabSchema=versionTwentyFourSlabSchema.extend({stairs:versionTwentySevenStairsSchema.optional()});
const versionTwentyEightSlabSchema=versionTwentyFourSlabSchema.extend({stairs:versionTwentyEightStairsSchema.optional()});
const floorReference={floorId:z.string().min(1).max(100).optional(),point:localPoint,depth:finite.min(.5).max(4)};
export const stairConnectionsSchema=z.object({bottom:z.object(floorReference).strict().optional(),top:z.object({wallId:z.string().min(1).max(100).optional(),position:finite.min(0).max(1).optional(),edge:z.enum(['inner','outer']).optional(),floorId:z.string().min(1).max(100).optional(),point:localPoint.optional(),depth:finite.min(.5).max(4)}).strict().superRefine((c,ctx)=>{if(c.floorId?c.wallId!==undefined||c.position!==undefined||c.edge!==undefined||!c.point:!c.wallId||c.position===undefined||!c.edge||c.point!==undefined)ctx.addIssue({code:'custom',message:'Choose either a floor connection or a wall-walk connection.'});}).optional()}).strict();
export const stairsSchema=versionTwentyEightStairsSchema.extend({connections:stairConnectionsSchema.optional()});
const versionTwentyNineSlabSchema=versionTwentyFourSlabSchema.extend({stairs:stairsSchema.optional(),stairOpenings:z.array(z.object({stairId:z.string().min(1).max(100),points:z.array(localPoint).min(3).max(128)}).strict()).max(32).optional()});
export const slabSchema=versionTwentyNineSlabSchema.extend(materialReference);
const versionTwentyRoofSchema=legacyRoofSchema.extend({outline:z.array(localPoint).min(3).max(16).optional()});
const versionTwentyOneRoofSchema=versionTwentyRoofSchema.extend({width:finite.min(.5).max(200),depth:finite.min(.5).max(200),cone:z.object({radius:finite.min(.25).max(100),overhang:finite.min(0).max(10)}).strict().optional()});
const versionTwentyNineRoofSchema=versionTwentyOneRoofSchema.extend({cone:z.object({radius:finite.min(.25).max(100),overhang:finite.min(0).max(10),wallId:z.string().min(1).max(100).optional()}).strict().optional()});
export const roofSchema=versionTwentyNineRoofSchema.extend(materialReference);
const versionElevenEntitySchema=z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,legacyLevelSchema,legacyWallSchema,legacySlabSchema,legacyRoofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema]);
const versionTwelveEntitySchema=z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,legacyLevelSchema,versionFourteenWallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema]);
const versionFourteenEntitySchema=z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionFourteenWallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema]);
export const entitySchema=z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,wallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema]);
const envelope = {
  format: z.literal('openlandcraft.project'),
  name: z.string().trim().min(1).max(100), units: z.literal('m'), upAxis: z.literal('Y'),
  entities: z.array(entitySchema).max(1000),
};
const legacyEnvelope = { ...envelope, entities: z.array(z.discriminatedUnion('kind', [blockSchema, legacyOceanSchema, legacyInstanceSchema, legacyLevelSchema, legacyWallSchema, legacySlabSchema, legacyRoofSchema, legacyRiverSchema])).max(1000) };
const siteSchema = z.object({
    id: z.literal('site'), width: finite.min(20).max(200), depth: finite.min(20).max(200),
    shoreX: finite.min(-20).max(20), slope: finite.min(0.05).max(0.5),
}).strict();
const legacyProjectSchema = z.object({ ...legacyEnvelope, version: z.literal(1), site: siteSchema }).strict();
const versionTwoSchema = z.object({ ...legacyEnvelope, version: z.literal(2), site: siteSchema.extend({ terrain: terrainSchema }) }).strict();
const versionThreeSchema = z.object({ ...legacyEnvelope, version: z.literal(3), site: siteSchema.extend({ terrain: terrainSchema }), assets: z.array(assetSchema).max(16) }).strict();
const versionFourSchema = versionThreeSchema.extend({ version: z.literal(4) });
const versionFiveSchema = z.object({ ...envelope, entities: z.array(z.discriminatedUnion('kind', [blockSchema, versionFiveOceanSchema, legacyInstanceSchema, legacyLevelSchema, legacyWallSchema, legacySlabSchema, legacyRoofSchema, legacyRiverSchema])).max(1000), version: z.literal(5), site: siteSchema.extend({ terrain: terrainSchema }), assets: z.array(assetSchema).max(16) }).strict();
const versionSixSchema = versionFiveSchema.extend({ version:z.literal(6), entities:z.array(z.discriminatedUnion('kind',[blockSchema,versionSixOceanSchema,legacyInstanceSchema,legacyLevelSchema,legacyWallSchema,legacySlabSchema,legacyRoofSchema,legacyRiverSchema])).max(1000) });
const versionSevenSchema = versionSixSchema.extend({ version:z.literal(7), site:siteSchema.extend({terrain:terrainSchema,materials:terrainMaterialsSchema}), entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,legacyInstanceSchema,legacyLevelSchema,legacyWallSchema,legacySlabSchema,legacyRoofSchema,versionSevenRiverSchema])).max(1000) });
const versionEightSchema = versionSevenSchema.extend({ version: z.literal(8), entities: z.array(versionEightEntitySchema).max(1000) });
const versionNineSchema = versionEightSchema.extend({version:z.literal(9),entities:z.array(versionNineEntitySchema).max(1000)});
const versionTenSchema=versionNineSchema.extend({version:z.literal(10),entities:z.array(versionTenEntitySchema).max(1000)});
const versionElevenSchema=versionTenSchema.extend({version:z.literal(11),entities:z.array(versionElevenEntitySchema).max(1000)});
const versionTwelveSchema=versionElevenSchema.extend({version:z.literal(12),entities:z.array(versionTwelveEntitySchema).max(1000)});
const versionThirteenSchema = z.object({ ...envelope, entities:z.array(versionFourteenEntitySchema).max(1000), version: z.literal(13), site: siteSchema.extend({ terrain: terrainSchema, materials: terrainMaterialsSchema }), assets: z.array(assetSchema).max(16) }).strict();
const versionFourteenSchema = versionThirteenSchema.extend({ version: z.literal(14), layers: z.array(layerSchema).min(1).max(256), objectLayers: z.record(z.string(), z.string()), activeLayerId: z.string().nullable() });
const versionFifteenSchema = versionFourteenSchema.extend({version:z.literal(15),entities:z.array(entitySchema).max(1000)});
const versionSixteenSchema = versionFifteenSchema.extend({version:z.literal(16),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,versionSixteenInstanceSchema,levelSchema,wallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionSeventeenSchema=versionFifteenSchema.extend({version:z.literal(17),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,versionSeventeenInstanceSchema,levelSchema,wallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionEighteenSchema=versionFifteenSchema.extend({version:z.literal(18),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionEighteenWallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionNineteenSchema=versionFifteenSchema.extend({version:z.literal(19),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionNineteenWallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentySchema=versionFifteenSchema.extend({version:z.literal(20),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,wallSchema,slabSchema,versionTwentyRoofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentyOneSchema=versionFifteenSchema.extend({version:z.literal(21),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,wallSchema,slabSchema,versionTwentyOneRoofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentyTwoSchema=versionFifteenSchema.extend({version:z.literal(22),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionTwentyTwoWallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentyThreeSchema=versionFifteenSchema.extend({version:z.literal(23),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionTwentyThreeWallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentyFourSchema=versionFifteenSchema.extend({version:z.literal(24),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionTwentyFiveWallSchema,versionTwentyFourSlabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentyFiveSchema=versionFifteenSchema.extend({version:z.literal(25),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionTwentyFiveWallSchema,versionTwentyFiveSlabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentySixSchema=versionFifteenSchema.extend({version:z.literal(26),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionTwentySevenWallSchema,versionTwentySixSlabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentySevenSchema=versionFifteenSchema.extend({version:z.literal(27),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionTwentySevenWallSchema,versionTwentySevenSlabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentyEightSchema=versionFifteenSchema.extend({version:z.literal(28),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,wallSchema,versionTwentyEightSlabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionTwentyNineSchema=versionFifteenSchema.extend({version:z.literal(29),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionTwentyNineWallSchema,versionTwentyNineSlabSchema,versionTwentyNineRoofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
const versionThirtySchema=versionFifteenSchema.extend({version:z.literal(30),architecturalMaterials:z.array(architecturalMaterialSchema).max(64).optional(),entities:z.array(z.discriminatedUnion('kind',[blockSchema,oceanSchema,instanceSchema,levelSchema,versionThirtyWallSchema,slabSchema,roofSchema,riverSchema,pathSchema,lakeSchema,materialRegionSchema,plantingRegionSchema,buildingSchema,unitSchema])).max(1000)});
export const projectSchema = versionFifteenSchema.extend({version:z.literal(31),architecturalMaterials:z.array(architecturalMaterialSchema).max(64).optional()}).superRefine((project, ctx) => {
  const materials=project.architecturalMaterials??ARCHITECTURAL_MATERIAL_DEFAULTS,materialIds=new Set(materials.map(m=>m.id));
  if(materialIds.size!==materials.length)ctx.addIssue({code:'custom',path:['architecturalMaterials'],message:'Shared material IDs must be unique.'});
  for(const e of project.entities)if((e.kind==='wall'||e.kind==='slab'||e.kind==='roof')&&e.materialId&&!materialIds.has(e.materialId))ctx.addIssue({code:'custom',path:['entities'],message:'Architectural elements must reference an existing shared material.'});
  for(const e of project.entities)if(e.kind==='wall')for(const o of e.openings??[])for(const component of [o.joinery?.frame,o.joinery?.panel])if(component?.materialId&&!materialIds.has(component.materialId))ctx.addIssue({code:'custom',path:['entities'],message:'Opening frames and panels must reference an existing shared material.'});
  const layersError = layerIssue(project, new Set(['terrain', ...project.entities.map(e => e.id)]));
  if (layersError) ctx.addIssue({code:'custom',path:['layers'],message:layersError});
  const architectureError=architectureIssue(project.entities);
  if(architectureError)ctx.addIssue({code:'custom',path:['entities'],message:architectureError});
  const stairError=stairConnectionsIssue(project);if(stairError)ctx.addIssue({code:'custom',path:['entities'],message:stairError});
  const unitMembers=new Set<string>();
  for(const entity of project.entities){
    if(entity.kind==='level'&&entity.buildingId&&!project.entities.some(e=>e.id===entity.buildingId&&e.kind==='building'))ctx.addIssue({code:'custom',path:['entities'],message:'A floor must reference an existing building.'});
    if(entity.kind==='unit')for(const id of entity.memberIds){
      const member=project.entities.find(e=>e.id===id);
      if(!member||!['wall','slab','roof'].includes(member.kind)||member.parentId!==entity.parentId)ctx.addIssue({code:'custom',path:['entities'],message:'Unit members must be architectural elements on the same floor.'});
      if(unitMembers.has(id))ctx.addIssue({code:'custom',path:['entities'],message:'An element can belong to only one unit.'});
      unitMembers.add(id);
    }
  }
  const ids = new Set<string>(['site', 'terrain']);
  let oceans = 0;
  project.entities.forEach((entity, index) => {
    if (ids.has(entity.id)) ctx.addIssue({ code: 'custom', path: ['entities', index, 'id'], message: 'Entity IDs must be unique.' });
    ids.add(entity.id);
    if (entity.kind === 'ocean') oceans++;
  });
  if (oceans > 1) ctx.addIssue({ code: 'custom', path: ['entities'], message: 'This version supports one ocean surface.' });
  const lakes=project.entities.filter(entity=>entity.kind==='lake');
  if(lakes.length>1)ctx.addIssue({code:'custom',path:['entities'],message:'This version supports one lake.'});
  for(const lake of lakes){
    const river=project.entities.find(entity=>entity.kind==='river'),ocean=project.entities.find(entity=>entity.kind==='ocean');
    if(river&&lakeRiverOverlap(lake,river))ctx.addIssue({code:'custom',path:['entities'],message:'Keep the lake and river banks separate. Connected water bodies are not supported yet.'});
    if(ocean&&lake.level<ocean.level+0.5)ctx.addIssue({code:'custom',path:['entities'],message:'Keep the inland lake level at least 0.5 m above the ocean.'});
  }
  if (project.entities.filter(entity => entity.kind === 'path').length > 1) ctx.addIssue({ code: 'custom', path: ['entities'], message: 'This version supports one unbranched path.' });
  if (project.entities.filter((entity) => entity.kind === 'river').length > 1) ctx.addIssue({ code: 'custom', path: ['entities'], message: 'This version supports one unbranched river.' });
  const regions=project.entities.filter(e=>e.kind==='materialRegion'||e.kind==='plantingRegion');
  if(regions.length>8)ctx.addIssue({code:'custom',path:['entities'],message:'This version supports up to eight landscape regions.'});
  if(project.entities.filter(e=>e.kind==='instance'&&e.regionId).length>500)ctx.addIssue({code:'custom',path:['entities'],message:'Keep generated planting within 500 instances across the scene.'});
  for(const region of regions){
    const issue=regionIssue(region.points,project.site);if(issue)ctx.addIssue({code:'custom',path:['entities'],message:issue});
    if(region.kind==='plantingRegion'){
      if(region.scaleMin>region.scaleMax)ctx.addIssue({code:'custom',path:['entities'],message:'Minimum planting scale must not exceed maximum scale.'});
      if(!project.assets.some(a=>a.id===region.assetId))ctx.addIssue({code:'custom',path:['entities'],message:'Choose an embedded model for the planting region.'});
      if(project.entities.filter(e=>e.kind==='instance'&&e.regionId===region.id).length>200)ctx.addIssue({code:'custom',path:['entities'],message:'Keep each planting region within 200 generated instances.'});
    }
  }
  for(const e of project.entities)if(e.kind==='instance'&&e.regionId){
    const owner=regions.find(r=>r.id===e.regionId);
    if(owner?.kind!=='plantingRegion'||owner.assetId!==e.assetId||e.anchor!=='terrain')ctx.addIssue({code:'custom',path:['entities'],message:'Generated plants must reference a matching planting region and follow terrain.'});
  }
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  if (assetIds.size !== project.assets.length) ctx.addIssue({ code: 'custom', path: ['assets'], message: 'Asset IDs must be unique.' });
  if (project.assets.reduce((sum, asset) => sum + glbByteLength(asset.data), 0) > MAX_ASSET_BYTES) ctx.addIssue({ code: 'custom', path: ['assets'], message: 'The asset library exceeds 24 MB.' });
  project.entities.forEach((entity, index) => {
    if (entity.kind === 'instance' && entity.walkingRoute) { const issue = walkingRouteIssue(entity.walkingRoute,project.site); if (issue) ctx.addIssue({code:'custom',path:['entities',index,'walkingRoute'],message:issue}); }
    if(entity.kind==='lake'){const issue=lakeIssue(entity,project.site,project.site.terrain);if(issue)ctx.addIssue({code:'custom',path:['entities',index,'points'],message:issue});}
    if (entity.kind === 'path') { const issue = walkingRouteIssue(entity, project.site); if (issue) ctx.addIssue({ code: 'custom', path: ['entities', index, 'points'], message: issue }); }
    if (entity.kind === 'river') { const issue = riverIssue(entity, project.site, project.site.terrain); if (issue) ctx.addIssue({ code: 'custom', path: ['entities', index, 'points'], message: issue }); }
    if (entity.kind === 'instance' && !assetIds.has(entity.assetId)) ctx.addIssue({ code: 'custom', path: ['entities', index, 'assetId'], message: 'The embedded model is missing.' });
    if (entity.parentId !== 'site' && !project.entities.some((level) => level.id === entity.parentId && level.kind === 'level')) ctx.addIssue({ code: 'custom', path: ['entities', index, 'parentId'], message: 'Building elements must belong to an existing level.' });
    if (['wall', 'slab', 'roof'].includes(entity.kind) && entity.parentId === 'site') ctx.addIssue({ code: 'custom', path: ['entities', index, 'parentId'], message: 'Choose a building level for this element.' });
    if (entity.kind === 'wall' && wallLength(entity) < 0.2) ctx.addIssue({ code: 'custom', path: ['entities', index, 'end'], message: 'Walls must be at least 0.2 m long.' });
  });
});

export type Block = z.infer<typeof blockSchema>;
export type Ocean = z.infer<typeof oceanSchema>;
export type Instance = z.infer<typeof instanceSchema>;
export type WalkingRoute = z.infer<typeof walkingRouteSchema>;
export type MaterialRegion=z.infer<typeof materialRegionSchema>;
export type PlantingRegion=z.infer<typeof plantingRegionSchema>;
export type Region=MaterialRegion|PlantingRegion;
export type Level = z.infer<typeof levelSchema>;
export type Building = z.infer<typeof buildingSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Opening = z.infer<typeof openingSchema>;
export type Wall = z.infer<typeof wallSchema>;
export type Slab = z.infer<typeof slabSchema>;
export type Roof = z.infer<typeof roofSchema>;
export type BuildingPart = Wall | Slab | Roof;
export type River = z.infer<typeof riverSchema>;
export type Path = z.infer<typeof pathSchema>;
export type Lake = z.infer<typeof lakeSchema>;
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
  if (candidate && typeof candidate === 'object' && 'version' in candidate && candidate.version === 4) {
    const legacy = versionFourSchema.safeParse(candidate);
    if (legacy.success) candidate = { ...legacy.data, version: 5, entities: legacy.data.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, direction: OCEAN_DEFAULTS.direction, wavelength: OCEAN_DEFAULTS.wavelength } : entity) };
  }
  if (candidate && typeof candidate === 'object' && 'version' in candidate && candidate.version === 5) {
    const legacy = versionFiveSchema.safeParse(candidate);
    if (legacy.success) candidate = { ...legacy.data, version: 6, entities: legacy.data.entities.map((entity) => entity.kind === 'ocean' ? { ...entity, ...COAST_DEFAULTS } : entity) };
  }
  if (candidate && typeof candidate === 'object' && 'version' in candidate && candidate.version === 6) {
    const legacy=versionSixSchema.safeParse(candidate);
    if(legacy.success) candidate={...legacy.data,version:7,site:{...legacy.data.site,materials:{...TERRAIN_MATERIAL_DEFAULTS}},entities:legacy.data.entities.map(entity=>entity.kind==='ocean'||entity.kind==='river'?{...entity,appearance:{...WATER_APPEARANCE_DEFAULTS}}:entity)};
  }
  if (candidate && typeof candidate === 'object' && 'version' in candidate && candidate.version === 7) {
    const legacy = versionSevenSchema.safeParse(candidate);
    if (legacy.success) candidate = { ...legacy.data, version:8, entities:legacy.data.entities.map(entity=>entity.kind==='river'?{...entity,water:{...RIVER_WATER_DEFAULTS}}:entity) };
  }
  if (candidate && typeof candidate === 'object' && 'version' in candidate && candidate.version === 8) {
    const legacy = versionEightSchema.safeParse(candidate);
    if (legacy.success) candidate = { ...legacy.data, version: 9 };
  }
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===9){const legacy=versionNineSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:10};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===10){const legacy=versionTenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:11};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===11){const legacy=versionElevenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:12};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===12){const legacy=versionTwelveSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:13};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===13){const legacy=versionThirteenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:14,layers:defaultLayers(),objectLayers:{},activeLayerId:'default'};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===14){const legacy=versionFourteenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:15};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===15){const legacy=versionFifteenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:16};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===16){
    const legacy=versionSixteenSchema.safeParse(candidate);
    if(legacy.success){
      const path=legacy.data.entities.filter(entity=>entity.visible).find(entity=>entity.kind==='path');
      const people=new Set(legacy.data.assets.filter(asset=>assetAnimation(asset)==='person-walk-v1').map(asset=>asset.id));
      candidate={...legacy.data,version:17,entities:legacy.data.entities.map(entity=>entity.kind==='instance'&&people.has(entity.assetId)&&path&&(entity.characterAnimation==='walk'||path.points.slice(1).some((point,i)=>pointSegmentDistance([entity.position[0],entity.position[2]],path.points[i],point)<=Math.max(5,path.width/2+2)))
        ? {...entity,walkingRoute:{points:path.points.map(point=>[...point]),width:path.width}}
        : entity)};
    }
  }
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===17){const legacy=versionSeventeenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:18};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===18){const legacy=versionEighteenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:19};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===19){const legacy=versionNineteenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:20};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===20){const legacy=versionTwentySchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:21};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===21){const legacy=versionTwentyOneSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:22};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===22){const legacy=versionTwentyTwoSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:23};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===23){const legacy=versionTwentyThreeSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:24};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===24){const legacy=versionTwentyFourSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:25};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===25){const legacy=versionTwentyFiveSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:26};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===26){const legacy=versionTwentySixSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:27};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===27){const legacy=versionTwentySevenSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:28};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===28){const legacy=versionTwentyEightSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:29};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===29){const legacy=versionTwentyNineSchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:30};}
  if(candidate&&typeof candidate==='object'&&'version' in candidate&&candidate.version===30){const legacy=versionThirtySchema.safeParse(candidate);if(legacy.success)candidate={...legacy.data,version:31};}
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
  const site = { ...baseSite, materials:{...TERRAIN_MATERIAL_DEFAULTS}, terrain: createHeightfield(baseSite, (x, z) => coastHeight(x, z, baseSite)) };
  const block = (id: string, name: string, x: number, z: number, size: Block['size'], color: string): Block => ({
    id, name, kind: 'block', parentId: 'site', visible: true,
    position: [x, groundHeight(x, z, site) + 0.15, z], size, rotation: 0, color,
  });
  return parseProject({
    format: 'openlandcraft.project', version: 13, assets: [], name: 'Coastal study', units: 'm', upAxis: 'Y', site,
    entities: [
      block('block-pavilion', 'Pavilion 01', -13, 1, [10, 4, 7], '#e4ded1'),
      block('block-studio', 'Studio 02', -22, -10, [7, 3, 5], '#c4ccba'),
      block('block-terrace', 'Terrace 03', -12, -10, [8, 0.5, 5], '#b8ac98'),
      createOcean('ocean-main'),
    ],
  });
}

export function createSite(options: { name: string; width: number; depth: number; resolution: 129 | 257; preset: 'coast' | 'flat' }): Project {
  const baseSite = siteSchema.parse({ id: 'site', width: options.width, depth: options.depth, shoreX: 1, slope: 0.16 });
  const terrain = createHeightfield(baseSite, (x, z) => options.preset === 'flat' ? 2 : coastHeight(x, z, baseSite), options.resolution, options.resolution);
  return parseProject({ format: 'openlandcraft.project', version: 13, name: options.name, units: 'm', upAxis: 'Y', site: { ...baseSite, terrain, materials:{...TERRAIN_MATERIAL_DEFAULTS} }, assets: [],
    entities: options.preset === 'coast' ? [createOcean('ocean-main')] : [] });
}

export function createOcean(id: string = crypto.randomUUID()): Ocean {
  return { id, name: 'Coastal water', kind: 'ocean', parentId: 'site', visible: true, ...OCEAN_DEFAULTS, appearance:{...WATER_APPEARANCE_DEFAULTS} };
}
