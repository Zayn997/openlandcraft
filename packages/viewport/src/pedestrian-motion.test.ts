/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSite, createPlacedInstance, createPath, createBuilding, encodeGlb, groundRoutes, groundHabitat, parseProject, Editor, type Instance, type Project, type GroundRoute } from '@openlandcraft/core';
import { serializeProject, deserializeProject } from '@openlandcraft/project';
import { PedestrianSimulation, walkingClearance } from './pedestrian-motion';

const assets = ['person-male','person-female'].map(id => ({id,name:id,data:encodeGlb(readFileSync(new URL(`../../../apps/web/public/models/characters/${id}.glb`,import.meta.url))),attribution:''}));
function scene(width = 3.6, points: [number,number][] = [[-18,0],[18,0]]) {
  const p = createSite({name:'Pedestrian study',width:50,depth:40,resolution:129,preset:'flat'}); p.assets = assets;
  const path = createPath(p,points); path.width = width; p.entities = [path]; return p;
}
function add(p:Project,x:number,z:number,id:string,scale = 1) {
  const actor = createPlacedInstance(p,p.assets[p.entities.length%2],x,z,false,id); actor.scale = [scale,scale,scale];
  const path=p.entities.find(entity=>entity.kind==='path');if(path)actor.walkingRoute={points:path.points.map(p=>[...p]),width:path.width};
  p.entities.push(actor); return actor;
}
function simulate(p:Project,routes:ReadonlyMap<string,GroundRoute>,seconds:number) {
  const sim = new PedestrianSimulation(p,routes), habitat = groundHabitat(p), traveled = new Map([...routes.keys()].map(id => [id,0]));
  let previous = [...routes.keys()].map(id => sim.sample(id)!);
  for (let frame = 0; frame < seconds*60; frame++) {
    sim.advance(1/60);
    const poses = [...routes.keys()].map(id => sim.sample(id)!);
    poses.forEach((pose,i) => {
      const route = [...routes.values()][i], before = previous[i];
      expect(pose).toBeDefined();
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      if (frame%20 === 0) {
        expect(habitat.clear(pose.x,pose.z,route.bodyRadius)).toBe(true);
        if (route.path) expect(route.path.graph.clear(pose.x,pose.z,route.bodyRadius)).toBe(true);
      }
      const step = Math.hypot(pose.x-before.x,pose.z-before.z);
      expect(step).toBeLessThan(0.03); traveled.set(route.entity.id,traveled.get(route.entity.id)!+step);
      expect(Math.abs(Math.atan2(Math.sin(pose.yaw-before.yaw),Math.cos(pose.yaw-before.yaw)))).toBeLessThan(0.06);
      for (let j = 0; j < i; j++) {
        const other = [...routes.values()][j];
        expect(walkingClearance(before,pose,previous[j],poses[j])).toBeGreaterThanOrEqual(route.bodyRadius+other.bodyRadius+0.115);
      }
    });
    previous = poses;
  }
  return {sim,traveled};
}
describe('people walking on paths', () => {
  it('follows a rounded personal corridor with smooth turns and safe spacing',()=>{
    const p=scene(3.8,[[-18,-8],[0,-8],[0,12]]),a=add(p,-14,-8,'rounded-a'),b=add(p,-8,-8,'rounded-b');
    for(const actor of [a,b])actor.walkingRoute={...actor.walkingRoute!,cornerRounding:[0,1,0]};
    const routes=groundRoutes(p);expect([...routes.values()].every(route=>!!route.path)).toBe(true);
    const {traveled}=simulate(p,routes,70);for(const travel of traveled.values())expect(travel).toBeGreaterThan(20);
  });
  it('follows bends and turns back at the ends, with passing space across assets and sizes', () => {
    const p = scene(3.8,[[-18,-8],[-6,-8],[6,0],[18,0]]);
    add(p,-14,-8,'walker-blue',0.9); add(p,-8,-8,'walker-rust',1); add(p,3,-2,'walker-green',1.1); add(p,14,0,'walker-four',0.85);
    const routes = groundRoutes(p); expect(routes.size).toBe(4); expect([...routes.values()].every(r => !!r.path && !r.radius)).toBe(true);
    const {traveled} = simulate(p,routes,75);
    for (const travel of traveled.values()) expect(travel).toBeGreaterThan(12);
  });
  it('detours around buildings inside a wide path and respects a complete blockage', () => {
    const p = scene(6); p.entities.push(...createBuilding(p,0,-2.1,4,1.4));
    add(p,-13,0,'person-left'); add(p,13,1,'person-right');
    const routes = groundRoutes(p); expect([...routes.values()].every(r => !!r.path)).toBe(true);
    const {traveled} = simulate(p,routes,70); for (const travel of traveled.values()) expect(travel).toBeGreaterThan(15);
    const blocked = scene(3); blocked.entities.push(...createBuilding(blocked,0,0,4,8)); add(blocked,-10,0,'left-of-wall');
    const plan = groundRoutes(blocked), actor = plan.get('left-of-wall')!; expect(actor.path).toBeDefined();
    const run = new PedestrianSimulation(blocked,plan);
    for (let i = 0; i < 3600; i++) { run.advance(1/60); expect(run.sample('left-of-wall')!.x).toBeLessThan(-2.5); }
  });
  it('queues and turns back safely on a path too narrow to pass', () => {
    const p = scene(1.8); add(p,-8,0,'a'); add(p,8,0,'b');
    const routes = new Map(groundRoutes(p)); routes.get('a')!.seed = 0.1; routes.get('b')!.seed = 0.9;
    const {sim,traveled} = simulate(p,routes,80);
    expect(traveled.get('a')).toBeGreaterThan(10); expect(traveled.get('b')).toBeGreaterThan(10);
    const before = [...routes.keys()].map(id => sim.sample(id)!); let progress = 0;
    for (let i = 0; i < 900; i++) { sim.advance(1/60); progress += Math.hypot(sim.sample('a')!.x-before[0].x,sim.sample('b')!.x-before[1].x); }
    expect(progress).toBeGreaterThan(5);
  });
  it('freezes motion and gait on pause/reduced motion and is independent of frame rate', () => {
    const p = scene(); add(p,-10,0,'a'); add(p,8,0,'b'); const routes = groundRoutes(p);
    const a = new PedestrianSimulation(p,routes), b = new PedestrianSimulation(p,routes);
    for (let i = 0; i < 600; i++) a.advance(1/60);
    for (let i = 0; i < 300; i++) b.advance(1/30);
    expect(a.sample('a')).toEqual(b.sample('a'));
    const paused = a.sample('a'); a.advance(1,false); expect(a.sample('a')).toEqual(paused);
    a.advance(1,true,true); expect(a.sample('a')).toEqual(paused);
    a.advance(NaN); expect(a.sample('a')).toEqual(paused);
    a.advance(60); expect(Math.hypot(a.sample('a')!.x-paused!.x,a.sample('a')!.z-paused!.z)).toBeLessThan(0.1);
  });
  it('keeps a mixed crowd separated around a person explicitly set to idle', () => {
    const p = scene(5);
    for (let i = 0; i < 11; i++) { const actor = add(p,-16+i*3.2,0,`crowd-${String(i).padStart(2,'0')}`); if (i === 5) actor.characterAnimation = 'idle'; }
    const routes = groundRoutes(p), sim = new PedestrianSimulation(p,routes), members = [...routes.values()];
    let previous = members.map(r => sim.sample(r.entity.id)!), minimum = Infinity;
    const moved = members.map(() => 0), idleStart = sim.sample('crowd-05')!;
    for (let frame = 0; frame < 3600; frame++) {
      sim.advance(1/60); const poses = members.map(r => sim.sample(r.entity.id)!);
      poses.forEach((pose,i) => {
        moved[i] += Math.hypot(pose.x-previous[i].x,pose.z-previous[i].z);
        for (let j = 0; j < i; j++) minimum = Math.min(minimum,walkingClearance(previous[i],pose,previous[j],poses[j])-members[i].bodyRadius-members[j].bodyRadius);
      }); previous = poses;
    }
    expect(minimum).toBeGreaterThanOrEqual(0.115);
    expect(sim.sample('crowd-05')!.x).toBe(idleStart.x); expect(sim.sample('crowd-05')!.z).toBe(idleStart.z);
    moved.forEach((travel,i) => { if (members[i].entity.id !== 'crowd-05') expect(travel).toBeGreaterThan(8); });
  });
  it('saves animation choices, supports preview/cancel/undo, and migrates existing placements', () => {
    const p = scene(); const person = add(p,-5,0,'person'); const editor = new Editor(p);
    editor.begin('Choose idle'); editor.preview({type:'replace',entity:{...person,characterAnimation:'idle'}});
    expect(groundRoutes(editor.getSnapshot().preview!).get(person.id)?.reason).toBe('idle');
    editor.cancel(); expect(groundRoutes(editor.getSnapshot().project).get(person.id)?.path).toBeDefined();
    editor.execute({type:'replace',entity:{...person,characterAnimation:'idle'}},'Choose idle');
    const saved = deserializeProject(serializeProject(editor.getSnapshot().project));
    expect((saved.entities.find(e => e.id === person.id) as Instance).characterAnimation).toBe('idle');
    editor.undo(); expect((editor.getSnapshot().project.entities.find(e => e.id === person.id) as Instance).characterAnimation).toBeUndefined();
    editor.redo(); expect(groundRoutes(editor.getSnapshot().project).get(person.id)?.reason).toBe('idle');
    const old = {...p,version:15,entities:p.entities.map(entity=>{if(entity.kind!=='instance')return entity;const {walkingRoute,...legacy}=entity;return legacy;})}; expect(parseProject(old).version).toBe(31); expect(old.version).toBe(15);
    expect(() => parseProject({...p,entities:[{...person,characterAnimation:'fly'}]})).toThrow();
    const noPath = {...p,entities:[{...person,walkingRoute:undefined}]}; expect(groundRoutes(noPath).get(person.id)?.reason).toBe('no-path');
    const stand = new PedestrianSimulation(saved,groundRoutes(saved)), first = stand.sample(person.id)!; stand.advance(0.1);
    expect(stand.sample(person.id)!.x).toBe(first.x); expect(stand.sample(person.id)!.walkWeight).toBe(0);
  });
  it('keeps people on their own crossing routes and avoids each other across independent graphs',()=>{
    const p=scene(3.6),a=add(p,-14,0,'horizontal'),b=add(p,0,-14,'vertical');
    a.walkingRoute={points:[[-18,0],[18,0]],width:3.6};b.walkingRoute={points:[[0,-16],[0,16]],width:3.6};
    const routes=groundRoutes(p);expect(routes.get(a.id)?.path?.graph.id).not.toBe(routes.get(b.id)?.path?.graph.id);
    const {sim,traveled}=simulate(p,routes,85);
    expect(traveled.get(a.id)).toBeGreaterThan(25);expect(traveled.get(b.id)).toBeGreaterThan(25);
    expect(Math.abs(sim.sample(a.id)!.z)).toBeLessThan(1.3);expect(Math.abs(sim.sample(b.id)!.x)).toBeLessThan(1.3);
  });
});
