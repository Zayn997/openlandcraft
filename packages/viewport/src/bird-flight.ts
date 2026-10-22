import type { Project } from '@openlandcraft/core';

export function birdSeed(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}
export function advanceBirdTime(time: number, delta: number, playing: boolean, reducedMotion: boolean): number {
  return time + (playing && !reducedMotion ? Math.min(0.1, Math.max(0, delta)) : 0);
}

/** A smooth, deterministic orbit. Position is a flight center, not a moving saved transform. */
export function birdFlightPose(time: number, seed: number, center: readonly number[], site: Pick<Project['site'], 'width' | 'depth'>, floor: number, rotation = 0) {
  const margin = 2, halfX = Math.max(1, site.width / 2 - margin), halfZ = Math.max(1, site.depth / 2 - margin);
  const rx = Math.min(7 + seed * 5, halfX * 0.65), rz = Math.min(6 + seed * 3, halfZ * 0.65);
  const cx = Math.max(-halfX + rx, Math.min(halfX - rx, center[0]));
  const cz = Math.max(-halfZ + rz, Math.min(halfZ - rz, center[2]));
  const speed = 0.22 + seed * 0.08, phase = seed * Math.PI * 2, angle = time * speed + phase + rotation * Math.PI / 180;
  const vx = -rx * Math.sin(angle) * speed, vz = rz * Math.cos(angle) * speed;
  const bob = time * 0.65 + phase;
  const y = Math.max(center[1], floor + 3) + Math.sin(bob) * 0.6;
  // Smoothly reduce wing motion during glides; independent phase avoids a mechanical flock.
  const effort = Math.max(0, Math.min(1, (Math.sin(time * 0.8 + phase) + 0.2) * 2));
  const flapWeight = effort * effort * (3 - 2 * effort);
  return { x: cx + Math.cos(angle) * rx, y, z: cz + Math.sin(angle) * rz,
    yaw: Math.atan2(vx, vz), pitch: -Math.atan2(0.39 * Math.cos(bob), Math.hypot(vx, vz)),
    bank: Math.atan2(rx * rz * speed * speed, Math.hypot(rx * Math.sin(angle), rz * Math.cos(angle)) * 9.81),
    flapWeight, clipTime: time * (1.1 + seed * 0.35) + seed * 0.8 };
}
