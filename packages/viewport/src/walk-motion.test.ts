import { describe, expect, it } from 'vitest';
import { createSite, createBuilding, createPath, createOcean, groundHabitat } from '@openlandcraft/core';
import { advanceWalk, findWalkSpawn, walkDirection, type WalkPose, type WalkEnvironment } from './walk-motion';

const input = { forward: 1, right: 0, yaw: 0, running: false };
const start: WalkPose = { x: 0, y: 0, z: 0, yaw: 0, falling: 0, speed: 0 };
const flat: WalkEnvironment = { floor: () => 0, clear: () => true };
function travel(fps: number, overrides = {}, world = flat) {
  let pose = { ...start };
  for (let i = 0; i < fps; i++) pose = advanceWalk(pose, { ...input, ...overrides }, 1 / fps, world);
  return pose;
}

describe('Explore movement', () => {
  it('moves relative to the camera and normalizes diagonal input', () => {
    expect(walkDirection(input)).toEqual({ x: 0, z: -1 });
    expect(walkDirection({ ...input, yaw: Math.PI / 2 }).x).toBeCloseTo(-1);
    expect(walkDirection({ ...input, forward: 0, right: 1 }).x).toBe(1);
    for (const right of [-1, 1]) expect(Math.hypot(...Object.values(walkDirection({ ...input, right })))).toBeCloseTo(1);
  });
  it('walks at the same speed across frame rates, runs faster, and stops on released input', () => {
    expect(travel(30).z).toBeCloseTo(-2.1, 8);
    expect(travel(144).z).toBeCloseTo(travel(30).z, 8);
    expect(Math.hypot(travel(60, { right: 1 }).x, travel(60, { right: 1 }).z)).toBeCloseTo(2.1, 8);
    expect(travel(60, { running: true }).z).toBeCloseTo(-4.4, 8);
    const stop = advanceWalk(travel(60), { ...input, forward: 0 }, 1 / 60, flat);
    expect(stop.z).toBeCloseTo(-2.1); expect(stop.speed).toBe(0);
    expect(advanceWalk(start, input, NaN, flat)).toEqual(start);
    expect(Math.abs(advanceWalk(start, input, 30, flat).z)).toBeCloseTo(0.21, 10);
  });
  it('blocks thin obstacles with substeps and slides along a wall', () => {
    const wall: WalkEnvironment = { floor: () => 0, clear: (from, x, z) => !(from.z > -0.1 && z <= -0.1) };
    const blocked = advanceWalk(start, { ...input, running: true }, 0.1, wall);
    expect(blocked.z).toBeGreaterThan(-0.1);
    const sliding = travel(60, { right: 1 }, wall);
    expect(sliding.x).toBeGreaterThan(1.4); expect(sliding.z).toBeGreaterThan(-0.1);
  });
  it('steps onto low rises, rejects high ledges, and falls onto lower ground', () => {
    for (const rise of [0.25, 1]) {
      const world: WalkEnvironment = { floor: (x, z) => z < -0.5 ? rise : 0, clear: () => true };
      const pose = travel(60, {}, world);
      if (rise < 0.34) { expect(pose.z).toBeCloseTo(-2.1); expect(pose.y).toBe(rise); }
      else { expect(pose.z).toBeGreaterThanOrEqual(-0.5); expect(pose.y).toBe(0); }
    }
    let pose = { ...start, y: 2 };
    for (let i = 0; i < 60; i++) pose = advanceWalk(pose, { ...input, forward: 0 }, 1 / 60, flat);
    expect(pose.y).toBe(0); expect(pose.falling).toBe(0);
  });
  it('chooses a clear path entrance without modifying the project and reports fully blocked sites', () => {
    const project = createSite({ name: 'Explore', width: 40, depth: 40, resolution: 129, preset: 'flat' });
    const path = createPath(project, [[0, -10], [0, 12]]); project.entities.push(path);
    const before = JSON.stringify(project);
    expect(findWalkSpawn(project)).toEqual([0, 12]); expect(JSON.stringify(project)).toBe(before);
    project.entities.push(...createBuilding(project, 0, 12, 4, 4));
    const alternate = findWalkSpawn(project)!;
    expect(alternate).not.toEqual([0, 12]); expect(groundHabitat(project).clear(...alternate, 0.33)).toBe(true);
    project.entities.push(...createBuilding(project, 0, 0, 40, 40));
    expect(findWalkSpawn(project)).toBeNull();
  });
  it('jumps once per press, lands, and can jump again after Space is released', () => {
    for (const fps of [30, 60, 144]) {
      let pose = { ...start }, peak = 0;
      for (let i = 0; i < fps * 2; i++) { pose = advanceWalk(pose, { ...input, forward: 0, jump: true }, 1 / fps, flat); peak = Math.max(peak, pose.y); }
      expect(peak).toBeCloseTo(1.174, 2); expect(pose.y).toBe(0); expect(pose.motion).toBe('ground');
      pose = advanceWalk(pose, { ...input, forward: 0, jump: false }, 1 / fps, flat);
      pose = advanceWalk(pose, { ...input, forward: 0, jump: true }, 1 / fps, flat);
      expect(pose.y).toBeGreaterThan(0); expect(pose.motion).toBe('air');
    }
  });
  it('does not allow a second jump while airborne and preserves horizontal movement', () => {
    const launch = advanceWalk(start, { ...input, jump: true }, 1 / 60, flat);
    const released = advanceWalk(launch, input, 1 / 60, flat);
    const pressed = advanceWalk(released, { ...input, jump: true }, 1 / 60, flat);
    const unpressed = advanceWalk(released, input, 1 / 60, flat);
    expect(pressed.y).toBe(unpressed.y); expect(pressed.falling).toBe(unpressed.falling); expect(pressed.z).toBeLessThan(0);
  });
  it('floats, swims more slowly than walking, and treads water when input stops', () => {
    const world: WalkEnvironment = { ...flat, water: () => 3, height: 1.78 };
    const swimmer = { ...start, y: 3 - 1.78 * 0.52, motion: 'swim' as const };
    let pose = swimmer;
    for (let i = 0; i < 120; i++) pose = advanceWalk(pose, input, 1 / 60, world) as typeof swimmer;
    expect(pose.z).toBeCloseTo(-2.7); expect(pose.y).toBeCloseTo(swimmer.y); expect(pose.motion).toBe('swim');
    const stopped = advanceWalk(pose, { ...input, forward: 0, jump: true }, 1 / 60, world);
    expect(stopped.speed).toBe(0); expect(stopped.y).toBeCloseTo(swimmer.y); expect(stopped.motion).toBe('swim');
  });
  it('transitions from walking into deep water and back up a sloping shore', () => {
    const world: WalkEnvironment = { clear: () => true, water: () => 2, floor: (x, z) => Math.max(0, Math.min(2, 2 + z * 0.4)) };
    let pose = { ...start, y: 2 };
    for (let i = 0; i < 360; i++) pose = advanceWalk(pose, input, 1 / 60, world);
    expect(pose.motion).toBe('swim'); expect(pose.y).toBeCloseTo(2 - 1.78 * 0.52);
    for (let i = 0; i < 600; i++) pose = advanceWalk(pose, { ...input, forward: -1 }, 1 / 60, world);
    expect(pose.z).toBeGreaterThan(0); expect(pose.motion).toBe('ground'); expect(pose.y).toBe(2);
  });
  it('catches a fall into water without teleporting a jump into swimming', () => {
    const world: WalkEnvironment = { ...flat, water: () => 3 };
    let pose = { ...start, y: 4, motion: 'air' as const } as WalkPose;
    pose = advanceWalk(pose, { ...input, forward: 0 }, 1 / 60, world); expect(pose.motion).toBe('air');
    for (let i = 0; i < 180; i++) pose = advanceWalk(pose, { ...input, forward: 0 }, 1 / 60, world);
    expect(pose.motion).toBe('swim'); expect(pose.y).toBeCloseTo(3 - 1.78 * 0.52);
  });
  it('finds a swim spawn on a completely flooded site without changing the project', () => {
    const project = createSite({ name: 'Flooded', width: 40, depth: 40, resolution: 129, preset: 'flat' }), ocean = createOcean(); ocean.level = 5; project.entities.push(ocean);
    const before = JSON.stringify(project); expect(findWalkSpawn(project)).not.toBeNull(); expect(JSON.stringify(project)).toBe(before);
  });
});
