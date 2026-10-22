import type { SchoolMember } from '@openlandcraft/core';

function position(time:number,member:SchoolMember) {
  const {school,side,along,wander,seed}=member, {route}=school;
  const phase=school.seed*Math.PI*2, speed=0.65*school.scale/Math.max(route.rx,route.rz);
  const angle=time*speed+phase+0.07*Math.sin(time*0.28+phase);
  const dx=-route.rx*Math.sin(angle), dz=route.rz*Math.cos(angle), length=Math.hypot(dx,dz);
  const fx=dx/length, fz=dz/length;
  // Bounded offsets: each member stays inside its reserved slot through every turn.
  const across=side+wander*0.6*Math.sin(time*0.65+seed*17);
  const forward=along+wander*0.6*Math.sin(time*0.51+seed*23);
  return { x:route.x+route.rx*Math.cos(angle)+fx*forward+fz*across,
    y:route.y+route.bob*Math.sin(time*0.3+phase)+0.02*school.scale*Math.sin(time*0.44+seed*13),
    z:route.z+route.rz*Math.sin(angle)+fz*forward-fx*across };
}

export function fishSchoolPose(time:number,member:SchoolMember,tailPhase=0) {
  const p=position(time,member), before=position(time-0.01,member), after=position(time+0.01,member);
  const vx=(after.x-before.x)/0.02,vy=(after.y-before.y)/0.02,vz=(after.z-before.z)/0.02;
  const speed=Math.hypot(vx,vy,vz),phase=member.seed*Math.PI*2;
  return {...p,yaw:Math.atan2(vx,vz),pitch:-Math.atan2(vy,Math.hypot(vx,vz)),bank:0.025*Math.sin(time*0.28+phase),
    clipTime:time*(0.85+member.seed*0.15)+member.seed*1.2+0.08*Math.sin(time*0.65+phase)+tailPhase/360*1.2,
    // Outer members paddle a little harder; phase remains independent without displacing their slots.
    effort:Math.min(1,0.7+speed/(member.school.scale*3))};
}
