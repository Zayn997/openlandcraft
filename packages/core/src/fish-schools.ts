import { createSwimRoute, fishHabitat, isFishAsset, type SwimRoute } from './fish';
import { instancePosition } from './placement';
import type { Instance, Project } from './model';

export const MAX_SCHOOL_SIZE = 8;
export type FishSchool = { route: SwimRoute; radius: number; count: number; seed: number; scale: number };
export type SchoolMember = { school: FishSchool; side: number; along: number; wander: number; seed: number };
export type FishSchools = Map<string, SchoolMember>;
const cache = new WeakMap<Project, FishSchools>();
export function fishSeed(id: string) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

/** Compile stable small schools across all fish assets, once per displayed project revision.
 * Reserved swimming volumes prevent cross-school collisions; safe slots prevent collisions
 * within a school, even while turning. No pairwise collision work runs per animation frame.
 */
export function fishSchools(project: Project): FishSchools {
  const cached = cache.get(project); if (cached) return cached;
  const result: FishSchools = new Map(), habitat = fishHabitat(project);
  const assets = new Set(project.assets.filter(isFishAsset).map(a => a.id));
  const candidates = project.entities.filter((e): e is Instance => e.kind === 'instance' && e.visible && assets.has(e.assetId))
    .sort((a,b) => a.id.localeCompare(b.id)).map(entity => {
      const center = instancePosition(entity,project), scale = Math.max(...entity.scale);
      return { entity, center, scale, route: createSwimRoute(habitat,center,scale) };
    }).filter(e => e.route !== null);
  const reserved: FishSchool[] = [];
  const processed = new Set<string>();
  for (const first of candidates) {
    if (processed.has(first.entity.id)) continue;
    const nearby = candidates.filter(e => !processed.has(e.entity.id) && e.route!.waterId === first.route!.waterId &&
      Math.hypot(e.center[0]-first.center[0],e.center[2]-first.center[2]) <= 6*Math.max(first.scale,e.scale) &&
      Math.abs(e.center[1]-first.center[1]) <= 2*Math.max(first.scale,e.scale)).slice(0,MAX_SCHOOL_SIZE);
    let found = false;
    // Prefer a small school near its authored center. Tight habitats can split into smaller schools.
    for (let count=nearby.length; count>=1 && !found; count--) {
      const members = nearby.slice(0,count), scale = Math.max(...members.map(e => e.scale));
      const spacing = 1.35*scale, wander = 0.045*scale;
      const slots = members.map((_,i) => {
        if (count===1) return {side:0,along:0};
        const columns = count<=3 ? 2 : 3, row=Math.floor(i/columns), col=i%columns;
        return { side:(col+(row%2)*0.5)*spacing, along:-row*spacing*Math.sqrt(3)/2 };
      });
      const meanSide=slots.reduce((sum,s)=>sum+s.side,0)/count, meanAlong=slots.reduce((sum,s)=>sum+s.along,0)/count;
      slots.forEach(s=>{s.side-=meanSide;s.along-=meanAlong;});
      const radius=Math.max(...slots.map(s=>Math.hypot(s.side,s.along))) + 0.5*scale + wander;
      const center=members.reduce((sum,e)=>sum.map((v,i)=>v+e.center[i]/count),[0,0,0]);
      // Curvature remains broad enough that inside members still move forward through turns.
      const rx=count===1?2.8*scale:Math.max(4*scale,radius*2.5), rz=count===1?1.8*scale:Math.max(3*scale,radius*2.0);
      const offsets: [number,number][] = [[0,0]];
      // Search only when another school reserves the original orbit. Avoid moving a school
      // to the opposite side of a lake merely to fit a large formation.
      if (reserved.length) for (const distance of [4,8,12,16]) for (let i=0;i<8;i++)
        offsets.push([Math.cos(i*Math.PI/4)*distance*scale,Math.sin(i*Math.PI/4)*distance*scale]);
      for (const [dx,dz] of offsets) {
        const route=createSwimRoute(habitat,[center[0]+dx,center[1],center[2]+dz],scale,{
          horizontal:radius,vertical:0.5*scale+0.025*scale,rx,rz,minFactor:count===1?0:0.75,waterId:first.route!.waterId,
        });
        if (!route) continue;
        if (reserved.some(s => Math.abs(route.x-s.route.x) < route.rx+radius+s.route.rx+s.radius+0.15 &&
          Math.abs(route.z-s.route.z) < route.rz+radius+s.route.rz+s.radius+0.15)) continue;
        const school:FishSchool={route,radius,count,seed:fishSeed(first.entity.id),scale};
        reserved.push(school);
        members.forEach((member,i) => {
          result.set(member.entity.id,{school,...slots[i],wander,seed:fishSeed(member.entity.id)});
          processed.add(member.entity.id);
        });
        found=true; break;
      }
    }
    // Impossible placement remains saved and becomes visible when sufficient water is restored.
    if (!found) processed.add(first.entity.id);
  }
  cache.set(project,result);
  return result;
}
