/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSite, createPlacedInstance, createLake, createRiver, encodeGlb, evaluateProject, fishHabitat, fishSchools, layerDisplayProject, type Instance, type Ocean } from '@openlandcraft/core';
import { fishSchoolPose } from './fish-school-motion';
import { advanceBirdTime } from './bird-flight';

const data=encodeGlb(readFileSync(new URL('../../../apps/web/public/models/fish/reef-fish.glb',import.meta.url)));
function scene(count:number) {
  const p=createSite({name:'School test',width:80,depth:80,resolution:129,preset:'flat'});
  p.site.terrain.heights.fill(-5);
  p.assets=[{id:'fish',name:'Fish',data,attribution:''},{id:'other-fish',name:'Another fish asset',data,attribution:''}];
  p.entities=[{id:'ocean',kind:'ocean',parentId:'site',name:'Ocean',visible:true,level:0,amplitude:0.2} as Ocean];
  for(let i=0;i<count;i++) {
    const e=createPlacedInstance(p,p.assets[i%2],0,0,false,`fish-${String(i).padStart(2,'0')}`);
    e.anchor='fixed';e.position[1]=-1.4;p.entities.push(e);
  }
  return p;
}
describe('fish schools',()=>{
  it('groups nearby fish across assets into small schools with deterministic, non-overlapping routes',()=>{
    const p=scene(12),plan=fishSchools(p),habitat=fishHabitat(p);
    expect(plan.size).toBe(12);expect(new Set([...plan.values()].map(m=>m.school.count))).toEqual(new Set([8,4]));
    expect(fishSchools(p)).toBe(plan);
    const reversed={...p,entities:[...p.entities].reverse()};expect([...fishSchools(reversed)]).toEqual([...plan]);
    const members=[...plan.values()];
    for(let time=0;time<180;time+=0.13) {
      const poses=members.map(m=>fishSchoolPose(time,m));
      poses.forEach((pose,i)=>{
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
        const bounds=habitat[0].sample(pose.x,pose.z,0.5)!;
        expect(bounds).not.toBeNull();expect(pose.y).toBeGreaterThanOrEqual(bounds.low);expect(pose.y).toBeLessThanOrEqual(bounds.high);
        const next=fishSchoolPose(time+0.016,members[i]);
        expect(Math.hypot(next.x-pose.x,next.y-pose.y,next.z-pose.z)).toBeLessThan(0.04);
        expect(Math.abs(Math.atan2(Math.sin(next.yaw-pose.yaw),Math.cos(next.yaw-pose.yaw)))).toBeLessThan(0.025);
        for(let j=0;j<i;j++) expect(Math.hypot(pose.x-poses[j].x,pose.y-poses[j].y,pose.z-poses[j].z)).toBeGreaterThan(1.15);
      });
    }
  });
  it('keeps mixed sizes separated and turns the school together',()=>{
    const p=scene(6);(p.entities[2] as Instance).scale=[1.4,0.7,1.2];
    const plan=fishSchools(p),members=[...plan.values()];expect(plan.size).toBe(6);
    for(let t=0;t<120;t+=0.17) {
      const poses=members.map(m=>fishSchoolPose(t,m));
      for(let i=0;i<poses.length;i++) for(let j=0;j<i;j++) {
        expect(Math.hypot(poses[i].x-poses[j].x,poses[i].y-poses[j].y,poses[i].z-poses[j].z)).toBeGreaterThan(1.6);
        expect(Math.cos(poses[i].yaw-poses[j].yaw)).toBeGreaterThan(0.5);
      }
    }
  });
  it('splits tight habitats, respects hidden water and recovers after edits without dropping saved fish',()=>{
    const p=scene(5);p.entities=p.entities.filter(e=>e.kind==='instance');p.site.terrain.heights.fill(0);
    const lake=createLake(p,[[-6,-6],[6,-6],[6,6],[-6,6]]);lake.depth=3;p.entities.push(lake);
    const displayed=evaluateProject(p),plan=fishSchools(displayed);expect(plan.size).toBeGreaterThan(0);
    for(const member of plan.values()) for(let t=0;t<60;t+=0.3) {
      const pose=fishSchoolPose(t,member);expect(fishHabitat(displayed)[0].sample(pose.x,pose.z,0.5)).not.toBeNull();
    }
    const hidden={...p,layers:p.layers.map(l=>({...l,visible:false}))};
    expect(fishSchools(layerDisplayProject(evaluateProject(hidden))).size).toBe(0);
    expect(p.entities.filter(e=>e.kind==='instance')).toHaveLength(5);
    expect(fishSchools(evaluateProject(p)).size).toBe(plan.size);
    const river=createRiver(p);river.points=[[0,0,-25],[0,0,0],[0,0,25]];river.width=6;river.depth=3;
    const riverProject=evaluateProject({...p,entities:[...p.entities.filter(e=>e.kind==='instance'),river]});
    const riverPlan=fishSchools(riverProject);expect(riverPlan.size).toBeGreaterThan(0);
    for(const member of riverPlan.values()) for(let t=0;t<60;t+=0.3) {
      const pose=fishSchoolPose(t,member);expect(fishHabitat(riverProject)[0].sample(pose.x,pose.z,0.5)).not.toBeNull();
    }
  });
  it('preserves spacing under pause, reduced motion, long frames, and different tail phases',()=>{
    const plan=fishSchools(scene(3)),member=[...plan.values()][0];
    for(const [playing,reduced] of [[false,false],[true,true]]) expect(fishSchoolPose(advanceBirdTime(8,20,playing,reduced),member)).toEqual(fishSchoolPose(8,member));
    const a=fishSchoolPose(8,member,0),b=fishSchoolPose(8,member,180);
    expect([a.x,a.y,a.z,a.yaw]).toEqual([b.x,b.y,b.z,b.yaw]);expect(a.clipTime).not.toBe(b.clipTime);
    expect(fishSchoolPose(advanceBirdTime(8,20,true,false),member)).toEqual(fishSchoolPose(8.1,member));
  });
});
