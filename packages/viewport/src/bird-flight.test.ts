import { describe, expect, it } from 'vitest';
import { advanceBirdTime, birdFlightPose, birdSeed } from './bird-flight';
import { sceneCeiling } from './bird-clearance';
import * as THREE from 'three';
import { createSite } from '@openlandcraft/core';

describe('bird flight', () => {
  it('uses actual terrain heights, ignores flight objects and gizmos, and preserves culling bounds', () => {
    const scene=new THREE.Scene(), geometry=new THREE.PlaneGeometry(10,10).rotateX(-Math.PI/2);
    geometry.translate(0,2,0);geometry.boundingBox=new THREE.Box3(new THREE.Vector3(-5,-9,-5),new THREE.Vector3(5,35,5));
    scene.add(new THREE.Mesh(geometry));
    const gizmo=new THREE.Mesh(new THREE.BoxGeometry(1,100,1));gizmo.userData.waterCaptureExclude=true;scene.add(gizmo);
    const bird=new THREE.Mesh(new THREE.BoxGeometry(1,200,1));bird.userData.birdFlight=true;scene.add(bird);
    const project=createSite({name:'Clearance',width:40,depth:40,resolution:129,preset:'flat'});
    expect(sceneCeiling(scene,project)).toBeCloseTo(2);
    expect(geometry.boundingBox.max.y).toBe(35);
    geometry.dispose();gizmo.geometry.dispose();bird.geometry.dispose();
  });
  it('stays inside small and large sites, above scene geometry, with continuous banked motion', () => {
    for (const size of [10, 40, 200]) for (const seed of [0, 0.4, 0.99]) {
      const site = {width:size,depth:size};
      for (let time=0; time<120; time+=0.2) {
        const pose=birdFlightPose(time,seed,[size,5,-size],site,20);
        expect(Math.abs(pose.x)).toBeLessThan(size/2);
        expect(Math.abs(pose.z)).toBeLessThan(size/2);
        expect(pose.y).toBeGreaterThan(22);
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
        expect(pose.flapWeight).toBeGreaterThanOrEqual(0);
        expect(pose.flapWeight).toBeLessThanOrEqual(1);
        const next=birdFlightPose(time+0.016,seed,[size,5,-size],site,20);
        expect(Math.hypot(next.x-pose.x,next.y-pose.y,next.z-pose.z)).toBeLessThan(0.1);
      }
    }
  });
  it('freezes both movement and wing time on pause or reduced motion and avoids background-tab jumps', () => {
    expect(advanceBirdTime(4,0.02,false,false)).toBe(4);
    expect(advanceBirdTime(4,0.02,true,true)).toBe(4);
    expect(advanceBirdTime(4,30,true,false)).toBe(4.1);
    expect(advanceBirdTime(4,-1,true,false)).toBe(4);
    expect(birdSeed('bird-one')).toBe(birdSeed('bird-one'));
    expect(birdSeed('bird-two')).not.toBe(birdSeed('bird-one'));
  });
});
