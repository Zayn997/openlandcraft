import type { SwimRoute } from '@openlandcraft/core';

/** Gentle acceleration, a shallow vertical excursion, and an independent tail cadence. */
export function fishSwimPose(time: number, seed: number, route: SwimRoute, phase = 0) {
  const speed = 0.22 + seed*0.08, cycle = time*0.45+seed*Math.PI*2;
  const angle = time*speed + 0.12*Math.sin(cycle) + seed*Math.PI*2 + phase*Math.PI/180;
  const velocity = speed + 0.054*Math.cos(cycle);
  const vx = -route.rx*Math.sin(angle)*velocity, vz = route.rz*Math.cos(angle)*velocity;
  return { x:route.x+route.rx*Math.cos(angle), y:route.y+route.bob*Math.sin(cycle), z:route.z+route.rz*Math.sin(angle),
    yaw:Math.atan2(vx,vz), pitch:-Math.atan2(route.bob*0.45*Math.cos(cycle),Math.hypot(vx,vz)),
    bank:0.035*Math.sin(angle), clipTime:time*(0.85+seed*0.35)+0.08*Math.sin(cycle)+seed*1.2 };
}
