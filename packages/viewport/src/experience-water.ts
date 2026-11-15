import { groundHeight, type Project } from '@openlandcraft/core';
import { lakeWaterDistance, sampleRiver } from '@openlandcraft/landscape';

/** Mean water levels provide stable buoyancy independently of rendering and wave clocks. */
export function experienceWaterSurface(project: Project) {
  const waters = project.entities.filter(entity => entity.visible && ['ocean', 'lake', 'river'].includes(entity.kind));
  const rivers = new Map(waters.flatMap(water => water.kind === 'river' ? [[water.id, sampleRiver(water.points)] as const] : []));
  return (x: number, z: number): number | null => {
    const ground = groundHeight(x, z, project.site);
    let level: number | null = null;
    const consider = (y: number) => { if (y > ground + 0.03 && (level === null || y > level)) level = y; };
    for (const water of waters) {
      if (water.kind === 'ocean') consider(water.level);
      else if (water.kind === 'lake' && lakeWaterDistance(water, x, z) >= -Math.min(water.bank, 0.8)) consider(water.level);
      else if (water.kind === 'river') {
        const path = rivers.get(water.id)!;
        let nearest = Infinity, elevation = 0;
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1], b = path[i], dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, length ? ((x - a.x) * dx + (z - a.z) * dz) / length : 0));
          const distance = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
          if (distance < nearest) { nearest = distance; elevation = a.y + (b.y - a.y) * t; }
        }
        if (nearest < water.width / 2 + Math.min(water.bank, 0.75)) consider(elevation);
      }
    }
    return level;
  };
}
