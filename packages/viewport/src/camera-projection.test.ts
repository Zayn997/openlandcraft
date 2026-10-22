import {describe,it,expect} from 'vitest';
import {OrthographicCamera,PerspectiveCamera,Vector2,Vector3,Raycaster} from 'three';
import {cameraViewHeight,projectionCamera,fitOrthographicCamera,worldUnitsPerPixel,preserveProjectionFraming} from './camera-projection';

describe('3D and axonometric projection',()=>{
  it('preserves editing zoom but reframes when entering or leaving a water camera',()=>{
    expect(preserveProjectionFraming('perspective','axonometric')).toBe(true);
    expect(preserveProjectionFraming('top','axonometric')).toBe(true);
    for(const waterView of ['shore','underwater','river-underwater','lake-underwater'] as const){
      expect(preserveProjectionFraming(waterView,'axonometric')).toBe(false);
      expect(preserveProjectionFraming(waterView,'perspective')).toBe(false);
      expect(preserveProjectionFraming('axonometric',waterView)).toBe(false);
    }
  });
  it('preserves the panned center and visible scale when switching, including after orthographic zoom',()=>{
    const target=new Vector3(12,4,-7),source=new PerspectiveCamera(42,1.5,.1,1500);
    source.position.copy(target).add(new Vector3(30,30,30));source.zoom=1.7;source.lookAt(target);source.updateProjectionMatrix();source.updateMatrixWorld();
    const height=cameraViewHeight(source,target),ortho=projectionCamera(source,'orthographic',target,1.5) as OrthographicCamera;
    expect(ortho).toBeInstanceOf(OrthographicCamera);expect(cameraViewHeight(ortho,target)).toBeCloseTo(height,10);
    expect(target.clone().project(ortho).x).toBeCloseTo(0,10);expect(target.clone().project(ortho).y).toBeCloseTo(0,10);
    ortho.zoom=2.3;ortho.updateProjectionMatrix();
    const back=projectionCamera(ortho,'perspective',target,1.5);
    expect(back).toBeInstanceOf(PerspectiveCamera);expect(cameraViewHeight(back,target)).toBeCloseTo(height/2.3,10);
    expect(target.clone().project(back).length()).toBeLessThan(1);
  });
  it('keeps parallel lines parallel at different depths, with correct picking and pixel labels',()=>{
    const source=new PerspectiveCamera(42,1.5);source.position.set(0,0,50);source.lookAt(0,0,0);source.updateMatrixWorld();
    const ortho=projectionCamera(source,'orthographic',new Vector3(),1.5) as OrthographicCamera;
    const width=(z:number)=>new Vector3(5,0,z).project(ortho).x-new Vector3(-5,0,z).project(ortho).x;
    expect(width(-20)).toBeCloseTo(width(20),12);
    const ray=new Raycaster();ray.setFromCamera(new Vector2(),ortho);expect(ray.ray.direction.toArray()).toEqual([0,0,-1]);
    expect(worldUnitsPerPixel(ortho,new Vector3(0,0,-20),600)).toBe(worldUnitsPerPixel(ortho,new Vector3(0,0,20),600));
    fitOrthographicCamera(ortho,40,2);expect(ortho.right-ortho.left).toBe(80);expect(cameraViewHeight(ortho,new Vector3())).toBe(40);
  });
});
