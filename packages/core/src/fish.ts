import { lakeDistance, sampleRiver } from '@openlandcraft/landscape';
import type { Asset } from './assets';
import { assetAnimation } from './asset-animation';
import { groundHeight, type Project } from './model';

export const isFishAsset = (asset: Asset): boolean => assetAnimation(asset) === 'fish-swim-v1';
export type SwimRoute = { x: number; y: number; z: number; rx: number; rz: number; bob: number; waterId: string };

/** Compile against evaluated, displayed terrain/water (including hidden layers). */
export function fishHabitat(project: Project) {
  const { site } = project;
  const waters = project.entities.filter(e => e.visible && (e.kind === 'ocean' || e.kind === 'lake' || e.kind === 'river'));
  const lakes = waters.filter(e => e.kind === 'lake');
  return waters.map(water => {
    const path = water.kind === 'river' ? sampleRiver(water.points) : [];
    return { id: water.id, sample(x: number, z: number, radius: number, verticalRadius = radius) {
      if (Math.abs(x) + radius > site.width / 2 || Math.abs(z) + radius > site.depth / 2) return null;
      let level: number, amplitude: number;
      if (water.kind === 'ocean') {
        // The ocean renderer cuts out lake footprints, including their transition bank.
        if (lakes.some(lake => lakeDistance(lake.points, x, z) > -radius - 0.8)) return null;
        level = water.level; amplitude = water.amplitude;
      } else if (water.kind === 'lake') {
        if (lakeDistance(water.points, x, z) < radius) return null;
        level = water.level; amplitude = water.amplitude;
      } else if (water.kind === 'river') {
        let nearest = Infinity, surface = 0, insideEnd = false;
        for (let i = 1; i < path.length; i++) {
          const a = path[i-1], b = path[i], dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz);
          if (!length) continue;
          const projection = ((x-a.x)*dx+(z-a.z)*dz)/(length*length);
          const t = Math.max(0, Math.min(1, projection)), distance = Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
          if (distance < nearest) { nearest = distance; insideEnd = !(i === 1 && projection*length < radius) && !(i === path.length-1 && (1-projection)*length < radius); surface = a.y+(b.y-a.y)*t-Math.abs(b.y-a.y)/length*radius; }
        }
        if (!insideEnd || nearest + radius > water.width/2) return null;
        level = surface; amplitude = water.water.amplitude;
      } else return null;
      // Max of every touched grid cell bounds the bilinear terrain, even between route samples.
      const { columns, rows, heights } = site.terrain;
      const gx = (columns-1)/site.width, gz = (rows-1)/site.depth;
      let bed = groundHeight(x,z,site);
      for (let row = Math.max(0,Math.floor((z-radius+site.depth/2)*gz)); row <= Math.min(rows-1,Math.ceil((z+radius+site.depth/2)*gz)); row++)
        for (let col = Math.max(0,Math.floor((x-radius+site.width/2)*gx)); col <= Math.min(columns-1,Math.ceil((x+radius+site.width/2)*gx)); col++)
          bed = Math.max(bed,heights[row*columns+col]);
      const low = bed + verticalRadius + 0.08, high = level - 2*amplitude - verticalRadius - 0.08;
      return high >= low ? { low, high } : null;
    }};
  });
}

/** Validate a complete orbit, including body extent and space between samples. No per-frame terrain search. */
export function createSwimRoute(habitat: ReturnType<typeof fishHabitat>, center: readonly number[], scale = 1, space?: { horizontal: number; vertical: number; rx: number; rz: number; minFactor?: number; waterId?: string }): SwimRoute | null {
  if (!center.every(Number.isFinite) || !Number.isFinite(scale) || scale <= 0) return null;
  for (const water of habitat) {
    if (space?.waterId && water.id !== space.waterId) continue;
    if (!water.sample(center[0],center[2],space?.horizontal ?? 0.5*scale,space?.vertical ?? 0.5*scale)) continue;
    for (const factor of [1, 0.75, 0.5, 0.3]) {
      if (factor < (space?.minFactor ?? 0)) continue;
      const rx = (space?.rx ?? 2.8*scale)*factor, rz = (space?.rz ?? 1.8*scale)*factor;
      const radius = (space?.horizontal ?? 0.5*scale) + rx*Math.PI/64; // cover the full arc between 128 samples
      let low = -Infinity, high = Infinity;
      for (let i = 0; i < 128; i++) {
        const angle = i*Math.PI/64;
        const bounds = water.sample(center[0]+rx*Math.cos(angle),center[2]+rz*Math.sin(angle),radius,space?.vertical ?? radius);
        if (!bounds) { high = -Infinity; break; }
        low = Math.max(low,bounds.low); high = Math.min(high,bounds.high);
      }
      if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) continue;
      const bob = Math.min(0.08*scale,(high-low)/4);
      return { x:center[0], z:center[2], y:Math.max(low+bob,Math.min(high-bob,center[1])), rx, rz, bob, waterId:water.id };
    }
  }
  return null;
}
