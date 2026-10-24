import {z} from 'zod';
import type {BuildingPart,Entity,Level,Project,Roof,Slab,Wall} from './model';
import {createCurvedWall,updateCurvedWall} from './curved-walls';
import {conicalRoofForTower,setConicalRoofTower} from './conical-roofs';
import {replaceJoinedWall} from './architecture';
import {architecturalMaterials} from './architectural-materials';
import {circularFloorIssue} from './circular-floors';
const n=z.number().finite(),id=z.string().min(1).max(100);
export const towerParametersSchema=z.object({radius:n.min(1.5).max(30),height:n.min(3).max(30),thickness:n.min(.1).max(2),floorCount:n.int().min(1).max(8),battlementSpacing:n.min(.1).max(10),top:z.enum(['battlements','roof']),roofHeight:n.min(.1).max(15),overhang:n.min(0).max(5)}).strict();
export const towerTypeSchema=towerParametersSchema.extend({id,name:z.string().trim().min(1).max(80)});
export const TOWER_PART_KEYS=['wall','roof','floor0','floor1','floor2','floor3','floor4','floor5','floor6','floor7'] as const;
const key=z.enum(TOWER_PART_KEYS),field=z.enum(['radius','center','elevation','height','thickness','battlementSpacing','top','roofHeight','overhang']);
export const towerAssemblySchema=z.object({id:z.string().min(1).max(64),typeId:id,levelId:id,parts:z.record(key,id),parameters:towerParametersSchema.partial().optional(),overrides:z.partialRecord(key,z.array(field).max(9)).optional(),edited:z.array(key).max(10).optional(),detached:z.array(key).max(10).optional()}).strict();
export type TowerParameters=z.infer<typeof towerParametersSchema>;
export type TowerType=z.infer<typeof towerTypeSchema>;
export type TowerAssembly=z.infer<typeof towerAssemblySchema>;
export type TowerPartKey=typeof TOWER_PART_KEYS[number];
export const DEFAULT_TOWER:TowerParameters={radius:6,height:12,thickness:.6,floorCount:3,battlementSpacing:1,top:'battlements',roofHeight:4,overhang:.5};
export function towerParameters(p:Pick<Project,'towerTypes'>,tower:TowerAssembly):TowerParameters{const {id,name,...values}=p.towerTypes!.find(t=>t.id===tower.typeId)!;return {...values,...tower.parameters};}
export function towerOwner(p:Pick<Project,'towerAssemblies'>,id:string|null){return id?p.towerAssemblies?.find(t=>t.levelId===id||TOWER_PART_KEYS.some(k=>t.parts[k]===id&&!t.detached?.includes(k))):undefined;}
export function towerPart(t:TowerAssembly,id:string):TowerPartKey|undefined{return TOWER_PART_KEYS.find(k=>t.parts[k]===id&&!t.detached?.includes(k));}
export function towerParameterIssue(p:TowerParameters):string|null{
 if(p.radius<=p.thickness/2+.5)return 'Leave at least 0.5 m of clear radius inside the tower wall.';
 if(p.height/p.floorCount<2)return 'Keep at least 2 m of tower height per floor.';
 return null;
}
export function newTower(typeId:string,position:[number,number,number],assemblyId:string=crypto.randomUUID()):{tower:TowerAssembly;level:Level}{
 const levelId=assemblyId+'-level';
 return {tower:{id:assemblyId,typeId,levelId,parts:Object.fromEntries(TOWER_PART_KEYS.map(k=>[k,assemblyId+'-'+k])) as TowerAssembly['parts']},level:{id:levelId,parentId:'site',kind:'level',name:'Tower',visible:true,position,rotation:0}};
}
type TowerDocument={entities:Entity[];towerTypes?:TowerType[];towerAssemblies?:TowerAssembly[];site:{width:number;depth:number}};
export function towerIssue(p:TowerDocument):string|null{
 const types=p.towerTypes??[],towers=p.towerAssemblies??[];
 if(new Set(types.map(t=>t.id)).size!==types.length)return 'Tower type IDs must be unique.';
 for(const type of types){const issue=towerParameterIssue(type);if(issue)return issue;}
 const ids=new Set<string>(),levels=new Set<string>(),parts=new Set<string>();
 for(const t of towers){
  if(ids.has(t.id)||p.entities.some(e=>e.id===t.id))return 'Tower assembly IDs must be unique.';ids.add(t.id);
  if(!types.some(type=>type.id===t.typeId))return 'The reusable tower type is missing.';
  const params=towerParameters(p,t),issue=towerParameterIssue(params);if(issue)return issue;
  const level=p.entities.find(e=>e.id===t.levelId);if(level?.kind!=='level'||levels.has(t.levelId))return 'Each tower needs its own existing level.';levels.add(t.levelId);
  for(const k of TOWER_PART_KEYS){if(parts.has(t.parts[k])||t.parts[k]===t.levelId)return 'Tower component IDs must be unique.';parts.add(t.parts[k]);
   if(t.detached?.includes(k))continue;
   const active=k==='wall'||k==='roof'&&params.top==='roof'||k.startsWith('floor')&&Number(k.slice(5))<params.floorCount;
   if(active){const e=p.entities.find(e=>e.id===t.parts[k]);if(!e||e.parentId!==t.levelId||e.kind!==(k==='wall'?'wall':k==='roof'?'roof':'slab'))return 'Tower components must exist on their assembly level.';}
  }
  const wall=p.entities.find(e=>e.id===t.parts.wall) as Wall|undefined;if(!wall?.curve||Math.abs(wall.curve.sweepAngle)!==360)return 'Keep the tower wall circular, or make the tower independent first.';
  const a=level.rotation*Math.PI/180,c=wall.curve.center,x=level.position[0]+c[0]*Math.cos(a)+c[1]*Math.sin(a),z=level.position[2]-c[0]*Math.sin(a)+c[1]*Math.cos(a),roof=p.entities.find(e=>e.id===t.parts.roof) as Roof|undefined;
  const radius=Math.max(wall.curve.radius+wall.thickness/2,roof?.cone?roof.cone.radius+roof.cone.overhang:0);
  if(Math.abs(x)+radius>p.site.width/2+1e-6||Math.abs(z)+radius>p.site.depth/2+1e-6)return 'Keep the whole tower and roof inside the site.';
 }
 return null;
}
/** Existing native parts retain their appearance, openings and hosted details. */
export function regenerateTowers(before:Project,project:Project):Project{
 let entities=project.entities;
 for(const tower of project.towerAssemblies??[]){
  if(!project.towerTypes?.some(t=>t.id===tower.typeId))throw new Error('Choose an existing tower type.');
  const p=towerParameters(project,tower),issue=towerParameterIssue(p);if(issue)throw new Error(issue);
  const override=(k:TowerPartKey,f:z.infer<typeof field>)=>tower.overrides?.[k]?.includes(f);
  const original=entities.find(e=>e.id===tower.parts.wall) as Wall|undefined;
  if(original&&original.kind!=='wall')throw new Error('A tower wall cannot change its kind.');
  let wall=original??createCurvedWall(tower.levelId,'circle',[[0,0],[p.radius,0]],p.thickness,p.height,false,0,tower.parts.wall);
  if(!wall.curve||Math.abs(wall.curve.sweepAngle)!==360)throw new Error('Keep the tower wall circular, or make the tower independent first.');
  wall=updateCurvedWall(wall,{radius:override('wall','radius')?wall.curve.radius:p.radius,center:override('wall','center')?wall.curve.center:[0,0]});
  wall={...wall,thickness:override('wall','thickness')?wall.thickness:p.thickness,height:override('wall','height')?wall.height:p.height};
  if(!override('wall','top'))wall={...wall,battlements:p.top==='battlements'?{...(wall.battlements??{width:1,height:.8,spacing:p.battlementSpacing}),spacing:override('wall','battlementSpacing')?wall.battlements?.spacing??p.battlementSpacing:p.battlementSpacing}:undefined};
  if(!original){const material=architecturalMaterials(project).find(m=>m.pattern==='stone');wall={...wall,name:'Tower wall',...(material?{materialId:material.id}:{})};entities=[...entities,wall];}
  else entities=replaceJoinedWall(entities,original,wall);
  const write=(part:BuildingPart)=>{const old=entities.find(e=>e.id===part.id);entities=old?entities.map(e=>e.id===part.id?part:e):[...entities,part];};
  const retire=(k:TowerPartKey)=>{if(tower.detached?.includes(k))return;if(entities.some(e=>e.id===tower.parts[k])){if(tower.edited?.includes(k))throw new Error('Detach the customized '+k+' before removing it from the tower.');entities=entities.filter(e=>e.id!==tower.parts[k]);}};
  for(let i=0;i<8;i++){
   const k=`floor${i}` as TowerPartKey;if(tower.detached?.includes(k))continue;if(i>=p.floorCount){retire(k);continue;}
   const old=entities.find(e=>e.id===tower.parts[k]) as Slab|undefined;
   const radius=override(k,'radius')&&old?.disk?old.disk.radius:Number((wall.curve!.radius-wall.thickness/2+.01).toFixed(10));
   if(radius<.25)throw new Error('Leave enough clear space for tower floors.');
   const material=architecturalMaterials(project).find(m=>m.pattern==='timber');
   const floor:Slab={...(old??{id:tower.parts[k],parentId:tower.levelId,kind:'slab',name:`Tower floor ${i+1}`,visible:true,color:'#a78e6d',thickness:.2,...(material?{materialId:material.id}:{})}),center:override(k,'center')&&old?old.center:[...wall.curve!.center],disk:{radius},width:2*radius,depth:2*radius,elevation:override(k,'elevation')&&old?old.elevation:wall.elevation+i*wall.height/p.floorCount-(old?.thickness??.2)};
   if(old?.outline||old?.stairs)throw new Error('Detach the tower floor before changing its shape.');write(floor);
  }
  if(p.top==='roof'&&!tower.detached?.includes('roof')){
   const old=entities.find(e=>e.id===tower.parts.roof) as Roof|undefined;
   const roof=old?setConicalRoofTower({...old,rise:override('roof','roofHeight')?old.rise:p.roofHeight,cone:{...old.cone!,overhang:override('roof','overhang')?old.cone!.overhang:p.overhang}},wall):conicalRoofForTower(wall,p.roofHeight,p.overhang,tower.parts.roof);
   const material=architecturalMaterials(project).find(m=>m.pattern==='roof');write(old?roof:{...roof,name:'Tower roof',...(material?{materialId:material.id}:{})});
  }else retire('roof');
 }
 return {...project,entities};
}
export function captureTowerEdit(project:Project,before:Entity,after:Entity):Project{
 const t=towerOwner(project,before.id),k=t&&towerPart(t,before.id);if(!t||!k||JSON.stringify(before)===JSON.stringify(after))return project;
 if(after.kind==='slab'){if(!after.disk)throw new Error('Detach the tower floor before changing its shape.');const issue=circularFloorIssue(after);if(issue)throw new Error(issue);}
 const flags=new Set(t.overrides?.[k]??[]),changed=(a:unknown,b:unknown)=>JSON.stringify(a)!==JSON.stringify(b);
 if(before.kind==='wall'&&after.kind==='wall'){
  if(changed(before.curve?.radius,after.curve?.radius))flags.add('radius');if(changed(before.curve?.center,after.curve?.center))flags.add('center');
  for(const f of ['height','thickness','elevation'] as const)if(before[f]!==after[f])flags.add(f);
  if(!!before.battlements!==!!after.battlements)flags.add('top');if(before.battlements?.spacing!==after.battlements?.spacing)flags.add('battlementSpacing');
 }else if(before.kind==='slab'&&after.kind==='slab'){
  if(before.disk?.radius!==after.disk?.radius)flags.add('radius');if(changed(before.center,after.center))flags.add('center');if(before.elevation!==after.elevation)flags.add('elevation');
 }else if(before.kind==='roof'&&after.kind==='roof'){
  if(before.rise!==after.rise)flags.add('roofHeight');if(before.cone?.overhang!==after.cone?.overhang)flags.add('overhang');
  if(after.cone?.wallId!==t.parts.wall)throw new Error('Use Detach component before changing the tower roof support.');
 }
 return {...project,towerAssemblies:project.towerAssemblies!.map(a=>a.id===t.id?{...a,edited:[...new Set([...(a.edited??[]),k])],overrides:{...a.overrides,[k]:[...flags]}}:a)};
}
