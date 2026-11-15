import { describe, expect, it } from 'vitest';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { captureExperienceCamera, restoreExperienceCamera } from './experience-camera';

describe('returning from Explore to editing', () => {
  it('restores position, orientation, projection and orbit target for both editor cameras', () => {
    for (const camera of [new PerspectiveCamera(42, 1.5, 0.1, 1500), new OrthographicCamera(-25,25,18,-18,-200,1500)]) {
      const target = new Vector3(12, 4, -7);
      camera.position.set(40, 60, 75); camera.zoom = 1.7; camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const position = camera.position.clone(), rotation = camera.quaternion.clone(), projection = camera.projectionMatrix.clone();
      const snapshot = captureExperienceCamera(camera, target);
      camera.position.set(-6,1.7,3); camera.lookAt(0,1.7,0); camera.zoom = 1; camera.near = 0.05;
      if (camera instanceof PerspectiveCamera) camera.fov = 60;
      camera.updateProjectionMatrix(); target.set(0,0,0);
      restoreExperienceCamera(snapshot, target);
      expect(camera).toBe(snapshot.camera); expect(camera.position).toEqual(position); expect(camera.quaternion.toArray()).toEqual(rotation.toArray());
      expect(camera.projectionMatrix).toEqual(projection); expect(target.toArray()).toEqual([12,4,-7]); expect(camera.zoom).toBe(1.7);
    }
  });
});
