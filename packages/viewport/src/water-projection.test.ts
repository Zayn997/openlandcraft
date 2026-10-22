import {describe,it,expect} from 'vitest';
import {OrthographicCamera,PerspectiveCamera,Vector3,Vector4} from 'three';
import {waterDepthProjection} from './water-projection';

describe('water capture depth in both camera projections',()=>{
  it('recovers the actual view-space distance for seabeds and cut faces across near/far ranges',()=>{
    for(const [near,far] of [[.1,1500],[.25,800],[1,200]])for(const camera of [new PerspectiveCamera(42,1.5,near,far),new OrthographicCamera(-30,30,20,-20,near,far)]){
      camera.position.set(30,40,50);camera.lookAt(0,0,0);camera.updateMatrixWorld();
      const coefficients=waterDepthProjection(camera,new Vector4()),forward=camera.getWorldDirection(new Vector3());
      for(const distance of [near,near+1,20,75,far-1]){
        const point=camera.position.clone().addScaledVector(forward,distance),depth=point.project(camera).z*.5+.5;
        const decoded=(coefficients.x*depth+coefficients.y)/(coefficients.z*depth+coefficients.w);
        expect(decoded).toBeCloseTo(distance,7);
      }
    }
  });
  it('retains positive water thickness where perspective decoding made Axo cut faces disappear',()=>{
    const camera=new OrthographicCamera(-40,40,30,-30,.1,1500),coefficients=waterDepthProjection(camera,new Vector4());
    const surface=60,bed=76,depth=new Vector3(0,0,-bed).project(camera).z*.5+.5;
    const captured=(coefficients.x*depth+coefficients.y)/(coefficients.z*depth+coefficients.w);
    expect(captured-surface).toBeCloseTo(16,8);
    const oldPerspectiveDecode=camera.near*camera.far/(camera.far-depth*(camera.far-camera.near));
    expect(Math.max(0,oldPerspectiveDecode-surface)).toBe(0);
  });
});
