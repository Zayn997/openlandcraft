import {Vector4,type Camera} from 'three';

export const waterProjectionUniforms=()=>({uDepthProjection:{value:new Vector4()}});
/** Invert clip Z/W without assuming a perspective camera or a particular near/far range. */
export function waterDepthProjection(camera:Camera,target:Vector4){
  const m=camera.projectionMatrix.elements;
  return target.set(2*m[15],-m[15]-m[14],2*m[11],-m[11]-m[10]);
}
export const waterProjectionGLSL=/* glsl */`
  uniform vec4 uDepthProjection;
  float waterViewDepth(float depth){
    return (uDepthProjection.x*depth+uDepthProjection.y)/(uDepthProjection.z*depth+uDepthProjection.w);
  }
  vec3 waterEye(vec3 world){
    return isOrthographic ? normalize(vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2])) : normalize(cameraPosition-world);
  }
`;
