import {Camera,OrthographicCamera,PerspectiveCamera,Vector3} from 'three';
import type {CameraView} from './navigation';

export type CameraProjection='perspective'|'orthographic';
const FOV=42;
/** Dive/shore poses have their own scale; returning to an editor view must frame it again. */
export function preserveProjectionFraming(previous:CameraView,next:CameraView){
  return ![previous,next].some(view=>view==='shore'||view.endsWith('underwater'));
}
export function cameraViewHeight(camera:Camera,target:Vector3){
  if(camera instanceof OrthographicCamera)return (camera.top-camera.bottom)/camera.zoom;
  if(camera instanceof PerspectiveCamera)return 2*camera.position.distanceTo(target)*Math.tan(camera.getEffectiveFOV()*Math.PI/360);
  return 60;
}
export function fitOrthographicCamera(camera:OrthographicCamera,height:number,aspect:number){
  camera.top=height/2;camera.bottom=-height/2;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.zoom=1;
  camera.updateProjectionMatrix();
}
/** Preserve the apparent size at the orbit target when changing projection. */
export function projectionCamera(source:Camera,projection:CameraProjection,target:Vector3,aspect:number){
  const height=cameraViewHeight(source,target),distance=height/(2*Math.tan(FOV*Math.PI/360));
  const camera=projection==='orthographic'?new OrthographicCamera():new PerspectiveCamera(FOV,aspect);
  camera.near=.1;camera.far=1500;camera.up.copy(source.up);camera.layers.mask=source.layers.mask;
  camera.position.copy(source.position).sub(target).normalize().multiplyScalar(distance).add(target);
  camera.quaternion.copy(source.quaternion);
  if(camera instanceof OrthographicCamera){Object.assign(camera,{manual:true});fitOrthographicCamera(camera,height,aspect);}
  else camera.updateProjectionMatrix();
  camera.updateMatrixWorld();return camera;
}
export function worldUnitsPerPixel(camera:Camera,point:Vector3,pixels:number){return cameraViewHeight(camera,point)/Math.max(1,pixels);}
