import { groundHeight, type GroundRoute, type Project } from '@openlandcraft/core';
import {HORSE_WALK_DURATION,HORSE_STRIDE_METRES} from './horse-walk';

/** Forward follows the tangent; feet follow evaluated terrain without per-frame planning. */
export function groundCharacterPose(time: number, route: GroundRoute, project: Project) {
  const phase = route.seed*Math.PI*2+route.entity.rotation*Math.PI/180, angle = phase+(route.radius ? time*route.speed/route.radius : 0);
  const x = route.x+route.radius*Math.cos(angle), z = route.z+route.radius*Math.sin(angle);
  const yaw = route.radius ? -angle : route.entity.rotation*Math.PI/180;
  const y = route.entity.anchor === 'terrain' ? groundHeight(x,z,project.site)+route.entity.position[1] : route.entity.position[1];
  const look = 0.5*Math.max(...route.entity.scale), fx = Math.sin(yaw)*look, fz = Math.cos(yaw)*look;
  const pitch = route.kind === 'horse' ? -Math.atan2(groundHeight(x+fx,z+fz,project.site)-groundHeight(x-fx,z-fz,project.site),2*look)*0.65 : 0;
  const clipTime=route.kind==='horse'
    ? time*route.speed/(HORSE_STRIDE_METRES*Math.max(...route.entity.scale))*HORSE_WALK_DURATION+route.seed*HORSE_WALK_DURATION
    : time*(0.94+route.seed*0.12)+route.seed*3;
  return {x,y,z,yaw,pitch,clipTime};
}
