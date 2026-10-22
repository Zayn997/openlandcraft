import type { Ocean, Project } from '@openlandcraft/core';
import { sampleHeight } from '@openlandcraft/landscape';
import { coastalWave } from './coastal-waves';
import {HistoryWaves,historyWaveReference} from './history-wave';

const TAU = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export type CoastField = { columns: number; rows: number; width: number; depth: number; dx: number; dz: number; omega: number; deepSpeed: number; heights: Float32Array; phase: Float32Array; slopeX: Float32Array; slopeZ: Float32Array; shoreX: Float32Array; shoreZ: Float32Array; shoreSlope: Float32Array; speed: Float32Array; packed: Float32Array };

/** A bounded fast-sweeping travel-time field; gradients bend wave fronts over bathymetry. */
export function buildCoastField(site: Project['site'], ocean: Ocean): CoastField {
  const columns = Math.min(129, Math.max(33, Math.ceil(site.width / 0.65) + 1)), rows = Math.min(129, Math.max(33, Math.ceil(site.depth / 0.65) + 1));
  const n = columns * rows, dx = site.width / (columns - 1), dz = site.depth / (rows - 1), heights = new Float32Array(n), phase = new Float32Array(n), speed = new Float32Array(n);
  const slopeX = new Float32Array(n), slopeZ = new Float32Array(n), shoreX = new Float32Array(n), shoreZ = new Float32Array(n), shoreSlope = new Float32Array(n), packed = new Float32Array(n * 4);
  const k = TAU / ocean.wavelength, omega = Math.sqrt(9.81 * k), deepSpeed = omega / k, angle = ocean.direction / 180 * Math.PI, dirX = Math.cos(angle), dirZ = Math.sin(angle);
  const times = new Float64Array(n).fill(Infinity), fixed = new Uint8Array(n), origin = -(Math.abs(dirX) * site.width + Math.abs(dirZ) * site.depth) / 2;
  const weightX = 1 / (dx * dx), weightZ = 1 / (dz * dz), weightSum = weightX + weightZ;
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const i = r * columns + c, x = c * dx - site.width / 2, z = r * dz - site.depth / 2;
    heights[i] = sampleHeight(site.terrain, site, x, z);
    const depth = Math.max(0.04, ocean.level - heights[i]);
    // Cap shortening to keep the bounded field resolved, including narrow wavelength settings.
    speed[i] = Math.max(deepSpeed * 0.38, Math.sqrt(9.81 / k * Math.tanh(k * depth)));
    if ((dirX > 0.001 && c === 0) || (dirX < -0.001 && c === columns - 1) || (dirZ > 0.001 && r === 0) || (dirZ < -0.001 && r === rows - 1)) { fixed[i] = 1; times[i] = (x * dirX + z * dirZ - origin) / deepSpeed; }
  }
  for (let sweep = 0; sweep < 8; sweep++) {
    const reverseX = sweep % 2, reverseZ = Math.floor(sweep / 2) % 2;
    for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < columns; cc++) {
      const c = reverseX ? columns - 1 - cc : cc, r = reverseZ ? rows - 1 - rr : rr, i = r * columns + c;
      if (fixed[i]) continue;
      const a = Math.min(c ? times[i - 1] : Infinity, c + 1 < columns ? times[i + 1] : Infinity), b = Math.min(r ? times[i - columns] : Infinity, r + 1 < rows ? times[i + columns] : Infinity), s = 1 / speed[i];
      let candidate = Math.min(a + dx * s, b + dz * s);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const disc = weightSum * s * s - weightX * weightZ * (a-b) * (a-b);
        if (disc >= 0) { const root = (a * weightX + b * weightZ + Math.sqrt(disc)) / weightSum; if (root >= Math.max(a, b)) candidate = Math.min(candidate, root); }
      }
      times[i] = Math.min(times[i], candidate);
    }
  }
  for (let i = 0; i < n; i++) phase[i] = times[i] * omega;
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const i = r * columns + c, l = r * columns + Math.max(0, c - 1), right = r * columns + Math.min(columns - 1, c + 1), up = Math.max(0, r - 1) * columns + c, down = Math.min(rows - 1, r + 1) * columns + c;
    slopeX[i] = (phase[right] - phase[l]) / ((right - l) * dx || dx); slopeZ[i] = (phase[down] - phase[up]) / (((down - up) / columns) * dz || dz);
    const gx = (heights[right] - heights[l]) / ((right - l) * dx || dx), gz = (heights[down] - heights[up]) / (((down - up) / columns) * dz || dz), length = Math.hypot(gx, gz);
    shoreX[i] = length > 0.015 ? gx / length : dirX; shoreZ[i] = length > 0.015 ? gz / length : dirZ;
    shoreSlope[i] = length;
    packed[i*4] = phase[i]; packed[i*4+1] = slopeX[i]; packed[i*4+2] = slopeZ[i]; packed[i*4+3] = Math.min(1.5, Math.pow(deepSpeed / speed[i], 0.4));
  }
  return { columns, rows, width: site.width, depth: site.depth, dx, dz, omega, deepSpeed, heights, phase, slopeX, slopeZ, shoreX, shoreZ, shoreSlope, speed, packed };
}

