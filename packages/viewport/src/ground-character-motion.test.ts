/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSite, createPlacedInstance, encodeGlb, groundRoutes, groundHabitat, groundHeight, evaluateProject, createBuilding, createLake, layerDisplayProject, type Ocean, type Instance } from '@openlandcraft/core';
import { groundCharacterPose } from './ground-character-motion';
import { advanceBirdTime } from './bird-flight';
import {HORSE_STRIDE_METRES,HORSE_WALK_DURATION} from './horse-walk';

const horse = {id:'horse',name:'Horse',data:encodeGlb(readFileSync(new URL('../../../apps/web/public/models/characters/horse.glb',import.meta.url))),attribution:''};
const person = {id:'person',name:'Person',data:encodeGlb(readFileSync(new URL('../../../apps/web/public/models/characters/person-male.glb',import.meta.url))),attribution:''};
function scene() {
  const p = createSite({name:'Ground motion',width:60,depth:60,resolution:129,preset:'flat'}); p.site.terrain.heights.fill(3); p.assets = [horse,person]; return p;
}
describe('ground character routes', () => {
  it('indexes dense vegetation without losing obstacles on cell borders or oversized objects',()=>{
    const p=scene(),bytes=readFileSync(new URL('../../../apps/web/public/models/plants/pine.glb',import.meta.url));
    const pine={id:'pine',name:'Pine',data:encodeGlb(bytes),attribution:''};p.assets.push(pine);
    p.entities=Array.from({length:49},(_,i)=>createPlacedInstance(p,pine,(i%7-3)*8,Math.floor(i/7-3)*8,false,`pine-${i}`));
    const dense=groundHabitat(p);
    // Brute-force each individual obstacle is an independent reference to the index.
    const singles=p.entities.map(entity=>groundHabitat({...p,entities:[entity]}));
    for(let z=-27;z<=27;z+=2.71)for(let x=-27;x<=27;x+=2.13)for(const radius of [.2,1,3])
      expect(dense.clear(x,z,radius)).toBe(singles.every(h=>h.clear(x,z,radius)));
    const giant={...p.entities[0],position:[0,0,0],scale:[100,100,100]} as Instance;
    expect(groundHabitat({...p,entities:[giant]}).clear(12,12,.5)).toBe(false);
  });
  it('paces horse gait by travelled distance and scales stride with the animal',()=>{
    const p=scene();p.entities=[createPlacedInstance(p,horse,0,0,false,'horse')];
    const route=groundRoutes(p).get('horse')!;
    for(const scale of [1,1.5]){
      const r={...route,speed:route.speed*scale,entity:{...route.entity,scale:[scale,scale,scale] as Instance['scale']}};
      const seconds=HORSE_STRIDE_METRES*scale/r.speed;
      expect(groundCharacterPose(seconds,r,p).clipTime-groundCharacterPose(0,r,p).clipTime).toBeCloseTo(HORSE_WALK_DURATION,8);
    }
  });
  it('keeps scaled horses and people apart, with smooth turns and terrain following', () => {
    const p = scene(); p.site.terrain.heights = p.site.terrain.heights.map((_,i) => 3+(i%p.site.terrain.columns)*0.01);
    p.entities = [[-12,0],[0,0],[12,0]].map(([x,z],i) => createPlacedInstance(p,p.assets[i%2],x,z,false,`actor-${i}`));
    (p.entities[2] as Instance).scale = [1.25,1.25,1.25];
    const routes = groundRoutes(p), habitat = groundHabitat(p); expect(routes.size).toBe(3); expect(groundRoutes(p)).toBe(routes);
    expect([...groundRoutes({...p,entities:[...p.entities].reverse()})]).toEqual([...routes]);
    expect([...routes.values()].filter(route => route.kind === 'horse').every(route => route.radius > 0)).toBe(true);
    expect([...routes.values()].find(route => route.kind === 'person')?.reason).toBe('no-path');
    for (let time = 0; time < 100; time += 0.27) {
      const members = [...routes.values()], poses = members.map(r => groundCharacterPose(time,r,p));
      poses.forEach((pose,i) => {
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
        expect(habitat.clear(pose.x,pose.z,members[i].bodyRadius)).toBe(true);
        expect(pose.y).toBeCloseTo(groundHeight(pose.x,pose.z,p.site),8);
        const next = groundCharacterPose(time+0.016,members[i],p);
        expect(Math.hypot(next.x-pose.x,next.z-pose.z)).toBeLessThan(0.025);
        expect(Math.abs(next.yaw-pose.yaw)).toBeLessThan(0.01);
        for (let j = i+1; j < poses.length; j++)
          expect(Math.hypot(pose.x-poses[j].x,pose.z-poses[j].z)).toBeGreaterThan(members[i].bodyRadius+members[j].bodyRadius);
      });
    }
    expect(advanceBirdTime(4,0.016,false,false)).toBe(4);
    expect(advanceBirdTime(4,0.016,true,true)).toBe(4);
  });
  it('uses idle where a walk cannot fit and hides unsafe centers after later edits', () => {
    const p = scene(), a = createPlacedInstance(p,person,0,0,false,'a'), b = createPlacedInstance(p,horse,3,0,false,'b');
    p.entities = [a,b]; expect([...groundRoutes(p).values()].map(r => r.radius)).toEqual([0,0]);
    const crowded = {...p,entities:[a,{...b,position:[0,0,0] as Instance['position']}]};
    expect(groundRoutes(crowded).size).toBe(1); expect(crowded.entities).toHaveLength(2);
    const fixed = {...p,entities:[{...a,anchor:'fixed' as const,position:[0,3,0] as Instance['position']}]};
    expect(groundRoutes(fixed).get('a')?.radius).toBe(0);
    const edge = {...p,entities:[{...a,position:[29.8,0,0] as Instance['position']}]}; expect(groundRoutes(edge).size).toBe(0);
    const steep = scene(); steep.entities = [a]; steep.site.terrain.heights = steep.site.terrain.heights.map((_,i) => i%129 < 64 ? 0 : 10);
    expect(groundRoutes(steep).size).toBe(0);
  });
  it('avoids architecture, lake and ocean and respects layer visibility', () => {
    const p = scene(), a = createPlacedInstance(p,horse,0,0,false,'a');
    p.entities = [a,...createBuilding(p,0,0,8,8)]; expect(groundRoutes(p).size).toBe(0);
    p.entities = [a,createLake(p)];
    const lake = p.entities.find(e => e.kind === 'lake')!; a.position = [lake.points[0][0],0,lake.points[0][1]];
    expect(groundRoutes(evaluateProject(p)).size).toBe(0);
    p.entities = [a,{id:'water',kind:'ocean',parentId:'site',visible:true,name:'Water',level:5,amplitude:0.2} as Ocean];
    expect(groundRoutes(p).size).toBe(0);
    p.entities = [a]; p.layers[0].visible = false; expect(groundRoutes(layerDisplayProject(p,null)).size).toBe(0);
  });
});
