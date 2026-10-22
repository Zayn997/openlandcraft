import { describe, expect, it } from 'vitest';
import { createSite, createLake, createRiver, createSwimRoute, fishHabitat, evaluateProject, layerDisplayProject, type Ocean } from '@openlandcraft/core';
import { WATER_APPEARANCE_DEFAULTS } from '../../core/src/materials';
import { fishSwimPose } from './fish-swim';
import { advanceBirdTime } from './bird-flight';

function oceanProject() {
  const project = createSite({name:'Fish habitat',width:40,depth:40,resolution:129,preset:'flat'});
  project.site.terrain.heights.fill(-4);
  const ocean = {id:'water',kind:'ocean',parentId:'site',name:'Water',visible:true,level:0,amplitude:0.3,appearance:WATER_APPEARANCE_DEFAULTS} as Ocean;
  project.entities = [ocean];
  return project;
}
describe('fish habitat and swimming', () => {
  it('keeps the complete fish below waves and above the bed through continuous independent motion', () => {
    const project=oceanProject(), habitat=fishHabitat(project);
    for(const scale of [0.5,1,2]) {
      const route=createSwimRoute(habitat,[0,100,0],scale)!;
      expect(route).not.toBeNull();
      for(const seed of [0,0.4,0.99]) for(let t=0;t<180;t+=0.11) {
        const pose=fishSwimPose(t,seed,route), bounds=habitat[0].sample(pose.x,pose.z,0.5*scale)!;
        expect(bounds).not.toBeNull(); expect(pose.y).toBeGreaterThanOrEqual(bounds.low); expect(pose.y).toBeLessThanOrEqual(bounds.high);
        const next=fishSwimPose(t+0.016,seed,route);
        expect(Math.hypot(next.x-pose.x,next.y-pose.y,next.z-pose.z)).toBeLessThan(0.05);
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('rejects land, shallow water, site boundaries and hidden water, then restores a valid habitat', () => {
    const p=oceanProject();
    expect(createSwimRoute(fishHabitat(p),[19.8,0,0])).toBeNull();
    p.site.terrain.heights.fill(-0.6); expect(createSwimRoute(fishHabitat(p),[0,0,0])).toBeNull();
    p.site.terrain.heights.fill(1); expect(createSwimRoute(fishHabitat(p),[0,0,0])).toBeNull();
    p.site.terrain.heights.fill(-4); p.entities[0].visible=false;
    expect(createSwimRoute(fishHabitat(p),[0,0,0])).toBeNull();
    p.entities[0].visible=true; expect(createSwimRoute(fishHabitat(p),[0,0,0])).not.toBeNull();
    p.layers[0].visible=false;
    expect(createSwimRoute(fishHabitat(layerDisplayProject(p)),[0,0,0])).toBeNull();
  });
  it('reserves terrain peaks between samples and shrinks routes near the shore', () => {
    const p=oceanProject(), {columns,rows,heights}=p.site.terrain;
    // An island near the full-size orbit forces a smaller route.
    const col=Math.round((2.8/40+0.5)*(columns-1)),row=Math.floor(rows/2);
    heights[row*columns+col]=2;
    const habitat=fishHabitat(p),route=createSwimRoute(habitat,[0,-1.4,0])!;
    expect(route.rx).toBeLessThan(2.8);
    for(let t=0;t<60;t+=0.019) {
      const pose=fishSwimPose(t,0.4,route),bounds=habitat[0].sample(pose.x,pose.z,0.5)!;
      expect(bounds).not.toBeNull(); expect(pose.y).toBeGreaterThanOrEqual(bounds.low);
    }
  });
  it('uses evaluated lake and river beds and does not swim through their boundaries', () => {
    const p=createSite({name:'Inland fish',width:40,depth:40,resolution:129,preset:'flat'});
    const lake=createLake(p,[[-8,-8],[8,-8],[8,8],[-8,8]]); lake.depth=3;
    p.entities=[lake]; let displayed=evaluateProject(p),habitat=fishHabitat(displayed);
    expect(createSwimRoute(habitat,[0,0,0])).not.toBeNull(); expect(createSwimRoute(habitat,[8,0,0])).toBeNull();
    const river=createRiver(p); river.points=[[0,0,-15],[0,0,0],[0,0,15]]; river.depth=3; river.width=6;
    p.entities=[river]; displayed=evaluateProject(p); habitat=fishHabitat(displayed);
    expect(createSwimRoute(habitat,[0,0,0])).not.toBeNull(); expect(createSwimRoute(habitat,[4,0,0])).toBeNull();
    expect(createSwimRoute(habitat,[0,0,15])).toBeNull();
  });
  it('freezes tail and position on pause/reduced motion and resumes without a time jump', () => {
    const route=createSwimRoute(fishHabitat(oceanProject()),[0,-1,0])!;
    for(const [playing,reduced] of [[false,false],[true,true]]) {
      const time=advanceBirdTime(8,10,playing,reduced);
      expect(fishSwimPose(time,0.5,route)).toEqual(fishSwimPose(8,0.5,route));
    }
    expect(advanceBirdTime(8,10,true,false)).toBe(8.1);
  });
});