/** Same wave/run-up expressions as coast GLSL; CPU history follows the visible surface. */
export function coastSample(ocean: Ocean, phase: number, boost: number, ground: number, clock: number, along: number) {
  const wave=coastalWave(phase,along,clock,TAU/ocean.wavelength,ocean.level-ground,boost,ocean.amplitude,ocean.breaker,ocean.swash);
  const height=ocean.level+wave.height;
  return {height,breaking:wave.breaking,p:phase-clock,crest:wave.crest,thickness:height-ground};
}

function bilinear(data: Float32Array, columns: number, rows: number, x: number, z: number): number {
  if (x < 0 || z < 0 || x > columns - 1 || z > rows - 1) return 0;
  const c = Math.min(columns - 2, Math.floor(x)), r = Math.min(rows - 2, Math.floor(z)), u = x - c, v = z - r, i = r * columns + c;
  return (data[i] * (1-u) + data[i+1] * u) * (1-v) + (data[i+columns] * (1-u) + data[i+columns+1] * u) * v;
}

export class CoastHistory {
  readonly field: CoastField;
  readonly foam: Float32Array; readonly wet: Float32Array; readonly pixels: Uint8Array;
  private quiet: Uint8Array;
  private nextFoam: Float32Array; private accumulator = 0;
  private waves:HistoryWaves;private waveKey='';
  time = 0; clock = 0;
  constructor(site: Project['site'], public ocean: Ocean) {
    this.field = buildCoastField(site, ocean); const n = this.field.heights.length;
    this.foam = new Float32Array(n); this.nextFoam = new Float32Array(n); this.wet = new Float32Array(n); this.pixels = new Uint8Array(n * 4);
    this.quiet = new Uint8Array(n);
    this.waves=new HistoryWaves(n);
    const f=this.field,maxWater=ocean.amplitude*Math.max(1.5,ocean.swash)*1.3;
    for(let i=0;i<n;i++) {
      const depth=ocean.level-f.heights[i],footprint=Math.max(0.015,f.shoreSlope[i]*Math.max(f.dx,f.dz)*0.65);
      const deepestSource=Math.max(2,ocean.amplitude*ocean.swash*2,Math.max(0.18,ocean.amplitude*f.packed[i*4+3]*2.6)*2.8);
      this.quiet[i]=Number(depth < -maxWater-footprint || depth > deepestSource+maxWater+footprint);
    }
  }
  clearHistory() { this.foam.fill(0); this.nextFoam.fill(0); this.wet.fill(0); this.pixels.fill(0); }
  advanceClock(delta: number) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.time += this.accumulator + Math.min(delta, 0.25) * this.ocean.speed; this.accumulator = 0; this.clock = this.time * this.field.omega;
  }
  advance(delta: number): boolean {
    if (!Number.isFinite(delta) || delta <= 0 || this.ocean.speed === 0) return false;
    this.accumulator += Math.min(delta, 0.25) * this.ocean.speed;
    let changed = false;
    while (this.accumulator >= 1/20 - 1e-9) { this.step(1/20); this.accumulator = Math.max(0, this.accumulator - 1/20); changed = true; }
    this.clock = (this.time + this.accumulator) * this.field.omega;
    return changed;
  }
  private step(dt: number) {
    this.time += dt; this.clock = this.time * this.field.omega;
    const f = this.field, ocean = this.ocean, angle = ocean.direction * Math.PI / 180, tx = -Math.sin(angle), tz = Math.cos(angle);
    const decay = Math.exp(-dt / ocean.foamPersistence), dry = Math.exp(-dt / ocean.dryingTime);
    const reference=historyWaveReference();
    const key=[ocean.direction,ocean.wavelength,ocean.level,ocean.amplitude,ocean.breaker,ocean.swash].join(':');
    if(key!==this.waveKey){
      for(let r=0;r<f.rows;r++)for(let c=0;c<f.columns;c++){
        const i=r*f.columns+c,x=c*f.dx-f.width/2,z=r*f.dz-f.depth/2;
        this.waves.set(i,f.phase[i],x*tx+z*tz,TAU/ocean.wavelength,ocean.level-f.heights[i],f.packed[i*4+3],ocean.amplitude,ocean.breaker,ocean.swash);
      }
      this.waveKey=key;
    }
    for (let r = 0; r < f.rows; r++) for (let c = 0; c < f.columns; c++) {
      const i = r * f.columns + c, x = c * f.dx - f.width/2, z = r * f.dz - f.depth/2,depth=ocean.level-f.heights[i];
      // Residual offshore foam used to disable the quiet-cell shortcut forever:
      // tiny advected values then triggered full swell solves over deep water.
      // Here near-shore velocity and every source/deposit term are exactly zero;
      // retain the same phase-driven drift and decay without evaluating swells.
      if(!reference&&this.quiet[i]&&Math.abs(depth)>=2.5){
        const drift=.08*Math.sin(f.phase[i]-this.clock);
        const old=bilinear(this.foam,f.columns,f.rows,c-tx*drift*dt/f.dx,r-tz*drift*dt/f.dz);
        this.nextFoam[i]=clamp(old*decay,0,.85);this.wet[i]*=dry;
        this.pixels[i*4]=Math.round(this.nextFoam[i]*255);this.pixels[i*4+1]=Math.round(this.wet[i]*255);
        this.pixels[i*4+2]=depth>0?255:0;this.pixels[i*4+3]=255;continue;
      }
      // No possible wave/foam/wetness source here. Still evaluate cells containing
      // residual foam or a neighbor that could advect into them. A fixed step's
      // maximum backtrace is < one cell for every supported site/control value.
      if(this.quiet[i] && this.wet[i]===0) {
        let empty=true;
        for(let rr=Math.max(0,r-1);rr<=Math.min(f.rows-1,r+1)&&empty;rr++) for(let cc=Math.max(0,c-1);cc<=Math.min(f.columns-1,c+1);cc++) if(this.foam[rr*f.columns+cc]!==0){empty=false;break;}
        if(empty){this.nextFoam[i]=0;this.pixels[i*4]=0;this.pixels[i*4+1]=0;this.pixels[i*4+2]=f.heights[i]<ocean.level?255:0;this.pixels[i*4+3]=255;continue;}
      }
      const wave=reference
        ? coastalWave(f.phase[i],x*tx+z*tz,this.clock,TAU/ocean.wavelength,depth,f.packed[i*4+3],ocean.amplitude,ocean.breaker,ocean.swash)
        : this.waves.sample(i,this.clock);
      const sample={...wave,p:f.phase[i]-this.clock,thickness:depth+wave.height};
      const near = 1 - smooth(0.5, 2.5, Math.abs(depth)), velocity = sample.crest * ocean.amplitude * (1.5 + ocean.swash) * near;
      const vx = f.shoreX[i] * velocity + tx * 0.08 * Math.sin(sample.p), vz = f.shoreZ[i] * velocity + tz * 0.08 * Math.sin(sample.p);
      const old = bilinear(this.foam, f.columns, f.rows, c - vx * dt / f.dx, r - vz * dt / f.dz);
      const covered = sample.thickness > 0.008;
      const waterEdge = covered ? (1 - smooth(0.02, 0.2, sample.thickness)) * near * Math.max(0, ocean.swash) * Math.min(1, ocean.amplitude / 0.16) : 0;
      const variation = 0.5 + 0.5 * Math.sin(x * 1.31 + z * 0.87 + Math.sin(z * 2.1));
      const source = (sample.breaking * 0.65 + waterEdge * 0.16) * (0.25 + 0.75 * variation) * ocean.foam;
      this.nextFoam[i] = clamp(old * decay + source * dt * (1 - old) ** 2, 0, 0.85);
      const footprint = Math.max(0.015, f.shoreSlope[i] * Math.max(f.dx, f.dz) * 0.65);
      const deposit = Math.abs(depth) < Math.max(2, ocean.amplitude * ocean.swash * 2) ? smooth(-footprint, footprint, sample.thickness - 0.008) : 0;
      this.wet[i] = Math.max(deposit, this.wet[i] * dry);
      this.pixels[i*4] = Math.round(this.nextFoam[i] * 255); this.pixels[i*4+1] = Math.round(this.wet[i] * 255);
      this.pixels[i*4+2] = covered ? Math.round(clamp(sample.thickness / 0.3) * 255) : 0; this.pixels[i*4+3] = 255;
    }
    this.foam.set(this.nextFoam);
  }
}
