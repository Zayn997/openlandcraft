import { describe, expect, it } from 'vitest';
import { OrthographicCamera, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';
import { createSite } from '@openlandcraft/core';
import { projectionCamera, cameraViewHeight } from './camera-projection';
import { orientationDirections, orientationPosition, type OrientationView } from './navigation';
import { keepOrthographicSceneInFront, orthographicSceneRadius } from './camera-depth';

describe('Axo scene depth', () => {
  it('prevents the terrain cutaway after framing a small object and zooming out', () => {
    const target = new Vector3(0, 5, 0), source = new PerspectiveCamera(42, 1.5, .1, 1500);
    source.position.copy(orientationPosition('axonometric', target, 18)); source.lookAt(target); source.updateMatrixWorld();
    const camera = projectionCamera(source, 'orthographic', target, 1.5) as OrthographicCamera;
    camera.zoom = .08; camera.updateProjectionMatrix();
    const corner = new Vector3(90, -12, 80);
    expect(corner.clone().project(camera).z).toBeLessThan(-1); // Reproduces the old near-plane slice.
    const before = corner.clone().project(camera), height = cameraViewHeight(camera, target);
    keepOrthographicSceneInFront(camera, target, orthographicSceneRadius(createSite({name:'Castle',width:180,depth:160,resolution:129,preset:'flat'})));
    const after = corner.clone().project(camera);
    expect(after.z).toBeGreaterThan(-1); expect(after.z).toBeLessThan(1);
    expect(after.x).toBeCloseTo(before.x, 10); expect(after.y).toBeCloseTo(before.y, 10);
    expect(cameraViewHeight(camera, target)).toBe(height);
  });
  it('retains panning, scale and picking through every orientation, with enough far depth', () => {
    const target = new Vector3(420, 80, -310), radius = 1800;
    for (const view of Object.keys(orientationDirections) as OrientationView[]) {
      const camera = new OrthographicCamera(-100,100,80,-80,.1,1500);
      camera.position.copy(orientationPosition(view,target,12)); camera.lookAt(target); camera.updateMatrixWorld();
      const before = target.clone().project(camera);
      keepOrthographicSceneInFront(camera,target,radius);
      for (const axis of [new Vector3(radius,0,0),new Vector3(-radius,0,0),new Vector3(0,radius,0),new Vector3(0,-radius,0),new Vector3(0,0,radius),new Vector3(0,0,-radius)]) {
        expect(Math.abs(axis.project(camera).z)).toBeLessThan(1);
      }
      const after = target.clone().project(camera);
      expect(after.x).toBeCloseTo(before.x,10); expect(after.y).toBeCloseTo(before.y,10);
      const ray = new Raycaster(); ray.setFromCamera(new Vector2(after.x,after.y),camera);
      expect(ray.ray.distanceToPoint(target)).toBeLessThan(1e-8);
      const back = projectionCamera(camera,'perspective',target,1.25);
      expect(cameraViewHeight(back,target)).toBeCloseTo(cameraViewHeight(camera,target),10);
    }
  });
  it('covers off-site levels and scaled models without changing perspective cameras', () => {
    const project = createSite({name:'Bounds',width:180,depth:160,resolution:129,preset:'flat'});
    const initial = orthographicSceneRadius(project);
    project.entities.push({id:'level',kind:'level',name:'Level',parentId:'site',visible:true,position:[500,100,500],rotation:45});
    expect(orthographicSceneRadius(project)).toBeGreaterThan(initial);
    project.entities.push({id:'model',kind:'instance',name:'Model',parentId:'site',visible:true,position:[500,100,500],rotation:45,assetId:'test',anchor:'terrain',scale:[20,20,20]});
    expect(orthographicSceneRadius(project)).toBeGreaterThan(5000);
    const camera = new PerspectiveCamera(42,1.5,.1,1500); camera.position.set(3,4,5);
    keepOrthographicSceneInFront(camera,new Vector3(),5000);
    expect(camera.position.toArray()).toEqual([3,4,5]); expect(camera.far).toBe(1500);
  });
});
