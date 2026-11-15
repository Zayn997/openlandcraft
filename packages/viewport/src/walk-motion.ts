import { groundHabitat, groundHeight, type PlanPoint, type Project } from '@openlandcraft/core';
import { experienceWaterSurface } from './experience-water';

export type WalkInput = { forward: number; right: number; yaw: number; running: boolean; jump?: boolean };
export type WalkMotion = 'ground' | 'air' | 'swim';
export type WalkPose = { x: number; y: number; z: number; yaw: number; falling: number; speed: number; motion?: WalkMotion; jumpHeld?: boolean };
export type WalkEnvironment = {
  floor: (x: number, z: number, ceiling: number) => number;
  clear: (from: WalkPose, x: number, z: number) => boolean;
  water?: (x: number, z: number) => number | null;
  rise?: (from: WalkPose, toY: number) => number;
  height?: number;
};
export const WALK_RADIUS = 0.28;
export const WALK_STEP = 0.34;
export const JUMP_SPEED = 4.8;
export const SWIM_FLOAT_RATIO = 0.52;

/** Diagonal input has the same speed as forward input, independent of frame rate. */
export function walkDirection(input: WalkInput) {
  const length = Math.hypot(input.forward, input.right);
  if (!length) return { x: 0, z: 0 };
  const forward = input.forward / Math.max(1, length), right = input.right / Math.max(1, length);
  return { x: right * Math.cos(input.yaw) - forward * Math.sin(input.yaw), z: -right * Math.sin(input.yaw) - forward * Math.cos(input.yaw) };
}

/** Small collision steps avoid tunnelling. Trying each axis lets the player slide along walls. */
export function advanceWalk(pose: WalkPose, input: WalkInput, delta: number, world: WalkEnvironment): WalkPose {
  const dt = Math.min(0.1, Math.max(0, Number.isFinite(delta) ? delta : 0));
  if (!dt) return { ...pose };
  const height = world.height ?? 1.78;
  const direction = walkDirection(input), swimming = pose.motion === 'swim';
  const speed = swimming ? (input.running ? 2.1 : 1.35) : input.running ? 4.4 : 2.1;
  const count = Math.max(1, Math.ceil(speed * dt / 0.12)), step = dt / count;
  const next = { ...pose };
  const startingFloor = world.floor(next.x, next.z, next.y + 0.02);
  if (input.jump && !pose.jumpHeld && !swimming && next.y <= startingFloor + 0.03 && next.falling >= 0) {
    next.falling = -JUMP_SPEED; next.motion = 'air';
  }
  next.jumpHeld = !!input.jump;
  let travelled = 0;
  for (let i = 0; i < count; i++) {
    const dx = direction.x * speed * step, dz = direction.z * speed * step;
    const move = (x: number, z: number) => {
      const floor = world.floor(x, z, next.y + WALK_STEP);
      const stepHeight = next.motion === 'air' ? 0.02 : WALK_STEP;
      if (floor > next.y + stepHeight + 1e-5 || !world.clear(next, x, z)) return false;
      travelled += Math.hypot(x - next.x, z - next.z); next.x = x; next.z = z;
      if (floor > next.y && next.motion !== 'air') { next.y = floor; next.falling = 0; }
      return true;
    };
    if ((dx || dz) && !move(next.x + dx, next.z + dz)) {
      if (dx) move(next.x + dx, next.z);
      if (dz) move(next.x, next.z + dz);
    }
    const floor = world.floor(next.x, next.z, next.y + WALK_STEP);
    const surface = world.water?.(next.x, next.z) ?? null;
    const deep = surface !== null && surface - floor > height * (next.motion === 'swim' ? 0.52 : 0.62);
    if (deep && next.y < surface - height * 0.4 && next.falling >= 0) {
      const floatY = Math.max(floor, surface - height * SWIM_FLOAT_RATIO);
      next.y += (floatY - next.y) * (1 - Math.exp(-10 * step)); next.falling = 0; next.motion = 'swim';
    } else if (next.falling < 0 || next.y > floor + 0.015) {
      const y = next.y - next.falling * step - 0.5 * 9.81 * step * step;
      next.falling += 9.81 * step;
      next.y = y > next.y ? (world.rise?.(next, y) ?? y) : Math.max(floor, y);
      if (next.y < y - 1e-6) next.falling = Math.max(0, next.falling);
      if (next.y <= floor && next.falling >= 0) { next.y = floor; next.falling = 0; next.motion = 'ground'; }
      else next.motion = 'air';
    } else { next.y = floor; next.falling = 0; next.motion = 'ground'; }
  }
  next.speed = dt ? travelled / dt : 0;
  if (travelled > 1e-5) {
    const facing = Math.atan2(direction.x, direction.z), difference = Math.atan2(Math.sin(facing - next.yaw), Math.cos(facing - next.yaw));
    next.yaw += difference * (1 - Math.exp(-14 * dt));
  }
  return next;
}

/** Prefer the entrance end of a walking path, then try dry, clear ground around the site. */
export function findWalkSpawn(project: Project): PlanPoint | null {
  const habitat = groundHabitat({ ...project, entities: project.entities.filter(entity => entity.kind !== 'path' || !entity.bridge) });
  const candidates: PlanPoint[] = project.entities.flatMap(entity => entity.kind === 'path' && entity.visible && !entity.bridge ? entity.points : []).map(point => [...point] as PlanPoint).sort((a, b) => b[1] - a[1]);
  candidates.push([0, project.site.depth * 0.35], [0, 0]);
  for (let ring = 1; ring <= 16; ring++) for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12;
    candidates.push([Math.sin(angle) * project.site.width * 0.46 * ring / 16, Math.cos(angle) * project.site.depth * 0.46 * ring / 16]);
  }
  const dry = candidates.find(([x, z]) => habitat.clear(x, z, WALK_RADIUS + 0.05) && Number.isFinite(groundHeight(x, z, project.site)));
  if (dry) return dry;
  const water = experienceWaterSurface(project), obstacles = groundHabitat(project, { water: false, terrain: false });
  return candidates.find(([x, z]) => water(x, z) !== null && obstacles.clear(x, z, WALK_RADIUS + 0.05)) ?? null;
}
