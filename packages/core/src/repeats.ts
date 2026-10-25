import {z} from 'zod';
import type {Block,Entity,Instance,Project} from './model';
import {assetAnimation} from './asset-animation';
import {mirrorOwner} from './mirrors';

const number=z.number().finite(),point=z.tuple([number.min(-500).max(500),number.min(-500).max(500)]);
const vector=z.tuple([number,number,number]);
const axisOverrides=z.tuple([number.nullable(),number.nullable(),number.nullable()]);
export const repeatPathSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('line'),start:point,end:point}).strict(),
 z.object({kind:z.literal('arc'),center:point,radius:number.min(.25).max(100),startAngle:number.min(-360).max(360),sweepAngle:number.min(-360).max(360)}).strict(),
]);
const overrideSchema=z.object({position:vector.optional(),rotation:number.optional(),size:axisOverrides.optional(),scale:axisOverrides.optional(),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),assetId:z.string().min(1).max(100).optional(),anchor:z.enum(['terrain','fixed']).optional(),name:z.string().trim().min(1).max(80).optional(),visible:z.boolean().optional()}).strict();
export const repeatPatternSchema=z.object({
 id:z.string().min(1).max(72),name:z.string().trim().min(1).max(80),sourceId:z.string().min(1).max(100),path:repeatPathSchema,
 mode:z.enum(['count','spacing']),count:number.int().min(2).max(128),spacing:number.min(.2).max(100),
 orientation:z.enum(['fixed','tangent','radial']),rotation:number.min(-360).max(360),clearance:number.min(0).max(50),
 overrides:z.record(z.string().regex(/^(0|[1-9][0-9]?)$|^1[01][0-9]$|^12[0-7]$/),overrideSchema).optional(),
 excluded:z.array(number.int().min(0).max(127)).max(128).optional(),
}).strict();
export type RepeatPath=z.infer<typeof repeatPathSchema>;
export type RepeatPattern=z.infer<typeof repeatPatternSchema>;
export type RepeatSource=Block|Instance;
type RepeatDocument={entities:Entity[];repeatPatterns?:RepeatPattern[];assets:Project['assets'];site:{width:number;depth:number}};
export const repeatMemberId=(pattern:RepeatPattern,slot:number)=>`${pattern.id}:${slot}`;
export function repeatOwner(project:Pick<Project,'repeatPatterns'>,id:string){return project.repeatPatterns?.find(p=>Array.from({length:128},(_,i)=>i).some(i=>repeatMemberId(p,i)===id&&!p.excluded?.includes(i)));}
export function repeatSources(project:Project):RepeatSource[]{
 return project.entities.filter((e):e is RepeatSource=>(e.kind==='block'||e.kind==='instance'&&!e.regionId&&!e.walkingRoute&&!assetAnimation(project.assets.find(a=>a.id===e.assetId)!))&&!repeatOwner(project,e.id)&&!mirrorOwner(project,e.id));
}
const radians=(n:number)=>n*Math.PI/180;
const angle=(n:number)=>((n+180)%360+360)%360-180;
export function repeatLength(path:RepeatPath){return path.kind==='line'?Math.hypot(path.end[0]-path.start[0],path.end[1]-path.start[1]):path.radius*Math.abs(radians(path.sweepAngle));}
export function repeatLayout(pattern:RepeatPattern){
 const p=repeatPatternSchema.parse(pattern),length=repeatLength(p.path),closed=p.path.kind==='arc'&&Math.abs(p.path.sweepAngle)===360;
 if(length<.2||p.path.kind==='arc'&&Math.abs(p.path.sweepAngle)<1)throw new Error('Draw a line at least 0.2 m long or an arc of at least 1 degree.');
 if(p.path.kind==='line'&&p.orientation==='radial')throw new Error('Radial orientation needs an arc.');
 if(p.clearance*2>=length)throw new Error('Reduce end clearance to leave room along the path.');
 if(closed&&p.clearance!==0)throw new Error('A full circle has no ends; set end clearance to zero.');
 const usable=length-2*p.clearance;
 const count=p.mode==='count'?p.count:closed?Math.floor((length+1e-8)/p.spacing):Math.floor((usable+1e-8)/p.spacing)+1;
 if(count<2||count>128)throw new Error('Use a count or spacing that creates 2–128 objects.');
 const spacing=closed?length/count:p.mode==='count'?usable/(count-1):p.spacing;
 const start=closed?0:p.clearance+(usable-spacing*(count-1))/2;
 return {count,spacing,length,closed,start};
}
export function repeatSample(pattern:RepeatPattern,distance:number){
 const path=pattern.path;
 if(path.kind==='line'){
  const length=repeatLength(path),dx=(path.end[0]-path.start[0])/length,dz=(path.end[1]-path.start[1])/length;
  return {point:[path.start[0]+dx*distance,path.start[1]+dz*distance] as [number,number],tangent:Math.atan2(-dz,dx)*180/Math.PI,radial:0};
 }
 const a=radians(path.startAngle)+Math.sign(path.sweepAngle)*distance/path.radius;
 // Three.js positive Y rotation sends local +X toward world -Z.
 return {point:[path.center[0]+path.radius*Math.cos(a),path.center[1]+path.radius*Math.sin(a)] as [number,number],tangent:-(a+Math.sign(path.sweepAngle)*Math.PI/2)*180/Math.PI,radial:-a*180/Math.PI};
}
export function repeatMember(source:RepeatSource,p:RepeatPattern,slot:number):RepeatSource{
 const layout=repeatLayout(p),sample=repeatSample(p,layout.start+layout.spacing*slot),o=p.overrides?.[String(slot)];
 const result:RepeatSource={...source,id:repeatMemberId(p,slot),name:`${source.name.slice(0,70)} ${slot+1}`,position:[sample.point[0],source.position[1],sample.point[1]],rotation:angle(source.rotation+p.rotation+(p.orientation==='fixed'?0:sample[p.orientation]))};
 if(result.kind==='instance'){delete result.regionId;delete result.walkingRoute;}
 if(o){
  if(o.position)result.position=result.position.map((v,i)=>v+o.position![i]) as [number,number,number];
  if(o.rotation!==undefined)result.rotation=angle(result.rotation+o.rotation);
  if(o.name!==undefined)result.name=o.name;if(o.visible!==undefined)result.visible=o.visible;
  if(result.kind==='block'){if(o.size)result.size=result.size.map((v,i)=>o.size![i]??v) as [number,number,number];if(o.color)result.color=o.color;}
  else {if(o.scale)result.scale=result.scale.map((v,i)=>o.scale![i]??v) as [number,number,number];if(o.assetId)result.assetId=o.assetId;if(o.anchor)result.anchor=o.anchor;}
 }
 return result;
}
export function repeatIssue(project:RepeatDocument):string|null{
 const patterns=project.repeatPatterns??[],ids=new Set<string>(),members=new Set<string>();
 for(const p of patterns){
  if(ids.has(p.id)||project.entities.some(e=>e.id===p.id))return 'Repeat IDs must be unique.';ids.add(p.id);
  const source=project.entities.find(e=>e.id===p.sourceId);
  if(!source||(source.kind!=='block'&&source.kind!=='instance')||source.kind==='instance'&&(source.regionId||source.walkingRoute))return 'Choose an independent block or static model as the repeat source.';
  if(repeatOwner(project,source.id))return 'Repeated members cannot be shared sources. Detach the object first.';
  if(mirrorOwner(project as Project,source.id))return 'Detach mirrored objects before using them as repeat sources.';
  if(source.kind==='instance'){
   const asset=project.assets.find(a=>a.id===source.assetId);if(!asset)return 'The repeat source model is missing.';
   if(assetAnimation(asset))return 'Choose a static model for repetition.';
  }
  let layout;try{layout=repeatLayout(p);}catch(error){return (error as Error).message;}
  if(new Set(p.excluded??[]).size!==(p.excluded??[]).length)return 'Repeat exclusions must be unique.';
  for(let i=0;i<layout.count;i++)if(!p.excluded?.includes(i)){
   const member=repeatMember(source,p,i),existing=project.entities.find(e=>e.id===member.id);
   if(members.has(member.id)||!existing||JSON.stringify(existing)!==JSON.stringify(member))return 'Repeat members must match their source, path and saved overrides.';
   members.add(member.id);
   if(member.kind==='instance'){
    const asset=project.assets.find(a=>a.id===member.assetId);if(!asset)return 'A repeated object model is missing.';
    if(assetAnimation(asset))return 'Choose a static model for repeated objects.';
   }
   if(Math.abs(member.position[0])>project.site.width/2||Math.abs(member.position[2])>project.site.depth/2)return 'Keep repeated object centers inside the site.';
  }
 }
 return null;
}
/** Rebuild only the owned members; independent/detached objects keep their identities. */
export function regenerateRepeats(project:Project):Project{
 const patterns=project.repeatPatterns??[];
 if(!patterns.length)return project;
 let entities=project.entities;
 for(const p of patterns){
  const source=entities.find(e=>e.id===p.sourceId);
  if(!source||(source.kind!=='block'&&source.kind!=='instance'))throw new Error('Choose an existing block or model source.');
  const layout=repeatLayout(p),owned=new Set(Array.from({length:128},(_,i)=>i).filter(i=>!p.excluded?.includes(i)).map(i=>repeatMemberId(p,i)));
  const generated=Array.from({length:layout.count},(_,i)=>i).filter(i=>!p.excluded?.includes(i)).map(i=>repeatMember(source,p,i));
  const byId=new Map(generated.map(e=>[e.id,e]));
  entities=entities.filter(e=>!owned.has(e.id)||byId.has(e.id)).map(e=>byId.get(e.id)??e);
  const present=new Set(entities.map(e=>e.id));entities=[...entities,...generated.filter(e=>!present.has(e.id))];
 }
 return {...project,entities};
}
/** Record only the fields the user changed, so other source fields keep following. */
export function overrideRepeatMember(project:Project,before:RepeatSource,after:RepeatSource):Project{
 const p=repeatOwner(project,before.id);if(!p)return project;
 const slot=Number(before.id.slice(p.id.length+1)),o={...p.overrides?.[String(slot)]};
 if(before.kind!==after.kind)throw new Error('Repeated objects cannot change kind.');
 if(before.position.some((v,i)=>v!==after.position[i]))o.position=after.position.map((v,i)=>v-before.position[i]+(o.position?.[i]??0)) as [number,number,number];
 if(before.rotation!==after.rotation)o.rotation=angle(after.rotation-before.rotation+(o.rotation??0));
 if(before.name!==after.name)o.name=after.name;if(before.visible!==after.visible)o.visible=after.visible;
 if(before.kind==='block'&&after.kind==='block'){
  if(before.color!==after.color)o.color=after.color;
  if(before.size.some((v,i)=>v!==after.size[i]))o.size=after.size.map((v,i)=>v!==before.size[i]?v:o.size?.[i]??null) as [number|null,number|null,number|null];
 }else if(before.kind==='instance'&&after.kind==='instance'){
  if(before.assetId!==after.assetId)o.assetId=after.assetId;if(before.anchor!==after.anchor)o.anchor=after.anchor;
  if(before.scale.some((v,i)=>v!==after.scale[i]))o.scale=after.scale.map((v,i)=>v!==before.scale[i]?v:o.scale?.[i]??null) as [number|null,number|null,number|null];
 }
 return {...project,repeatPatterns:project.repeatPatterns!.map(rule=>rule.id===p.id?{...rule,overrides:{...rule.overrides,[slot]:o}}:rule)};
}
export function repeatPathFromPoints(shape:'line'|'arc',points:[number,number][],clockwise=false):RepeatPath{
 if(shape==='line'){if(points.length<2)throw new Error('Choose the start and end.');return {kind:'line',start:points[0],end:points[1]};}
 if(points.length<3)throw new Error('Choose the center, radius/start and end direction.');
 const [center,start,end]=points,a=Math.atan2(start[1]-center[1],start[0]-center[0])*180/Math.PI,b=Math.atan2(end[1]-center[1],end[0]-center[0])*180/Math.PI;
 const delta=clockwise?-((a-b+360)%360||360):((b-a+360)%360||360);
 return {kind:'arc',center,radius:Math.hypot(start[0]-center[0],start[1]-center[1]),startAngle:a,sweepAngle:delta};
}
