import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { cameraFlight } from './camera-flight';

describe('Camera focus flight',()=>{
  it('starts at the current pose, eases through intermediate poses and ends exactly at the requested view',()=>{
    const from=new Vector3(40,30,50),target=new Vector3(),to=new Vector3(10,8,12),endTarget=new Vector3(3,2,4);
    const sample=cameraFlight(from,target,to,endTarget);
    expect(sample(0).position.distanceTo(from)).toBeLessThan(1e-10);
    expect(sample(1).position.distanceTo(to)).toBeLessThan(1e-10);
    expect(sample(.5).target.toArray()).toEqual([1.5,1,2]);
    expect(sample(.1).target.distanceTo(target)).toBeLessThan(endTarget.length()*.02);
    expect(sample(.5).position.distanceTo(from)).toBeGreaterThan(1);
    expect(sample(2).position.distanceTo(to)).toBeLessThan(1e-10);
  });
  it('moves around the target without passing through it and supports retargeting from the current pose',()=>{
    const target=new Vector3(),sample=cameraFlight(new Vector3(10,3,0),target,new Vector3(-10,3,0),target);
    for(const t of [.1,.25,.5,.75,.9])expect(sample(t).position.distanceTo(target)).toBeCloseTo(Math.sqrt(109));
    const current=sample(.4),next=cameraFlight(current.position,current.target,new Vector3(0,20,.01),new Vector3(1,0,1));
    expect(next(0).position.distanceTo(current.position)).toBeLessThan(1e-10);
  });
});
