import {z} from 'zod';
import type {Block,Entity,Instance,Hedge,Project} from './model';
import {assetAnimation} from './asset-animation';
import {repeatOwner} from './repeats';

const point=z.tuple([z.number().finite().min(-500).max(500),z.number().finite().min(-500).max(500)]);
export const mirrorRuleSchema=z.object({
 id:z.string().min(1).max(48),name:z.string().trim().min(1).max(80),start:point,end:point,
 sourceIds:z.array(z.string().min(1).max(100)).min(1).max(128).optional(),repeatId:z.string().min(1).max(72).optional(),
 excluded:z.array(z.string().min(1).max(100)).max(128).optional(),
 overrides:z.record(z.string(),z.object({name:z.string().trim().min(1).max(80).optional(),visible:z.boolean().optional()}).strict()).optional(),
}).strict().superRefine((r,ctx)=>{if(!!r.sourceIds===!!r.repeatId)ctx.addIssue({code:'custom',message:'Choose objects or one repeat to mirror.'});if(Math.hypot(r.end[0]-r.start[0],r.end[1]-r.start[1])<.2)ctx.addIssue({code:'custom',message:'Use a mirror axis at least 0.2 m long.'});});
export type MirrorRule=z.infer<typeof mirrorRuleSchema>;
export type MirrorSource=Block|Instance|Hedge;
type MirrorDocument=Pick<Project,'entities'|'assets'|'site'|'repeatPatterns'|'mirrorRules'>;
export function mirrorMemberId(rule:MirrorRule,sourceId:string){let hash=2166136261;for(const c of sourceId)hash=Math.imul(hash^c.charCodeAt(0),16777619);return `${rule.id}:m${(hash>>>0).toString(36)}`;}
export function mirrorSourceIds(project:Pick<Project,'entities'|'repeatPatterns'>,rule:MirrorRule):string[]{
 return rule.sourceIds??project.entities.filter(e=>repeatOwner(project,e.id)?.id===rule.repeatId).map(e=>e.id);
}
export function mirrorOwner(project:Pick<Project,'entities'|'repeatPatterns'|'mirrorRules'>,id:string){
 for(const rule of project.mirrorRules??[])for(const sourceId of mirrorSourceIds(project,rule))if(!rule.excluded?.includes(sourceId)&&mirrorMemberId(rule,sourceId)===id)return {rule,sourceId};
}
function staticSource(project:Pick<Project,'assets'>,e:Entity):e is MirrorSource{
 return e.kind==='hedge'||e.kind==='block'||e.kind==='instance'&&!e.regionId&&!e.walkingRoute&&!assetAnimation(project.assets.find(a=>a.id===e.assetId)!);
}
export function mirrorSources(project:MirrorDocument){return project.entities.filter((e):e is MirrorSource=>staticSource(project,e)&&!mirrorOwner(project,e.id)&&!repeatOwner(project,e.id));}
export function reflectPoint(rule:Pick<MirrorRule,'start'|'end'>,p:[number,number]):[number,number]{
 const dx=rule.end[0]-rule.start[0],dz=rule.end[1]-rule.start[1],n=Math.hypot(dx,dz),nx=-dz/n,nz=dx/n,d=(p[0]-rule.start[0])*nx+(p[1]-rule.start[1])*nz;
 return [p[0]-2*d*nx,p[1]-2*d*nz];
}
export function mirrorMember(source:MirrorSource,rule:MirrorRule):MirrorSource|null{
 if(source.kind==='hedge'){const points=source.points.map(p=>reflectPoint(rule,p));if(points.every((p,i)=>Math.hypot(p[0]-source.points[i][0],p[1]-source.points[i][1])<.002))return null;return {...source,id:mirrorMemberId(rule,source.id),name:source.name.slice(0,72)+' mirror',points,...rule.overrides?.[source.id]};}
 const p=reflectPoint(rule,[source.position[0],source.position[2]]);
 // A source on the axis is already the shared center object.
 if(Math.hypot(p[0]-source.position[0],p[1]-source.position[2])<.002)return null;
 const a=source.rotation*Math.PI/180,origin=reflectPoint(rule,[0,0]),forward=reflectPoint(rule,[Math.sin(a),Math.cos(a)]),rotation=Math.atan2(forward[0]-origin[0],forward[1]-origin[1])*180/Math.PI;
 const result:MirrorSource={...source,id:mirrorMemberId(rule,source.id),name:`${source.name.slice(0,72)} mirror`,position:[p[0],source.position[1],p[1]],rotation};
 if(result.kind==='instance'){delete result.regionId;delete result.walkingRoute;result.mirrored=source.kind==='instance'&&!source.mirrored?true:undefined;}
 return {...result,...rule.overrides?.[source.id]};
}
export function mirrorIssue(project:MirrorDocument):string|null{
 const ids=new Set<string>(),owned=new Set<string>();
 for(const rule of project.mirrorRules??[]){
  if(ids.has(rule.id)||project.entities.some(e=>e.id===rule.id))return 'Mirror rule IDs must be unique.';ids.add(rule.id);
  if(rule.repeatId&&!project.repeatPatterns?.some(p=>p.id===rule.repeatId))return 'Choose an existing repeat to mirror.';
  const sourceIds=mirrorSourceIds(project,rule);if(sourceIds.length>128||new Set(sourceIds).size!==sourceIds.length)return 'Mirror up to 128 distinct source objects.';
  if(new Set(rule.excluded??[]).size!==rule.excluded?.length&&(rule.excluded?.length??0)>0)return 'Mirror exclusions must be unique.';
  for(const sourceId of sourceIds){
   const source=project.entities.find(e=>e.id===sourceId);
   if(!source||!staticSource(project,source)||mirrorOwner(project,sourceId)||!rule.repeatId&&repeatOwner(project,sourceId))return 'Mirror independent static plants/blocks, or choose the whole repeat. Detach generated objects first.';
   if(rule.excluded?.includes(sourceId))continue;
   const expected=mirrorMember(source,rule);if(!expected)continue;
   if(owned.has(expected.id)||JSON.stringify(project.entities.find(e=>e.id===expected.id))!==JSON.stringify(expected))return 'Mirrored copies must match their source and axis.';
   owned.add(expected.id);if(expected.kind==='hedge'?expected.points.some(p=>Math.abs(p[0])>project.site.width/2||Math.abs(p[1])>project.site.depth/2):Math.abs(expected.position[0])>project.site.width/2||Math.abs(expected.position[2])>project.site.depth/2)return 'Keep mirrored object centers inside the site.';
  }
 }
 return null;
}
/** Regenerate after repeats, retaining IDs and detaching surviving copies on source removal. */
export function regenerateMirrors(before:Project,project:Project):Project{
 if(!before.mirrorRules?.length&&!project.mirrorRules?.length){if(project.mirrorRules===undefined&&'mirrorRules' in project){const {mirrorRules:_,...plain}=project;return plain;}return project;}
 let entities=project.entities;
 const rules=(project.mirrorRules??[]).filter(r=>!r.repeatId||project.repeatPatterns?.some(p=>p.id===r.repeatId)).map(r=>r.sourceIds?{...r,sourceIds:r.sourceIds.filter(id=>entities.some(e=>e.id===id))}:r).filter(r=>!r.sourceIds||r.sourceIds.length);
 const generated:Entity[]=[],occupied=new Set<string>();
 for(const rule of rules)for(const sourceId of mirrorSourceIds({...project,entities},rule)){
  const source=entities.find(e=>e.id===sourceId);if(!source||!staticSource(project,source))throw new Error('Choose existing static mirror sources.');
  if(mirrorOwner(project,sourceId))throw new Error('Mirrored copies cannot be mirror sources. Detach first.');
  if(rule.excluded?.includes(sourceId))continue;
  const member=mirrorMember(source,rule);if(member){if(occupied.has(member.id))throw new Error('Mirror copy IDs collide. Create another mirror rule.');occupied.add(member.id);generated.push(member);}
 }
 // Only rules that still exist own cleanup. Removing a rule/source deliberately
 // leaves surviving copies independent; changing repeat count retires copies.
 const cleanup=new Set<string>();
 for(const rule of rules){const old=before.mirrorRules?.find(r=>r.id===rule.id);for(const id of [...mirrorSourceIds(project,rule),...(old?mirrorSourceIds(before,old):[])])if(!rule.excluded?.includes(id)&&(rule.repeatId||project.entities.some(e=>e.id===id)))cleanup.add(mirrorMemberId(rule,id));}
 const byId=new Map(generated.map(e=>[e.id,e]));entities=entities.filter(e=>!cleanup.has(e.id)||byId.has(e.id)).map(e=>byId.get(e.id)??e);
 const present=new Set(entities.map(e=>e.id));return {...project,mirrorRules:project.mirrorRules?rules:undefined,entities:[...entities,...generated.filter(e=>!present.has(e.id))]};
}
