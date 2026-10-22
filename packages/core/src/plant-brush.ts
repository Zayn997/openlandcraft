import { type Asset } from './assets';
import { type Instance, type Project } from './model';
import { evaluateProject } from './surface';
import { plantingObstacle } from './regions';

export type PlantBrushSettings = { radius: number; density: number; scaleMin: number; scaleMax: number };
export const DEFAULT_PLANT_BRUSH: PlantBrushSettings = { radius: 5, density: 12, scaleMin: 0.8, scaleMax: 1.2 };

/** One jittered candidate per world-space cell. Swept capsules make density independent
 * of pointer event frequency; revisiting a cell cannot build up plants in a stroke. */
export class PlantBrushStroke {
  readonly instances: Instance[] = [];
  limited = false;
  private previous: [number, number] | null = null;
  private visited = new Set<string>();
  private blocked: (x: number, z: number) => boolean;
  private cell: number;
  private capacity: number;
  private existing: Instance[];
  constructor(private project: Project, private asset: Asset, private settings: PlantBrushSettings,
    private seed: number, private prefix: string = crypto.randomUUID()) {
    const { radius, density, scaleMin, scaleMax } = settings;
    if (![radius, density, scaleMin, scaleMax, seed].every(Number.isFinite) || radius < 1 || radius > 20 || density < 1 || density > 100 || scaleMin < 0.1 || scaleMax > 3 || scaleMin > scaleMax) throw new Error('Use a 1–20 m brush, 1–100 plants per 100 m², and sizes between 0.1× and 3×.');
    this.cell = Math.sqrt(100 / density);
    this.capacity = Math.max(0, 1000 - project.entities.length);
    this.existing = project.entities.filter((e): e is Instance => e.kind === 'instance' && e.assetId === asset.id);
    this.blocked = plantingObstacle(evaluateProject(project), { clearance: 0.25, exclusions: { water: true, paths: true, buildings: true } });
  }
  private random(x: number, z: number, salt: number) {
    let n = ((Math.imul(x, 374761393) + Math.imul(z, 668265263)) ^ this.seed ^ salt) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  breakPath() { this.previous = null; }
  move(x: number, z: number) {
    if (![x, z].every(Number.isFinite)) return;
    const halfX = this.project.site.width / 2, halfZ = this.project.site.depth / 2;
    // Leaving the site breaks the path, avoiding a bridge when the cursor re-enters.
    if (Math.abs(x) > halfX || Math.abs(z) > halfZ) { this.previous = null; return; }
    const [ax, az] = this.previous ?? [x, z]; this.previous = [x, z];
    const dx = x - ax, dz = z - az, length2 = dx * dx + dz * dz, r = this.settings.radius;
    for (let i = Math.floor(Math.max(-halfX, Math.min(ax, x) - r) / this.cell); i <= Math.floor(Math.min(halfX, Math.max(ax, x) + r) / this.cell); i++) {
      for (let j = Math.floor(Math.max(-halfZ, Math.min(az, z) - r) / this.cell); j <= Math.floor(Math.min(halfZ, Math.max(az, z) + r) / this.cell); j++) {
        const key = `${i}:${j}`;
        if (this.visited.has(key)) continue;
        const px = (i + 0.15 + this.random(i, j, 17) * 0.7) * this.cell;
        const pz = (j + 0.15 + this.random(i, j, 53) * 0.7) * this.cell;
        const t = length2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length2)) : 0;
        if (Math.hypot(px - ax - t * dx, pz - az - t * dz) > r) continue;
        this.visited.add(key);
        if (Math.abs(px) > halfX || Math.abs(pz) > halfZ || this.blocked(px, pz) || this.existing.some(e => Math.hypot(e.position[0] - px, e.position[2] - pz) < this.cell * 0.3)) continue;
        if (this.instances.length >= this.capacity) { this.limited = true; return; }
        const scale = this.settings.scaleMin + this.random(i, j, 97) * (this.settings.scaleMax - this.settings.scaleMin);
        this.instances.push({ id: `${this.prefix}:${key}`, kind: 'instance', parentId: 'site', visible: true,
          name: `${this.asset.name.slice(0, 60)} ${this.existing.length + this.instances.length + 1}`, assetId: this.asset.id,
          position: [px, 0, pz], anchor: 'terrain', rotation: this.random(i, j, 139) * 360, scale: [scale, scale, scale] });
      }
    }
  }
}
