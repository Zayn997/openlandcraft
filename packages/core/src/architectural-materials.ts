import {z} from 'zod';
import type {BuildingPart,Project} from './model';

export const architecturalMaterialSchema=z.object({
 id:z.string().min(1).max(100),name:z.string().trim().min(1).max(80),
 pattern:z.enum(['stone','timber','roof']),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),
 scale:z.number().finite().min(.1).max(20),roughness:z.number().finite().min(.05).max(1),
}).strict();
export type ArchitecturalMaterial=z.infer<typeof architecturalMaterialSchema>;
/** Built-in patterns are generated locally; no remote texture dependencies. Scale is metres per repeat. */
export const ARCHITECTURAL_MATERIAL_DEFAULTS:ArchitecturalMaterial[]=[
 {id:'castle-stone',name:'Castle stone',pattern:'stone',color:'#b4aa94',scale:2,roughness:.92},
 {id:'castle-timber',name:'Castle timber',pattern:'timber',color:'#89613d',scale:1.5,roughness:.75},
 {id:'castle-roof',name:'Castle roof slate',pattern:'roof',color:'#53616a',scale:1.2,roughness:.7},
];
export const architecturalMaterials=(project:Pick<Project,'architecturalMaterials'>)=>project.architecturalMaterials??ARCHITECTURAL_MATERIAL_DEFAULTS;
export const architecturalMaterialFor=(project:Pick<Project,'architecturalMaterials'>,part:BuildingPart)=>part.materialId?architecturalMaterials(project).find(m=>m.id===part.materialId):undefined;
export const partMaterialIds=(part:BuildingPart):string[]=>[...(part.materialId?[part.materialId]:[]),...(part.kind==='wall'?(part.openings??[]).flatMap(o=>[o.joinery?.frame?.materialId,o.joinery?.panel?.materialId].filter((id):id is string=>!!id)):[])];
export const architecturalMaterialUsers=(project:Project,id:string)=>project.entities.filter((e):e is BuildingPart=>(e.kind==='wall'||e.kind==='slab'||e.kind==='roof')&&partMaterialIds(e).includes(id));
export function architecturalMaterialTargets(project:Project,ids:readonly string[]):BuildingPart[]{
 const scope=new Set(ids);let size=-1;
 while(size!==scope.size){size=scope.size;for(const e of project.entities){if(scope.has(e.parentId)||e.kind==='level'&&e.buildingId&&scope.has(e.buildingId))scope.add(e.id);if(e.kind==='unit'&&scope.has(e.id))e.memberIds.forEach(id=>scope.add(id));}}
 return project.entities.filter((e):e is BuildingPart=>scope.has(e.id)&&(e.kind==='wall'||e.kind==='slab'||e.kind==='roof'));
}
